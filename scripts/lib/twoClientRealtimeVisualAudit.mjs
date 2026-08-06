import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";

const guestProfiles = Object.freeze([
  {
    id: "alpha",
    nickname: "첫번째하객",
    identity: "visualauditguestalpha01",
    appearance: { presetId: "feminine-long-wave-dress" },
    position: { x: 285, y: 375 }
  },
  {
    id: "bravo",
    nickname: "두번째하객이름은길게",
    identity: "visualauditguestbravo02",
    appearance: { presetId: "masculine-navy-suit" },
    position: { x: 135, y: 315 }
  }
]);

function overlapArea(left, right) {
  if (!left || !right) return 0;
  const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
  const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
  return width * height;
}

export function assessTwoClientRealtimeVisualMetrics(metrics, overlapTolerance = 4) {
  const issues = [];
  if (metrics.pageErrors.length > 0) issues.push(`페이지 오류 ${metrics.pageErrors.length}개`);
  if (metrics.failedRequests.length > 0) issues.push(`요청 실패 ${metrics.failedRequests.length}개`);
  if (!metrics.bothConnected) issues.push("두 하객 동시 접속 실패");
  if (metrics.movementDistance < 8) issues.push(`상대 이동 반영 부족 ${metrics.movementDistance}px`);
  if (!metrics.reactionVisible) issues.push("상대 리액션 표시 실패");
  for (const snapshot of metrics.snapshots) {
    if (!snapshot.remoteVisible) issues.push(`${snapshot.id}: 상대 캐릭터 미표시`);
    if (!snapshot.nameplateContained) issues.push(`${snapshot.id}: 상대 이름표 맵 이탈`);
    if (!snapshot.singleLine) issues.push(`${snapshot.id}: 상대 이름표 줄바꿈`);
    if (!snapshot.fullNameAvailable) issues.push(`${snapshot.id}: 상대 전체 이름 접근 불가`);
    for (const collision of snapshot.collisions) {
      if (collision.area > overlapTolerance) {
        issues.push(`${snapshot.id}: 이름표/${collision.id} 겹침 ${Math.round(collision.area)}px²`);
      }
    }
  }
  return issues;
}

function json(message) {
  return JSON.stringify(message);
}

async function startRealtimeHub(port) {
  const server = createServer((request, response) => {
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
      "content-type": "application/json; charset=utf-8"
    };
    response.writeHead(request.method === "OPTIONS" ? 204 : 404, headers);
    response.end("{}\n");
  });
  const websocketServer = new WebSocketServer({ server });
  const clients = new Map();
  const guests = new Map();
  const pinnedPositions = new Map();

  const broadcast = (message, except = null) => {
    for (const [socket] of clients) {
      if (socket !== except && socket.readyState === socket.OPEN) socket.send(json(message));
    }
  };

  websocketServer.on("connection", (socket) => {
    clients.set(socket, null);
    socket.on("message", (payload) => {
      let message;
      try {
        message = JSON.parse(payload.toString());
      } catch {
        socket.send(json({ type: "error", code: "bad_message" }));
        return;
      }
      if (message.type === "join") {
        const guestId = `guest_${message.resumeId ?? `audit_${clients.size}`}`;
        const guest = {
          guestId,
          nickname: message.nickname,
          appearance: message.appearance,
          x: 285,
          y: 375,
          direction: "down",
          moving: false,
          seq: 0,
          zoneId: message.zoneId,
          lastSeenAt: Date.now()
        };
        clients.set(socket, guestId);
        guests.set(guestId, guest);
        socket.send(json({ type: "welcome", guestId, guests: [...guests.values()] }));
        broadcast({ type: "guest_joined", guest }, socket);
        return;
      }
      const guestId = clients.get(socket);
      const guest = guestId ? guests.get(guestId) : null;
      if (!guest) return;
      if (message.type === "move") {
        const pinned = pinnedPositions.get(guestId);
        const position = pinned ? { ...pinned, seq: message.seq } : {
          x: message.x,
          y: message.y,
          direction: message.direction,
          moving: message.moving,
          seq: message.seq,
          zoneId: message.zoneId
        };
        Object.assign(guest, position, { lastSeenAt: Date.now() });
        broadcast({ type: "guest_moved", guestId, position }, socket);
      } else if (message.type === "react") {
        broadcast({ type: "guest_reacted", guestId, reaction: message.reaction, zoneId: guest.zoneId }, socket);
      } else if (message.type === "leave") {
        socket.close(1000, "left");
      } else if (message.type !== "ping") {
        socket.send(json({ type: "error", code: "bad_message" }));
      }
    });
    socket.on("close", () => {
      const guestId = clients.get(socket);
      clients.delete(socket);
      if (guestId && guests.delete(guestId)) broadcast({ type: "guest_left", guestId }, socket);
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    url: `http://127.0.0.1:${port}`,
    moveGuest(identity, position) {
      const guestId = `guest_${identity}`;
      const guest = guests.get(guestId);
      if (!guest) throw new Error(`Unknown audit guest: ${guestId}`);
      const next = {
        x: position.x,
        y: position.y,
        direction: position.direction ?? "down",
        moving: position.moving ?? false,
        seq: guest.seq + 1,
        zoneId: position.zoneId ?? guest.zoneId
      };
      pinnedPositions.set(guestId, next);
      Object.assign(guest, next, { lastSeenAt: Date.now() });
      broadcast({ type: "guest_moved", guestId, position: next });
    },
    close: async () => {
      for (const socket of clients.keys()) socket.close(1000, "audit complete");
      await new Promise((resolve) => websocketServer.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

async function waitForServer(url, process, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (process.exitCode !== null) throw new Error(`Vite exited before realtime visual audit: ${process.exitCode}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the realtime visual audit server");
}

function seedGuest(profile) {
  localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
    version: 1,
    nickname: profile.nickname,
    appearance: profile.appearance,
    updatedAt: new Date().toISOString()
  }));
  localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({ version: 1, completed: true }));
  localStorage.setItem("wedding-game:realtime-identity:v1", profile.identity);
  localStorage.setItem("wedding-game:world-session:v1", JSON.stringify({
    version: 1,
    zoneId: "home",
    position: profile.position,
    direction: "down",
    guideCheckpointId: null,
    updatedAt: new Date().toISOString()
  }));
}

async function enterGarden(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const resume = page.locator(".entry-screen__resume-access");
  if (await resume.isVisible().catch(() => false)) await resume.click();
  await page.locator(".game-world").waitFor({ state: "visible" });
  await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 15_000 });
}

async function moveToZone(page, zoneLabel, zoneId) {
  const toggle = page.locator(".world-hud__tools-toggle");
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  const vault = page.locator(".world-game-vault");
  if (await vault.getAttribute("open") === null) await vault.locator(":scope > summary").click();
  await page.getByRole("button", { name: `${zoneLabel} 바로 이동`, exact: true }).click();
  await page.waitForFunction((expected) => (
    document.querySelector(".world-map__stage")?.getAttribute("data-zone") === expected
  ), zoneId);
  await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 15_000 });
  if (await toggle.getAttribute("aria-expanded") === "true") await toggle.click();
}

async function sendReaction(page, label) {
  const toggle = page.locator(".world-hud__tools-toggle");
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  const vault = page.locator(".world-game-vault");
  if (await vault.getAttribute("open") === null) await vault.locator(":scope > summary").click();
  await page.getByRole("button", { name: /빠른 도구 편집/ }).click();
  await page.getByRole("button", { name: "하객 리액션 열기", exact: true }).click();
  await page.getByRole("button", { name: `${label} 보내기`, exact: true }).click();
  await page.locator(".game-quick-dock__settings > header button").click();
}

async function captureSnapshot(page, id, remoteNickname) {
  return page.evaluate(({ snapshotId, nickname }) => {
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return { x: value.x, y: value.y, width: value.width, height: value.height, left: value.left, top: value.top, right: value.right, bottom: value.bottom };
    };
    const visible = (element) => {
      const style = getComputedStyle(element);
      const value = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.02 && value.width > 0 && value.height > 0;
    };
    const remote = [...document.querySelectorAll(".player--remote")].find((element) => element.getAttribute("aria-label") === nickname);
    const nameplate = remote?.querySelector(".world-player__name");
    const map = document.querySelector(".world-map");
    const nameplateRect = nameplate instanceof HTMLElement && visible(nameplate) ? rect(nameplate) : null;
    const mapRect = map instanceof HTMLElement ? rect(map) : null;
    const obstacles = [
      ...document.querySelectorAll(".world-spot__card, .world-portal__label, .world-portal__congestion, .world-portal__wait, .wedding-npc__label, .npc-dialogue, .guest-reaction-bubble")
    ].filter((element) => element !== nameplate && visible(element));
    const area = (left, right) => Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
      * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
    const lineHeight = nameplate instanceof HTMLElement ? Number.parseFloat(getComputedStyle(nameplate).lineHeight) : 0;
    return {
      id: snapshotId,
      remoteVisible: remote instanceof HTMLElement && visible(remote),
      remotePosition: remote instanceof HTMLElement
        ? { x: Number.parseFloat(remote.style.left), y: Number.parseFloat(remote.style.top) }
        : null,
      nameplateOffset: remote instanceof HTMLElement ? {
        x: Number.parseFloat(remote.style.getPropertyValue("--remote-name-offset-x")) || 0,
        y: Number.parseFloat(remote.style.getPropertyValue("--remote-name-offset-y")) || 0
      } : null,
      nameplateContained: Boolean(nameplateRect && mapRect
        && nameplateRect.left >= mapRect.left - 1 && nameplateRect.right <= mapRect.right + 1
        && nameplateRect.top >= mapRect.top - 1 && nameplateRect.bottom <= mapRect.bottom + 1),
      singleLine: Boolean(nameplateRect && lineHeight > 0 && nameplateRect.height <= lineHeight + 8),
      fullNameAvailable: nameplate?.getAttribute("title") === nickname && remote?.getAttribute("aria-label") === nickname,
      nameplateRect,
      collisions: nameplateRect ? obstacles.map((element, index) => ({
        id: `${element.className || element.tagName}-${index}`,
        area: area(nameplateRect, rect(element)),
        rect: rect(element)
      })).filter(({ area: collisionArea }) => collisionArea > 0) : []
    };
  }, { snapshotId: id, nickname: remoteNickname });
}

async function waitForRemotePosition(page, x, y) {
  await page.waitForFunction(({ expectedX, expectedY }) => {
    const remote = document.querySelector(".player--remote");
    return remote instanceof HTMLElement
      && Number.parseFloat(remote.style.left) === expectedX
      && Number.parseFloat(remote.style.top) === expectedY;
  }, { expectedX: x, expectedY: y });
  await page.waitForTimeout(180);
}

export async function runTwoClientRealtimeVisualAudit({ rootDir, outputDir, appPort = 4192, realtimePort = 4193 }) {
  await mkdir(outputDir, { recursive: true });
  const hub = await startRealtimeHub(realtimePort);
  const app = spawn("pnpm", ["--filter", "@wedding-game/client", "exec", "vite", "--host", "127.0.0.1", "--port", String(appPort), "--strictPort"], {
    cwd: rootDir,
    env: {
      ...process.env,
      BROWSER: "none",
      VITE_WORKER_URL: hub.url,
      VITE_INVITATION_ID: "two-client-visual-audit"
    },
    stdio: "pipe"
  });
  const url = `http://127.0.0.1:${appPort}/`;
  try {
    await waitForServer(url, app);
    const { chromium, devices } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const contexts = [];
    const pages = [];
    const pageErrors = [];
    const failedRequests = [];
    try {
      for (const profile of guestProfiles) {
        const context = await browser.newContext({ ...devices["Pixel 7"] });
        await context.addInitScript(seedGuest, profile);
        const page = await context.newPage();
        page.on("pageerror", (error) => pageErrors.push(`${profile.id}: ${error.message}`));
        page.on("requestfailed", (request) => {
          const reason = request.failure()?.errorText ?? "unknown";
          if (!reason.includes("ERR_ABORTED") && !reason.includes("cancelled")) failedRequests.push(`${profile.id}: ${request.url()} ${reason}`);
        });
        await enterGarden(page, url);
        contexts.push(context);
        pages.push(page);
      }

      const [alpha, bravo] = pages;
      await Promise.all(pages.map((page) => page.locator(".player--remote").waitFor({ state: "visible", timeout: 10_000 })));
      const bothConnected = await Promise.all(pages.map((page) => page.locator(".player--remote").count())).then((counts) => counts.every((count) => count === 1));
      const initialRemotePosition = await alpha.locator(".player--remote").evaluate((element) => ({ left: Number.parseFloat(element.style.left), top: Number.parseFloat(element.style.top) }));
      const joystick = bravo.locator(".virtual-joystick");
      await joystick.focus();
      await joystick.press("ArrowRight", { delay: 520 });
      await alpha.waitForFunction(({ x, y }) => {
        const remote = document.querySelector(".player--remote");
        if (!(remote instanceof HTMLElement)) return false;
        return Math.hypot(Number.parseFloat(remote.style.left) - x, Number.parseFloat(remote.style.top) - y) >= 8;
      }, { x: initialRemotePosition.left, y: initialRemotePosition.top });
      const movedRemotePosition = await alpha.locator(".player--remote").evaluate((element) => ({ left: Number.parseFloat(element.style.left), top: Number.parseFloat(element.style.top) }));
      const movementDistance = Math.round(Math.hypot(movedRemotePosition.left - initialRemotePosition.left, movedRemotePosition.top - initialRemotePosition.top) * 10) / 10;

      hub.moveGuest(guestProfiles[1].identity, { x: 150, y: 285, zoneId: "home" });
      await waitForRemotePosition(alpha, 150, 285);
      const homeSnapshot = await captureSnapshot(alpha, "home-spot", guestProfiles[1].nickname);
      await sendReaction(bravo, "하트");
      await alpha.getByRole("status", { name: `${guestProfiles[1].nickname}님의 하트`, exact: true }).waitFor({ state: "visible", timeout: 5_000 });
      hub.moveGuest(guestProfiles[1].identity, { x: 150, y: 285, zoneId: "home" });
      await waitForRemotePosition(alpha, 150, 285);
      const reactionVisible = await alpha.locator(".player--remote .guest-reaction-bubble").isVisible();
      const reactionSnapshot = await captureSnapshot(alpha, "home-reaction", guestProfiles[1].nickname);

      await Promise.all([moveToZone(alpha, "예식장 로비", "lobby"), moveToZone(bravo, "예식장 로비", "lobby")]);
      hub.moveGuest(guestProfiles[1].identity, { x: 525, y: 135, zoneId: "lobby" });
      await waitForRemotePosition(alpha, 525, 135);
      const portalSnapshot = await captureSnapshot(alpha, "lobby-portal", guestProfiles[1].nickname);

      await Promise.all([moveToZone(alpha, "신부 대기실", "bridal-room"), moveToZone(bravo, "신부 대기실", "bridal-room")]);
      await alpha.getByRole("button", { name: /신부 .*와 대화하기/ }).click();
      await alpha.locator(".npc-dialogue").waitFor({ state: "visible", timeout: 12_000 });
      hub.moveGuest(guestProfiles[1].identity, { x: 360, y: 330, zoneId: "bridal-room" });
      await waitForRemotePosition(alpha, 360, 330);
      await sendReaction(bravo, "축하");
      await alpha.getByRole("status", { name: `${guestProfiles[1].nickname}님의 축하`, exact: true }).waitFor({ state: "visible", timeout: 5_000 });
      await waitForRemotePosition(alpha, 360, 330);
      const npcSnapshot = await captureSnapshot(alpha, "bridal-npc-dialogue", guestProfiles[1].nickname);

      const snapshots = [homeSnapshot, reactionSnapshot, portalSnapshot, npcSnapshot];
      const metrics = { pageErrors, failedRequests, bothConnected, movementDistance, reactionVisible, snapshots };
      const issues = assessTwoClientRealtimeVisualMetrics(metrics);
      const screenshots = [];
      for (let index = 0; index < pages.length; index += 1) {
        const screenshotPath = path.join(outputDir, `${guestProfiles[index].id}.png`);
        await pages[index].screenshot({ path: screenshotPath, fullPage: false });
        screenshots.push(screenshotPath);
      }
      const reportPath = path.join(outputDir, "two-client-realtime-report.json");
      await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), metrics, issues, screenshots }, null, 2)}\n`);
      if (issues.length > 0) throw new Error(`Two-client realtime visual audit failed:\n${issues.join("\n")}`);
      return { metrics, issues, screenshots, reportPath };
    } finally {
      await Promise.all(contexts.map((context) => context.close().catch(() => {})));
      await browser.close();
    }
  } finally {
    app.kill("SIGTERM");
    await hub.close();
  }
}

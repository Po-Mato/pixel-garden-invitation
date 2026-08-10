import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareIosSafariVisualBaseline,
  iosSafariBaselinePath,
  iosSafariCurrentPath,
  iosSafariSentinelPixelRatio,
  iosSafariVisualProfile,
  iosSafariVisualStates
} from "./lib/iosSafariVisualBaseline.mjs";
import { iosSafariText200AuditCss } from "./lib/mobileHudBrowserAudit.mjs";
import { assessFrameTimingHeadroom, summarizeFrameTimings } from "./lib/frameTimingMetrics.mjs";
import { runDevicePwaOfflineAudit } from "./lib/devicePwaOfflineAudit.mjs";
import { parsePwaPrecachePaths } from "./lib/gameResourceBudget.mjs";
import sharp from "sharp";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const url = option("--url", "http://127.0.0.1:4178/");
const outputDir = option("--output-dir", path.join(rootDir, ".superpowers/visual-regression/ios-safari"));
const mode = option("--mode", "auto");
const appiumUrl = option("--appium-url", "http://127.0.0.1:4723/wd/hub");
const pwaUrl = option("--pwa-url");
const previewHostUrl = option("--preview-host-url", "http://127.0.0.1:4188/");
const compositorFaultInjection = option("--compositor-fault-injection", "none");
const compositorFaultStrategies = ["none", "activate-refresh", "recreate-session"];
if (!compositorFaultStrategies.includes(compositorFaultInjection)) {
  throw new Error(`알 수 없는 iOS compositor fault injection: ${compositorFaultInjection}`);
}
const deviceKind = process.env.IOS_SAFARI_DEVICE_KIND === "physical" ? "physical" : "simulator";
const deviceUdid = process.env.IOS_DEVICE_UDID ?? process.env.IOS_SIMULATOR_UDID;
const deviceName = process.env.IOS_DEVICE_NAME ?? iosSafariVisualProfile.deviceName;
const platformVersion = process.env.IOS_PLATFORM_VERSION ?? "18.5";
const prebuiltWdaPath = process.env.IOS_PREBUILT_WDA_PATH;
await mkdir(outputDir, { recursive: true });

async function webdriver(method, endpoint, body) {
  const target = new URL(`${appiumUrl}${endpoint}`);
  const payload = body === undefined ? null : JSON.stringify(body);
  const { statusCode, responseBody } = await new Promise((resolve, reject) => {
    const request = http.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method,
      headers: payload === null ? undefined : {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload)
      }
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        statusCode: response.statusCode ?? 500,
        responseBody: Buffer.concat(chunks).toString("utf8")
      }));
    });
    request.on("error", reject);
    if (payload !== null) request.write(payload);
    request.end();
  });
  const result = responseBody ? JSON.parse(responseBody) : {};
  if (statusCode < 200 || statusCode >= 300 || result.value?.error) {
    throw new Error(result.value?.message ?? `WebDriver ${method} ${endpoint} 실패: ${statusCode}`);
  }
  return result.value;
}

async function waitForAppium(timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const status = await webdriver("GET", "/status");
      if (status?.ready) return;
    } catch {
      // Appium may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Appium 서버 준비 시간 초과");
}

let sessionId = null;
let safariCapabilities = null;
async function sessionCommand(method, endpoint, body) {
  if (!sessionId) throw new Error("iOS Safari WebDriver 세션이 없습니다.");
  return webdriver(method, `/session/${sessionId}${endpoint}`, body);
}

async function evaluate(script) {
  return sessionCommand("POST", "/execute/sync", { script, args: [] });
}

async function waitForDocument(expression, description, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(`return Boolean(${expression});`).catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${description} 대기 시간 초과`);
}

async function captureNativeScreenshot() {
  const encoded = await sessionCommand("GET", "/screenshot");
  return Buffer.from(encoded, "base64");
}

async function screenshot(state, frame = null) {
  await writeFile(iosSafariCurrentPath(outputDir, state), frame ?? await captureNativeScreenshot());
}

async function nativeSentinelRatio(frame) {
  const { data, info } = await sharp(frame).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return iosSafariSentinelPixelRatio(data, info.channels);
}

const stableGameFrameExpression = `
  (() => {
    const game = document.querySelector(".game-world");
    const map = document.querySelector(".world-map__stage--background-loaded");
    const player = document.querySelector(".world-player:not(.player--remote) .character-layer");
    if (!(game instanceof HTMLElement) || !(map instanceof HTMLElement) || !(player instanceof HTMLElement)) {
      return false;
    }
    const playerRect = player.getBoundingClientRect();
    return document.visibilityState === "visible"
      && !document.querySelector(".screen-loading")
      && playerRect.width > 0
      && playerRect.height > 0
      && getComputedStyle(player).backgroundImage !== "none";
  })()
`;

async function createSafariSession() {
  if (!safariCapabilities) throw new Error("iOS Safari 세션 설정이 준비되지 않았어요");
  const session = await webdriver("POST", "/session", {
    capabilities: { alwaysMatch: safariCapabilities }
  });
  sessionId = session.sessionId;
  return session;
}

async function applyBaselineFreeze() {
  await evaluate(`
    document.getElementById("ios-safari-baseline-freeze")?.remove();
    const style = document.createElement("style");
    style.id = "ios-safari-baseline-freeze";
    style.textContent = \`
      html.ios-safari-baseline-freeze *,
      html.ios-safari-baseline-freeze *::before,
      html.ios-safari-baseline-freeze *::after {
        animation: none !important;
        caret-color: transparent !important;
        transition: none !important;
      }
      html.ios-safari-baseline-freeze .world-travel-status-row,
      html.ios-safari-baseline-freeze .world-route-arrival-card { display: none !important; }
    \`;
    document.head.append(style);
    document.documentElement.classList.add("ios-safari-baseline-freeze");
    return true;
  `);
}

async function restoreGameView() {
  await waitForDocument("document.readyState === 'complete'", "복구된 Safari 문서", 60_000);
  await evaluate(`
    localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
      version: 1,
      nickname: "iOS Safari 감사",
      appearance: { presetId: "feminine-long-wave-dress" },
      updatedAt: new Date().toISOString()
    }));
    localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({
      version: 1,
      completed: true,
      completedAt: new Date().toISOString()
    }));
    localStorage.setItem("wedding-game:world-session:v1", JSON.stringify({
      version: 1,
      zoneId: "home",
      position: { x: 285, y: 555 },
      direction: "down",
      guideCheckpointId: null,
      updatedAt: new Date().toISOString()
    }));
    return true;
  `);
  await sessionCommand("POST", "/url", { url });
  await waitForDocument("document.querySelector('.entry-screen__resume-access')", "복구 후 이어하기 버튼", 60_000);
  await evaluate(`document.querySelector(".entry-screen__resume-access")?.click(); return true;`);
  await waitForDocument(stableGameFrameExpression, "복구 후 게임 캡처 프레임", 60_000);
  await waitForDocument("document.fonts.status === 'loaded'", "복구 후 한글 폰트", 60_000);
  await applyBaselineFreeze();
}

async function recoverNativeCompositor(strategy) {
  if (strategy === "activate-refresh") {
    await sessionCommand("POST", "/appium/device/activate_app", {
      bundleId: "com.apple.mobilesafari"
    });
    await sessionCommand("POST", "/refresh");
    await restoreGameView();
    return;
  }
  if (strategy === "recreate-session") {
    if (sessionId) await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
    sessionId = null;
    await createSafariSession();
    await sessionCommand("POST", "/url", { url });
    await restoreGameView();
    return;
  }
  throw new Error(`알 수 없는 iOS 캡처 복구 전략: ${strategy}`);
}

async function injectNativeCompositorFault() {
  if (compositorFaultInjection === "none") return null;
  const startedAt = Date.now();
  const injection = {
    requestedStrategy: compositorFaultInjection,
    mechanism: "background-mobile-safari",
    triggered: false,
    durationMs: 0,
    error: null
  };
  try {
    await sessionCommand("POST", "/execute/sync", {
      script: "mobile: backgroundApp",
      args: [{ seconds: 1 }]
    });
    injection.triggered = true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error) {
    injection.error = error instanceof Error ? error.message : String(error);
  }
  injection.durationMs = Date.now() - startedAt;
  return injection;
}

async function probeNativeCompositor() {
  await waitForDocument(stableGameFrameExpression, "게임 캡처 프레임", 60_000);
  await evaluate(`
    const sentinel = document.createElement("div");
    sentinel.id = "ios-safari-native-compositor-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgb(255,0,255);pointer-events:none";
    document.body.append(sentinel);
    return true;
  `);

  let visibleAttempt = 0;
  let visibleRatio = 0;
  try {
    for (visibleAttempt = 1; visibleAttempt <= 4; visibleAttempt += 1) {
      visibleRatio = await nativeSentinelRatio(await captureNativeScreenshot());
      if (visibleRatio >= 0.2) break;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  } finally {
    await evaluate(`document.getElementById("ios-safari-native-compositor-sentinel")?.remove(); return true;`);
  }
  if (visibleRatio < 0.2) {
    return {
      passed: false,
      reason: "sentinel-not-visible",
      evidence: { visibleAttempt, visibleRatio, settledAttempt: 0, settledRatio: null }
    };
  }

  let settledAttempt = 0;
  let settledRatio = 1;
  let settledFrame = null;
  for (settledAttempt = 1; settledAttempt <= 6; settledAttempt += 1) {
    settledFrame = await captureNativeScreenshot();
    settledRatio = await nativeSentinelRatio(settledFrame);
    if (settledRatio <= 0.02) break;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (!settledFrame || settledRatio > 0.02) {
    return {
      passed: false,
      reason: "sentinel-not-cleared",
      evidence: { visibleAttempt, visibleRatio, settledAttempt, settledRatio }
    };
  }
  await waitForDocument(stableGameFrameExpression, "게임 캡처 프레임 재확인", 60_000);
  return {
    passed: true,
    frame: settledFrame,
    evidence: { visibleAttempt, visibleRatio, settledAttempt, settledRatio }
  };
}

async function stabilizeGameFrameCapture() {
  const attempts = [];
  const recoveries = [];
  const faultInjection = await injectNativeCompositorFault();
  const recoveryStrategies = compositorFaultInjection === "none"
    ? ["activate-refresh", "recreate-session"]
    : [compositorFaultInjection, ...["activate-refresh", "recreate-session"].filter((item) => (
      item !== compositorFaultInjection
    ))];
  for (let cycle = 0; cycle <= recoveryStrategies.length; cycle += 1) {
    const result = cycle === 0 && faultInjection
      ? {
          passed: false,
          reason: "scheduled-background-fault-injection",
          evidence: { visibleAttempt: 0, visibleRatio: null, settledAttempt: 0, settledRatio: null }
        }
      : await probeNativeCompositor();
    attempts.push({ cycle: cycle + 1, passed: result.passed, reason: result.reason ?? null, ...result.evidence });
    if (result.passed) {
      const recoveryDurationMs = recoveries.reduce((total, recovery) => total + (recovery.durationMs ?? 0), 0);
      const requestedRecoveryCompleted = !faultInjection || (
        faultInjection.triggered
        && recoveries[0]?.strategy === faultInjection.requestedStrategy
        && recoveries[0]?.status === "completed"
      );
      return {
        frame: result.frame,
        evidence: {
          recovered: recoveries.length > 0,
          recoveryCount: recoveries.length,
          recoveryDurationMs,
          faultInjection: faultInjection ? {
            ...faultInjection,
            recovered: requestedRecoveryCompleted,
            recoveryStrategy: recoveries.find(({ status }) => status === "completed")?.strategy ?? null
          } : null,
          attempts,
          recoveries
        }
      };
    }
    const strategy = recoveryStrategies[cycle];
    if (!strategy) break;
    const recovery = { strategy, status: "started", startedAt: new Date().toISOString() };
    const recoveryStartedAt = Date.now();
    recoveries.push(recovery);
    try {
      await recoverNativeCompositor(strategy);
      recovery.status = "completed";
    } catch (error) {
      recovery.status = "failed";
      recovery.error = error instanceof Error ? error.message : String(error);
    } finally {
      recovery.durationMs = Date.now() - recoveryStartedAt;
    }
  }
  const reasons = attempts.map(({ reason, visibleRatio, settledRatio }) => (
    `${reason}:${visibleRatio ?? "n/a"}/${settledRatio ?? "n/a"}`
  )).join(", ");
  throw new Error(`iOS Safari 네이티브 캡처 자동 복구 실패: ${reasons}`);
}

async function performTouchSwipe({ x, fromY, toY, durationMs = 620 }) {
  await sessionCommand("POST", "/actions", {
    actions: [{
      type: "pointer",
      id: "ios-chrome-swipe",
      parameters: { pointerType: "touch" },
      actions: [
        { type: "pointerMove", duration: 0, x, y: fromY, origin: "viewport" },
        { type: "pointerDown", button: 0 },
        { type: "pause", duration: 80 },
        { type: "pointerMove", duration: durationMs, x, y: toY, origin: "viewport" },
        { type: "pointerUp", button: 0 }
      ]
    }]
  });
  await sessionCommand("DELETE", "/actions").catch(() => undefined);
}

async function startLandscapeViewportTrace() {
  await evaluate(`
    const audit = {
      active: true,
      startedAt: performance.now(),
      previousFrameAt: null,
      frameDeltas: [],
      events: []
    };
    const snapshot = (source) => audit.events.push({
      source,
      at: Math.round((performance.now() - audit.startedAt) * 100) / 100,
      innerHeight,
      visualHeight: visualViewport?.height ?? innerHeight,
      offsetTop: visualViewport?.offsetTop ?? 0,
      pageTop: visualViewport?.pageTop ?? scrollY,
      scrollY
    });
    audit.onVisualResize = () => snapshot("visualViewport.resize");
    audit.onVisualScroll = () => snapshot("visualViewport.scroll");
    audit.onWindowResize = () => snapshot("window.resize");
    visualViewport?.addEventListener("resize", audit.onVisualResize);
    visualViewport?.addEventListener("scroll", audit.onVisualScroll);
    addEventListener("resize", audit.onWindowResize);
    const tick = (now) => {
      if (!audit.active) return;
      if (audit.previousFrameAt !== null) audit.frameDeltas.push(now - audit.previousFrameAt);
      audit.previousFrameAt = now;
      requestAnimationFrame(tick);
    };
    snapshot("start");
    requestAnimationFrame(tick);
    window.__iosSafariViewportAudit = audit;
    return true;
  `);
}

async function stopLandscapeViewportTrace() {
  return evaluate(`
    const audit = window.__iosSafariViewportAudit;
    if (!audit) throw new Error("Safari viewport audit was not started");
    audit.active = false;
    visualViewport?.removeEventListener("resize", audit.onVisualResize);
    visualViewport?.removeEventListener("scroll", audit.onVisualScroll);
    removeEventListener("resize", audit.onWindowResize);
    audit.events.push({
      source: "stop",
      at: Math.round((performance.now() - audit.startedAt) * 100) / 100,
      innerHeight,
      visualHeight: visualViewport?.height ?? innerHeight,
      offsetTop: visualViewport?.offsetTop ?? 0,
      pageTop: visualViewport?.pageTop ?? scrollY,
      scrollY
    });
    return { events: audit.events, frameDeltas: audit.frameDeltas };
  `);
}

const captureReport = {
  generatedAt: new Date().toISOString(),
  profile: iosSafariVisualProfile,
  url,
  automation: "Appium XCUITest WebDriver",
  device: { kind: deviceKind, udid: deviceUdid ?? null, name: deviceName, platformVersion },
  simulatorUdid: deviceKind === "simulator" ? deviceUdid ?? null : null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT) || null,
  sha: process.env.GITHUB_SHA ?? null,
  runUrl: process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null,
  userAgent: null,
  viewport: null,
  scrollStates: {},
  nativeCompositor: null,
  pwaOffline: null,
  landscape: {},
  phaseTimings: {},
  slowestPhase: null,
  comparisons: []
};

let activeCapturePhase = null;
let captureOutcome = "failed";
function finishCapturePhase(outcome = "completed") {
  if (!activeCapturePhase) return;
  const timing = captureReport.phaseTimings[activeCapturePhase];
  timing.durationMs = Math.max(0, Date.now() - timing.startedAtMs);
  timing.outcome = outcome;
  delete timing.startedAtMs;
  activeCapturePhase = null;
}

function startCapturePhase(name) {
  finishCapturePhase();
  activeCapturePhase = name;
  captureReport.phaseTimings[name] = {
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    durationMs: 0,
    outcome: "running"
  };
}

function identifySlowestCapturePhase() {
  const entries = Object.entries(captureReport.phaseTimings);
  if (entries.length === 0) return null;
  const [name, timing] = entries.sort((left, right) => right[1].durationMs - left[1].durationMs)[0];
  return { name, durationMs: timing.durationMs };
}

async function captureLandscapeMetrics(state) {
  const metrics = await evaluate(`
    const probe = document.createElement("div");
    probe.style.cssText = [
      "position:fixed",
      "inset:0",
      "pointer-events:none",
      "padding-top:env(safe-area-inset-top)",
      "padding-right:env(safe-area-inset-right)",
      "padding-bottom:env(safe-area-inset-bottom)",
      "padding-left:env(safe-area-inset-left)"
    ].join(";");
    document.body.append(probe);
    const probeStyle = getComputedStyle(probe);
    const safeArea = {
      top: parseFloat(probeStyle.paddingTop) || 0,
      right: parseFloat(probeStyle.paddingRight) || 0,
      bottom: parseFloat(probeStyle.paddingBottom) || 0,
      left: parseFloat(probeStyle.paddingLeft) || 0
    };
    probe.remove();
    const viewport = {
      width: innerWidth,
      height: innerHeight,
      visualWidth: visualViewport?.width ?? innerWidth,
      visualHeight: visualViewport?.height ?? innerHeight,
      offsetLeft: visualViewport?.offsetLeft ?? 0,
      offsetTop: visualViewport?.offsetTop ?? 0,
      scrollY,
      dpr: devicePixelRatio
    };
    const selectors = [
      ".world-hud__status",
      ".world-hud__tools-toggle",
      ".world-hud__tools",
      ".world-minimap",
      ".world-control-dock .virtual-joystick",
      ".world-control-actions",
      ".world-context-action"
    ];
    const controls = selectors.flatMap((selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return [];
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return [];
      const rect = element.getBoundingClientRect();
      return [{ selector, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }];
    });
    const visibleDialogs = [...document.querySelectorAll('[role="dialog"]')].flatMap((dialog) => {
      if (!(dialog instanceof HTMLElement)) return [];
      const style = getComputedStyle(dialog);
      const rect = dialog.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return [];
      if (rect.width <= 0 || rect.height <= 0) return [];
      return [dialog.getAttribute("aria-label") || dialog.getAttribute("aria-labelledby") || dialog.className];
    });
    const left = viewport.offsetLeft + safeArea.left;
    const top = viewport.offsetTop + safeArea.top;
    const right = viewport.offsetLeft + viewport.visualWidth - safeArea.right;
    const bottom = viewport.offsetTop + viewport.visualHeight - safeArea.bottom;
    const hudText = [
      ["current-zone", ".world-zone-summary strong", 2],
      ["guidance-toggle", ".world-hud__tools-toggle > span", 1],
      ["next-destination", ".world-destination-guide strong", 2]
    ].flatMap(([id, selector, maxLines]) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return [];
      const style = getComputedStyle(element);
      const lineHeight = Number.parseFloat(style.lineHeight);
      const lineCount = lineHeight > 0
        ? Math.max(1, Math.round(element.getBoundingClientRect().height / lineHeight))
        : 1;
      return [{
        id,
        text: element.textContent?.trim() ?? "",
        clippedInline: style.overflowX !== "visible" && element.scrollWidth > element.clientWidth + 1,
        clippedBlock: style.overflowY !== "visible" && element.scrollHeight > element.clientHeight + 1,
        lineCount,
        maxLines
      }];
    });
    const playerCenter = (() => {
      const player = document.querySelector(".world-player:not(.player--remote)");
      const sprite = player?.querySelector(".character-sprite--world");
      const map = document.querySelector(".world-map");
      const stage = document.querySelector(".world-map__stage");
      if (!(player instanceof HTMLElement) || !(sprite instanceof HTMLElement)
        || !(map instanceof HTMLElement) || !(stage instanceof HTMLElement)) return null;
      const mapRect = map.getBoundingClientRect();
      const spriteRect = sprite.getBoundingClientRect();
      const playerStyle = getComputedStyle(player);
      const transform = getComputedStyle(stage).transform;
      const matrix = transform === "none" ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(transform);
      const zoom = matrix.a || 1;
      const logicalWidth = Number(stage.dataset.logicalWidth) || stage.offsetWidth;
      const logicalHeight = Number(stage.dataset.logicalHeight) || stage.offsetHeight;
      const scaledWidth = logicalWidth * zoom;
      const scaledHeight = logicalHeight * zoom;
      const centerOffsetX = Number.parseFloat(
        playerStyle.getPropertyValue("--character-world-anchor-offset-x")
      ) || 0;
      const centerY = Number.parseFloat(
        playerStyle.getPropertyValue("--character-world-anchor-y")
      ) || spriteRect.height / (2 * zoom);
      const visualCenter = {
        x: spriteRect.x + spriteRect.width / 2 + centerOffsetX * zoom,
        y: spriteRect.y + centerY * zoom
      };
      const viewportCenter = {
        x: mapRect.x + mapRect.width / 2,
        y: mapRect.y + mapRect.height / 2
      };
      const centerable = {
        x: scaledWidth > mapRect.width + 1
          && matrix.m41 < -0.5
          && matrix.m41 > mapRect.width - scaledWidth + 0.5,
        y: scaledHeight > mapRect.height + 1
          && matrix.m42 < -0.5
          && matrix.m42 > mapRect.height - scaledHeight + 0.5
      };
      const error = {
        x: centerable.x ? visualCenter.x - viewportCenter.x : 0,
        y: centerable.y ? visualCenter.y - viewportCenter.y : 0
      };
      return {
        visualCenter,
        viewportCenter,
        centerable,
        error,
        errorPx: Math.round(Math.hypot(error.x, error.y) * 100) / 100,
        camera: { x: matrix.m41, y: matrix.m42, zoom }
      };
    })();
    return {
      state: ${JSON.stringify(state)},
      orientation: screen.orientation?.type ?? null,
      viewport,
      safeArea,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      visibleDialogs,
      hudText,
      textContained: hudText.every(({ clippedInline, clippedBlock, lineCount, maxLines }) => (
        !clippedInline && !clippedBlock && lineCount <= maxLines
      )),
      playerCenter,
      controls,
      controlsContained: controls.every(({ rect }) => (
        rect.x >= left - 2
        && rect.y >= top - 2
        && rect.x + rect.width <= right + 2
        && rect.y + rect.height <= bottom + 2
      ))
    };
  `);
  return metrics;
}

function assertLandscapeMetrics(metrics, { requireHudTools = false } = {}) {
  if (metrics.viewport.width <= metrics.viewport.height) {
    throw new Error(`${metrics.state} 실제 Safari 가로 회전 실패`);
  }
  if (metrics.visibleDialogs.length > 0) {
    throw new Error(`${metrics.state} 실제 Safari 맵 위 대화상자 잔존: ${metrics.visibleDialogs.join(", ")}`);
  }
  if (metrics.horizontalOverflow) throw new Error(`${metrics.state} 실제 Safari 가로 넘침`);
  if (!metrics.controlsContained) throw new Error(`${metrics.state} 실제 Safari safe-area 이탈`);
  if (requireHudTools && !metrics.controls.some(({ selector }) => selector === ".world-hud__tools")) {
    throw new Error(`${metrics.state} 실제 Safari 펼친 안내 패널 측정 누락`);
  }
  if (!metrics.textContained) throw new Error(`${metrics.state} 실제 Safari HUD 문구 잘림`);
  if (!metrics.playerCenter) throw new Error(`${metrics.state} 실제 Safari 캐릭터 중심 측정 누락`);
  if (metrics.playerCenter.errorPx > iosSafariVisualProfile.maxLandscapePlayerCenterErrorPx) {
    throw new Error(
      `${metrics.state} 실제 Safari 캐릭터 중심 오차 ${metrics.playerCenter.errorPx}px`
      + ` > ${iosSafariVisualProfile.maxLandscapePlayerCenterErrorPx}px`
    );
  }
}

async function captureLandscapeInteriorCenterProbe() {
  await evaluate(`
    localStorage.setItem("wedding-game:world-session:v1", JSON.stringify({
      version: 1,
      zoneId: "neighborhood",
      position: { x: 585, y: 375 },
      direction: "down",
      guideCheckpointId: null,
      updatedAt: new Date().toISOString()
    }));
    return true;
  `);
  await sessionCommand("POST", "/url", { url });
  await waitForDocument("document.querySelector('.entry-screen__resume-access')", "가로 중심 감사 이어하기", 60_000);
  await evaluate(`document.querySelector(".entry-screen__resume-access")?.click(); return true;`);
  await waitForDocument(stableGameFrameExpression, "가로 중심 감사 게임 프레임", 60_000);
  await waitForDocument(
    "document.querySelector('.world-map__stage')?.dataset.zone === 'neighborhood'",
    "가로 중심 감사 넓은 맵",
    30_000
  );
  await waitForDocument("document.fonts.status === 'loaded'", "가로 중심 감사 한글 폰트", 30_000);
  await applyBaselineFreeze();
  await new Promise((resolve) => setTimeout(resolve, 800));
  const metrics = await captureLandscapeMetrics("game-landscape-interior-center-probe");
  await screenshot("game-landscape-interior-center-probe");
  if (metrics.viewport.width <= metrics.viewport.height) {
    throw new Error("실제 Safari 가로 내부 이동 후 가로 회전 상태를 유지하지 못했어요");
  }
  if (!metrics.playerCenter) {
    throw new Error("실제 Safari 가로 내부 이동 후 캐릭터 중심 측정이 누락됐어요");
  }
  if (!metrics.playerCenter.centerable.x || !metrics.playerCenter.centerable.y) {
    throw new Error(
      "실제 Safari 가로 내부 이동 후 X·Y 카메라 중심 가능 상태를 만들지 못했어요: "
      + JSON.stringify(metrics.playerCenter.centerable)
    );
  }
  if (metrics.playerCenter.errorPx > iosSafariVisualProfile.maxLandscapePlayerCenterErrorPx) {
    throw new Error(
      `실제 Safari 가로 내부 이동 후 캐릭터 중심 오차 ${metrics.playerCenter.errorPx}px`
      + ` > ${iosSafariVisualProfile.maxLandscapePlayerCenterErrorPx}px`
    );
  }
  return metrics;
}

startCapturePhase("session-setup");
try {
  await waitForAppium();
  safariCapabilities = {
    platformName: "iOS",
    browserName: "Safari",
    "appium:automationName": "XCUITest",
    "appium:deviceName": deviceName,
    "appium:platformVersion": platformVersion,
    "appium:udid": deviceUdid,
    "appium:noReset": true,
    "appium:newCommandTimeout": 300,
    "appium:wdaLaunchTimeout": 600000,
    "appium:wdaConnectionTimeout": 600000,
    "appium:webviewConnectTimeout": 120000,
    "appium:webviewConnectRetries": 120,
    "appium:showXcodeLog": true,
    "appium:useNewWDA": false,
    ...(deviceKind === "simulator" ? {
      "appium:simulatorStartupTimeout": 600000,
      "appium:simulatorStartupRetries": 2,
      ...(prebuiltWdaPath ? {
        "appium:usePreinstalledWDA": true,
        "appium:prebuiltWDAPath": prebuiltWdaPath
      } : {})
    } : {}),
    ...(process.env.IOS_XCODE_ORG_ID ? { "appium:xcodeOrgId": process.env.IOS_XCODE_ORG_ID } : {}),
    ...(process.env.IOS_XCODE_SIGNING_ID ? { "appium:xcodeSigningId": process.env.IOS_XCODE_SIGNING_ID } : {}),
    ...(process.env.IOS_UPDATED_WDA_BUNDLE_ID ? { "appium:updatedWDABundleId": process.env.IOS_UPDATED_WDA_BUNDLE_ID } : {})
  };
  await createSafariSession();
  await sessionCommand("POST", "/url", { url });
  await restoreGameView();
  startCapturePhase("portrait-game");
  const environment = await evaluate(`
    return {
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      player: (() => {
        const player = document.querySelector(".world-player:not(.player--remote)");
        if (!(player instanceof HTMLElement)) return null;
        const rect = player.getBoundingClientRect();
        const layers = [...player.querySelectorAll(".character-layer")];
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          layerCount: layers.length,
          backgrounds: layers.map((layer) => getComputedStyle(layer).backgroundImage),
          preloads: [...player.querySelectorAll(".character-layer__preload")].map((image) => ({
            complete: image.complete,
            naturalWidth: image.naturalWidth,
            src: image.currentSrc || image.src
          }))
        };
      })()
    };
  `);
  captureReport.userAgent = environment.userAgent;
  captureReport.viewport = environment.viewport;
  captureReport.player = environment.player;
  const stabilizedGameFrame = await stabilizeGameFrameCapture();
  captureReport.nativeCompositor = stabilizedGameFrame.evidence;
  if (captureReport.nativeCompositor.faultInjection?.recovered === false) {
    throw new Error(
      `iOS Safari compositor fault injection 불완전: ${captureReport.nativeCompositor.faultInjection.error ?? "requested recovery missing"}`
    );
  }
  await screenshot("game", stabilizedGameFrame.frame);

  startCapturePhase("directions-200");
  await evaluate(`
    const style = document.createElement("style");
    style.id = "ios-text-200-audit";
    style.textContent = ${JSON.stringify(iosSafariText200AuditCss)};
    document.head.append(style);
    document.documentElement.dataset.textScale = "ios-200";
    document.querySelector(".world-menu-button")?.click();
    return true;
  `);
  await waitForDocument("document.querySelector('.world-menu-sheet')", "월드 메뉴");
  await evaluate(`
    [...document.querySelectorAll(".world-menu-sheet button")]
      .find((button) => button.textContent?.trim() === "오시는 길")?.click();
    return true;
  `);
  await waitForDocument(`
    (() => {
      const sheet = document.querySelector(".bottom-sheet");
      if (!(sheet instanceof HTMLElement)) return false;
      const style = getComputedStyle(sheet);
      return style.display !== "none" && style.visibility !== "hidden" && sheet.getBoundingClientRect().height > 0;
    })()
  `, "오시는 길 바텀시트");
  await waitForDocument("document.fonts.status === 'loaded'", "오시는 길 한글 폰트");
  await new Promise((resolve) => setTimeout(resolve, 500));

  for (const [state, ratio] of [
    ["directions-text-200", 0],
    ["directions-text-200-middle", 0.5],
    ["directions-text-200-bottom", 1]
  ]) {
    const scroll = await evaluate(`
      const sheet = document.querySelector(".bottom-sheet");
      if (!(sheet instanceof HTMLElement)) throw new Error("Directions sheet missing");
      const maxScroll = Math.max(0, sheet.scrollHeight - sheet.clientHeight);
      const target = Math.round(maxScroll * ${ratio});
      sheet.scrollTop = target;
      return {
        scrollTop: sheet.scrollTop,
        maxScroll,
        target,
        reached: Math.abs(sheet.scrollTop - target) <= 2
      };
    `);
    captureReport.scrollStates[state] = scroll;
    if (!scroll.reached) throw new Error(`${state} 실제 Safari 스크롤 위치 도달 실패`);
    if (scroll.maxScroll < iosSafariVisualProfile.requiredDirectionsScroll) {
      throw new Error(`${state} 실제 Safari 200% 스크롤 범위 부족: ${scroll.maxScroll}px`);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    await screenshot(state);
  }

  await evaluate(`
    document.querySelector(".bottom-sheet__header button")?.click();
    document.getElementById("ios-text-200-audit")?.remove();
    delete document.documentElement.dataset.textScale;
    return true;
  `);
  await waitForDocument("!document.querySelector('.bottom-sheet')", "오시는 길 닫힘");
  await evaluate(`
    document.querySelector('.world-menu-sheet button[aria-label="초대장 메뉴 닫기"]')?.click();
    return true;
  `);
  await waitForDocument("!document.querySelector('.world-menu-sheet')", "초대장 메뉴 닫힘");
  await waitForDocument("!document.querySelector('[role=\"dialog\"]')", "맵 대화상자 정리");
  startCapturePhase("landscape");
  await sessionCommand("POST", "/orientation", { orientation: "LANDSCAPE" });
  await waitForDocument("innerWidth > innerHeight", "Safari 가로 회전", 30_000);
  await new Promise((resolve) => setTimeout(resolve, 800));
  await evaluate(`
    document.querySelector(".world-hud__tools-toggle")?.click();
    return true;
  `);
  await waitForDocument(`
    (() => {
      const panel = document.querySelector(".world-hud[data-tools-open] .world-hud__tools");
      if (!(panel instanceof HTMLElement)) return false;
      const style = getComputedStyle(panel);
      const rect = panel.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    })()
  `, "가로 펼친 안내 패널");
  captureReport.landscape.toolsExpanded = await captureLandscapeMetrics("game-landscape-tools-expanded");
  await screenshot("game-landscape-tools-expanded");
  assertLandscapeMetrics(captureReport.landscape.toolsExpanded, { requireHudTools: true });
  await evaluate(`
    document.querySelector(".world-hud__tools-toggle")?.click();
    return true;
  `);
  await waitForDocument(
    "!document.querySelector('.world-hud[data-tools-open] .world-hud__tools')",
    "가로 안내 패널 닫힘"
  );
  captureReport.landscape.expanded = await captureLandscapeMetrics("game-landscape-chrome-expanded");
  await screenshot("game-landscape-chrome-expanded");
  assertLandscapeMetrics(captureReport.landscape.expanded);

  await startLandscapeViewportTrace();
  captureReport.landscape.collapseSetup = await evaluate(`
    document.documentElement.dataset.iosChromeCollapseAudit = "true";
    document.documentElement.style.overflowY = "auto";
    document.body.style.overflowY = "auto";
    const playingShell = document.querySelector(".app-shell--playing");
    if (!(playingShell instanceof HTMLElement)) throw new Error("플레이 중인 앱 셸을 찾을 수 없어요");
    playingShell.style.position = "fixed";
    playingShell.style.inset = "0";
    playingShell.style.width = "100%";
    playingShell.style.height = "100dvh";
    const spacer = document.createElement("div");
    spacer.id = "ios-chrome-collapse-spacer";
    spacer.style.cssText = "position:relative;width:1px;height:320px;margin-top:100vh;pointer-events:none";
    document.body.append(spacer);
    window.scrollTo(0, ${deviceKind === "physical" ? "0" : "document.documentElement.scrollHeight"});
    return {
      scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      shellPosition: getComputedStyle(playingShell).position
    };
  `);
  if (deviceKind === "physical") {
    await evaluate(`
      const playingShell = document.querySelector(".app-shell--playing");
      if (playingShell instanceof HTMLElement) playingShell.style.pointerEvents = "none";
      return true;
    `);
    await performTouchSwipe({
      x: Math.round(captureReport.landscape.expanded.viewport.width * 0.72),
      fromY: Math.round(captureReport.landscape.expanded.viewport.height * 0.78),
      toY: Math.round(captureReport.landscape.expanded.viewport.height * 0.22)
    });
    await evaluate(`
      const playingShell = document.querySelector(".app-shell--playing");
      if (playingShell instanceof HTMLElement) playingShell.style.pointerEvents = "";
      return true;
    `);
  }
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const viewportTrace = await stopLandscapeViewportTrace();
  captureReport.landscape.viewportTrace = viewportTrace.events;
  captureReport.landscape.frameTimings = summarizeFrameTimings(viewportTrace.frameDeltas);
  captureReport.landscape.collapsed = await captureLandscapeMetrics("game-landscape-chrome-collapsed");
  captureReport.landscape.chromeViewportDelta =
    captureReport.landscape.collapsed.viewport.visualHeight
    - captureReport.landscape.expanded.viewport.visualHeight;
  await screenshot("game-landscape-chrome-collapsed");
  assertLandscapeMetrics(captureReport.landscape.collapsed);
  const frameTimingIssues = assessFrameTimingHeadroom(captureReport.landscape.frameTimings);
  if (frameTimingIssues.length > 0) {
    throw new Error(`실제 Safari 동적 크롬 프레임 지연: ${frameTimingIssues.join(", ")}`);
  }
  if (
    deviceKind === "physical"
    && captureReport.landscape.chromeViewportDelta < 12
    && !captureReport.landscape.viewportTrace.some(({ source }) => source === "visualViewport.resize")
  ) {
    throw new Error("실제 iPhone Safari 주소창 제스처에서 visualViewport 변화가 감지되지 않았어요");
  }

  captureReport.landscape.interiorCenterProbe = await captureLandscapeInteriorCenterProbe();

  if (pwaUrl) {
    startCapturePhase("pwa-offline");
    await sessionCommand("POST", "/orientation", { orientation: "PORTRAIT" });
    await waitForDocument("innerHeight > innerWidth", "Safari 세로 복귀", 30_000);
    const serviceWorkerSource = await readFile(path.join(rootDir, "client/dist/service-worker.js"), "utf8");
    captureReport.pwaOffline = (await runDevicePwaOfflineAudit({
      platform: "iOS Safari",
      url: pwaUrl,
      previewHostUrl,
      previewPid: Number(process.env.PWA_PREVIEW_PID),
      expectedPaths: parsePwaPrecachePaths(serviceWorkerSource),
      navigate: (targetUrl) => sessionCommand("POST", "/url", { url: targetUrl }),
      evaluate,
      waitForDocument,
      screenshot
    })).snapshot;
  }

  startCapturePhase("baseline-comparison");
  const baselineStates = Object.fromEntries(await Promise.all(iosSafariVisualStates.map(async (state) => [
    state,
    await access(iosSafariBaselinePath(rootDir, state)).then(() => true, () => false)
  ])));
  const missingStates = iosSafariVisualStates.filter((state) => !baselineStates[state]);
  if (mode === "compare" && missingStates.length > 0) {
    throw new Error(`실제 iOS Safari 기준선 누락: ${missingStates.join(", ")}`);
  }
  if (mode !== "capture") {
    for (const state of iosSafariVisualStates.filter((candidate) => baselineStates[candidate])) {
      const comparison = await compareIosSafariVisualBaseline({ rootDir, outputDir, state });
      captureReport.comparisons.push({ state, ...comparison });
      if (!comparison.passed) {
        throw new Error(`${state} 실제 iOS Safari 픽셀 변경률 ${(comparison.changedRatio * 100).toFixed(3)}%`);
      }
    }
  }
  captureOutcome = "completed";
} finally {
  finishCapturePhase(captureOutcome);
  captureReport.slowestPhase = identifySlowestCapturePhase();
  if (sessionId) await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
  await writeFile(path.join(outputDir, "ios-safari-capture-report.json"), `${JSON.stringify(captureReport, null, 2)}\n`);
}

console.log(
  `실제 iOS ${deviceKind === "physical" ? "iPhone" : "Simulator"} Safari 캡처 완료: ${iosSafariVisualStates.length}개 화면`
  + ` · 200% 스크롤 ${captureReport.scrollStates["directions-text-200-bottom"]?.maxScroll ?? 0}px`
  + ` · p95/p99 ${captureReport.landscape.frameTimings?.p95FrameMs ?? 0}/${captureReport.landscape.frameTimings?.p99FrameMs ?? 0}ms`
  + `${captureReport.pwaOffline ? ` · 오프라인 PWA ${captureReport.pwaOffline.cachedPaths}/${captureReport.pwaOffline.expectedPaths}` : ""}`
);

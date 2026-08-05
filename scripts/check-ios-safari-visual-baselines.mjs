import { access, mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareIosSafariVisualBaseline,
  iosSafariBaselinePath,
  iosSafariCurrentPath,
  iosSafariVisualProfile,
  iosSafariVisualStates
} from "./lib/iosSafariVisualBaseline.mjs";
import { iosSafariText200AuditCss } from "./lib/mobileHudBrowserAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const url = option("--url", "http://127.0.0.1:4178/");
const outputDir = option("--output-dir", path.join(rootDir, ".superpowers/visual-regression/ios-safari"));
const mode = option("--mode", "auto");
const appiumUrl = option("--appium-url", "http://127.0.0.1:4723/wd/hub");
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

async function screenshot(state) {
  const encoded = await sessionCommand("GET", "/screenshot");
  await writeFile(iosSafariCurrentPath(outputDir, state), Buffer.from(encoded, "base64"));
}

const captureReport = {
  generatedAt: new Date().toISOString(),
  profile: iosSafariVisualProfile,
  url,
  automation: "Appium XCUITest WebDriver",
  simulatorUdid: process.env.IOS_SIMULATOR_UDID ?? null,
  userAgent: null,
  viewport: null,
  scrollStates: {},
  landscape: {},
  comparisons: []
};

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
      ".world-hud",
      ".world-minimap",
      ".world-control-dock",
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
    const left = viewport.offsetLeft + safeArea.left;
    const top = viewport.offsetTop + safeArea.top;
    const right = viewport.offsetLeft + viewport.visualWidth - safeArea.right;
    const bottom = viewport.offsetTop + viewport.visualHeight - safeArea.bottom;
    return {
      state: ${JSON.stringify(state)},
      orientation: screen.orientation?.type ?? null,
      viewport,
      safeArea,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      controls,
      controlsContained: controls.every(({ rect }) => (
        rect.x >= left - 2
        && rect.y >= top - 2
        && rect.x + rect.width <= right + 2
        && rect.y + rect.height <= bottom + 2
      ))
    };
  `);
  if (metrics.viewport.width <= metrics.viewport.height) {
    throw new Error(`${state} 실제 Safari 가로 회전 실패`);
  }
  if (metrics.horizontalOverflow) throw new Error(`${state} 실제 Safari 가로 넘침`);
  if (!metrics.controlsContained) throw new Error(`${state} 실제 Safari safe-area 이탈`);
  return metrics;
}

try {
  await waitForAppium();
  const session = await webdriver("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        platformName: "iOS",
        browserName: "Safari",
        "appium:automationName": "XCUITest",
        "appium:deviceName": iosSafariVisualProfile.deviceName,
        "appium:platformVersion": "18.5",
        "appium:udid": process.env.IOS_SIMULATOR_UDID,
        "appium:noReset": true,
        "appium:newCommandTimeout": 300,
        "appium:simulatorStartupTimeout": 600000,
        "appium:simulatorStartupRetries": 2,
        "appium:wdaLaunchTimeout": 600000,
        "appium:wdaConnectionTimeout": 600000,
        "appium:showXcodeLog": true
      }
    }
  });
  sessionId = session.sessionId;
  await sessionCommand("POST", "/url", { url });
  await waitForDocument("document.readyState === 'complete'", "초기 Safari 문서");
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
  await waitForDocument("document.querySelector('.entry-screen__resume-access')", "이어하기 버튼");
  await evaluate(`document.querySelector(".entry-screen__resume-access")?.click(); return true;`);
  await waitForDocument("document.querySelector('.game-world')", "게임 화면");
  await waitForDocument("document.querySelector('.world-map__stage--background-loaded')", "홈 맵 배경", 60_000);
  await waitForDocument(`
    (() => {
      const layer = document.querySelector(".world-player:not(.player--remote) .character-layer");
      if (!(layer instanceof HTMLElement)) return false;
      const rect = layer.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(layer).backgroundImage !== "none";
    })()
  `, "플레이어 캐릭터 레이어", 60_000);
  await waitForDocument("document.fonts.status === 'loaded'", "한글 폰트");
  const environment = await evaluate(`
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
  await new Promise((resolve) => setTimeout(resolve, 500));
  await screenshot("game");

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
  await sessionCommand("POST", "/orientation", { orientation: "LANDSCAPE" });
  await waitForDocument("innerWidth > innerHeight", "Safari 가로 회전", 30_000);
  await new Promise((resolve) => setTimeout(resolve, 800));
  captureReport.landscape.expanded = await captureLandscapeMetrics("game-landscape-chrome-expanded");
  await screenshot("game-landscape-chrome-expanded");

  await evaluate(`
    document.documentElement.dataset.iosChromeCollapseAudit = "true";
    document.documentElement.style.overflowY = "auto";
    document.body.style.overflowY = "auto";
    const spacer = document.createElement("div");
    spacer.id = "ios-chrome-collapse-spacer";
    spacer.style.cssText = "position:relative;width:1px;height:320px;margin-top:100vh;pointer-events:none";
    document.body.append(spacer);
    window.scrollTo(0, document.documentElement.scrollHeight);
    return { scrollY, scrollHeight: document.documentElement.scrollHeight };
  `);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  captureReport.landscape.collapsed = await captureLandscapeMetrics("game-landscape-chrome-collapsed");
  captureReport.landscape.chromeViewportDelta =
    captureReport.landscape.collapsed.viewport.visualHeight
    - captureReport.landscape.expanded.viewport.visualHeight;
  await screenshot("game-landscape-chrome-collapsed");

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
} finally {
  if (sessionId) await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
  await writeFile(path.join(outputDir, "ios-safari-capture-report.json"), `${JSON.stringify(captureReport, null, 2)}\n`);
}

console.log(
  `실제 iOS Simulator Safari 캡처 완료: ${iosSafariVisualStates.length}개 화면`
  + ` · 200% 스크롤 ${captureReport.scrollStates["directions-text-200-bottom"]?.maxScroll ?? 0}px`
);

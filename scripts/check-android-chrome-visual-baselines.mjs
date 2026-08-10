import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  androidChromeBaselinePath,
  androidChromeCurrentPath,
  androidChromeVisualProfile,
  androidChromeVisualStates,
  compareAndroidChromeVisualBaseline
} from "./lib/androidChromeVisualBaseline.mjs";
import { runDevicePwaOfflineAudit } from "./lib/devicePwaOfflineAudit.mjs";
import { parsePwaPrecachePaths } from "./lib/gameResourceBudget.mjs";
import { navigateAndroidChromeWithRetry } from "./lib/androidDeviceReadiness.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const url = option("--url", "http://127.0.0.1:4179/");
const outputDir = option("--output-dir", path.join(rootDir, ".superpowers/visual-regression/android-chrome"));
const mode = option("--mode", "auto");
const appiumUrl = option("--appium-url", "http://127.0.0.1:4725/wd/hub");
const pwaUrl = option("--pwa-url");
const previewHostUrl = option("--preview-host-url", "http://127.0.0.1:4188/");
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
  if (!sessionId) throw new Error("Android Chrome WebDriver 세션이 없습니다.");
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
  await writeFile(androidChromeCurrentPath(outputDir, state), Buffer.from(encoded, "base64"));
}

const captureReport = {
  generatedAt: new Date().toISOString(),
  profile: androidChromeVisualProfile,
  url,
  automation: "Appium UiAutomator2 WebDriver",
  emulatorSerial: process.env.ANDROID_EMULATOR_SERIAL ?? null,
  userAgent: null,
  viewport: null,
  browserVersion: null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT) || null,
  sha: process.env.GITHUB_SHA ?? null,
  runUrl: process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null,
  networkReadiness: {},
  pwaOffline: null,
  scrollStates: {},
  comparisons: []
};

try {
  await waitForAppium();
  const session = await webdriver("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        platformName: "Android",
        browserName: "Chrome",
        "appium:automationName": "UiAutomator2",
        "appium:deviceName": androidChromeVisualProfile.deviceName,
        "appium:udid": process.env.ANDROID_EMULATOR_SERIAL,
        "appium:noReset": false,
        "appium:newCommandTimeout": 300,
        "appium:autoGrantPermissions": true,
        "goog:chromeOptions": {
          args: ["--disable-fre", "--no-default-browser-check", "--disable-translate"]
        }
      }
    }
  });
  sessionId = session.sessionId;
  captureReport.browserVersion = session.capabilities?.browserVersion ?? null;
  try {
    captureReport.networkReadiness.initial = await navigateAndroidChromeWithRetry({
      targetUrl: url,
      navigate: (targetUrl) => sessionCommand("POST", "/url", { url: targetUrl }),
      verify: () => waitForDocument("document.readyState === 'complete'", "초기 Chrome 문서", 15_000)
    });
  } catch (error) {
    captureReport.networkReadiness.initial = { targetUrl: url, outcome: "failed", attempts: error.navigationAttempts ?? [] };
    throw error;
  }
  await evaluate(`
    localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
      version: 1,
      nickname: "Android Chrome 감사",
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
  try {
    captureReport.networkReadiness.seededSession = await navigateAndroidChromeWithRetry({
      targetUrl: url,
      navigate: (targetUrl) => sessionCommand("POST", "/url", { url: targetUrl }),
      verify: () => waitForDocument("document.querySelector('.entry-screen__resume-access')", "이어하기 버튼", 15_000)
    });
  } catch (error) {
    captureReport.networkReadiness.seededSession = { targetUrl: url, outcome: "failed", attempts: error.navigationAttempts ?? [] };
    throw error;
  }
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
    style.id = "android-chrome-baseline-freeze";
    style.textContent = \`
      html.android-chrome-baseline-freeze *,
      html.android-chrome-baseline-freeze *::before,
      html.android-chrome-baseline-freeze *::after {
        animation: none !important;
        caret-color: transparent !important;
        transition: none !important;
      }
      html.android-chrome-baseline-freeze .world-travel-status-row,
      html.android-chrome-baseline-freeze .world-route-arrival-card { display: none !important; }
    \`;
    document.head.append(style);
    document.documentElement.classList.add("android-chrome-baseline-freeze");
    const player = document.querySelector(".world-player:not(.player--remote)");
    const playerRect = player?.getBoundingClientRect();
    return {
      userAgent: navigator.userAgent,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        visualWidth: visualViewport?.width ?? innerWidth,
        visualHeight: visualViewport?.height ?? innerHeight,
        dpr: devicePixelRatio
      },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      player: playerRect ? {
        x: playerRect.x,
        y: playerRect.y,
        width: playerRect.width,
        height: playerRect.height
      } : null
    };
  `);
  captureReport.userAgent = environment.userAgent;
  captureReport.viewport = environment.viewport;
  captureReport.player = environment.player;
  if (environment.horizontalOverflow) throw new Error("실제 Android Chrome 게임 화면 가로 넘침");
  await new Promise((resolve) => setTimeout(resolve, 500));
  await screenshot("game");

  await evaluate(`document.querySelector(".world-menu-button")?.click(); return true;`);
  await waitForDocument("document.querySelector('.world-menu-sheet')", "월드 메뉴");
  await evaluate(`
    [...document.querySelectorAll(".world-menu-sheet button")]
      .find((button) => button.textContent?.trim() === "오시는 길")?.click();
    return true;
  `);
  await waitForDocument(`
    (() => {
      const sheet = document.querySelector(".bottom-sheet");
      return sheet instanceof HTMLElement && sheet.getBoundingClientRect().height > 0;
    })()
  `, "오시는 길 바텀시트");
  await waitForDocument("document.fonts.status === 'loaded'", "오시는 길 한글 폰트");
  await new Promise((resolve) => setTimeout(resolve, 500));

  for (const [state, ratio] of [["directions", 0]]) {
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
        reached: Math.abs(sheet.scrollTop - target) <= 2,
        horizontalOverflow: sheet.scrollWidth > sheet.clientWidth + 1
      };
    `);
    captureReport.scrollStates[state] = scroll;
    if (!scroll.reached) throw new Error(`${state} 실제 Chrome 스크롤 위치 도달 실패`);
    if (scroll.horizontalOverflow) throw new Error(`${state} 실제 Chrome 바텀시트 가로 넘침`);
    if (scroll.maxScroll < androidChromeVisualProfile.requiredDirectionsScroll) {
      throw new Error(`${state} 실제 Chrome 스크롤 범위 부족: ${scroll.maxScroll}px`);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    await screenshot(state);
  }

  if (pwaUrl) {
    const serviceWorkerSource = await readFile(path.join(rootDir, "client/dist/service-worker.js"), "utf8");
    captureReport.pwaOffline = (await runDevicePwaOfflineAudit({
      platform: "Android Chrome",
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

  const baselineStates = Object.fromEntries(await Promise.all(androidChromeVisualStates.map(async (state) => [
    state,
    await access(androidChromeBaselinePath(rootDir, state)).then(() => true, () => false)
  ])));
  const missingStates = androidChromeVisualStates.filter((state) => !baselineStates[state]);
  if (mode === "compare" && missingStates.length > 0) {
    throw new Error(`실제 Android Chrome 기준선 누락: ${missingStates.join(", ")}`);
  }
  if (mode !== "capture") {
    for (const state of androidChromeVisualStates.filter((candidate) => baselineStates[candidate])) {
      const comparison = await compareAndroidChromeVisualBaseline({ rootDir, outputDir, state });
      captureReport.comparisons.push({ state, ...comparison });
      if (!comparison.passed) {
        throw new Error(`${state} 실제 Android Chrome 픽셀 변경률 ${(comparison.changedRatio * 100).toFixed(3)}%`);
      }
    }
  }
} finally {
  if (sessionId) await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
  await writeFile(
    path.join(outputDir, "android-chrome-capture-report.json"),
    `${JSON.stringify(captureReport, null, 2)}\n`
  );
}

console.log(
  `실제 Android Emulator Chrome 캡처 완료: ${androidChromeVisualStates.length}개 화면`
  + ` · 오시는 길 스크롤 ${captureReport.scrollStates.directions?.maxScroll ?? 0}px`
  + `${captureReport.pwaOffline ? ` · 오프라인 PWA ${captureReport.pwaOffline.cachedPaths}/${captureReport.pwaOffline.expectedPaths}` : ""}`
);

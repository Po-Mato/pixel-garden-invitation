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
import { iosText200AuditCss } from "./lib/mobileHudBrowserAudit.mjs";

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
  comparisons: []
};

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
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }
    };
  `);
  captureReport.userAgent = environment.userAgent;
  captureReport.viewport = environment.viewport;
  await screenshot("game");

  await evaluate(`
    const style = document.createElement("style");
    style.id = "ios-text-200-audit";
    style.textContent = ${JSON.stringify(iosText200AuditCss)};
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
  await waitForDocument("document.querySelector('.bottom-sheet')", "오시는 길 바텀시트");

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
    await screenshot(state);
  }

  const baselineReady = await access(iosSafariBaselinePath(rootDir, "game")).then(() => true, () => false);
  if (mode === "compare" && !baselineReady) throw new Error("실제 iOS Safari 기준선이 없습니다.");
  if (mode !== "capture" && baselineReady) {
    for (const state of iosSafariVisualStates) {
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

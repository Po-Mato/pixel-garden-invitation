import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  compareIosSafariVisualBaseline,
  iosSafariBaselinePath,
  iosSafariCurrentPath,
  iosSafariVisualProfile,
  iosSafariVisualStates
} from "./lib/iosSafariVisualBaseline.mjs";
import { iosText200AuditCss } from "./lib/mobileHudBrowserAudit.mjs";

const execFileAsync = promisify(execFile);
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const url = option("--url", "http://127.0.0.1:4178/");
const outputDir = option("--output-dir", path.join(rootDir, ".superpowers/visual-regression/ios-safari"));
const mode = option("--mode", "auto");
await mkdir(outputDir, { recursive: true });

const browserEnvironment = {
  ...process.env,
  AGENT_BROWSER_PROVIDER: "ios",
  AGENT_BROWSER_IOS_DEVICE: iosSafariVisualProfile.deviceName,
  AGENT_BROWSER_SESSION: "wedding-ios-safari-baseline"
};

async function browser(args, { json = false } = {}) {
  const commandArgs = json ? ["--json", ...args] : args;
  const { stdout } = await execFileAsync("agent-browser", commandArgs, {
    cwd: rootDir,
    env: browserEnvironment,
    maxBuffer: 8 * 1024 * 1024
  });
  if (!json) return stdout.trim();
  const parsed = JSON.parse(stdout);
  if (!parsed.success) throw new Error(parsed.error ?? `agent-browser ${args.join(" ")} 실패`);
  return parsed.data?.result;
}

async function evaluate(expression) {
  return browser(["eval", "-b", Buffer.from(expression).toString("base64")], { json: true });
}

const setupScript = `
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
  setTimeout(() => location.reload(), 0);
  true;
`;

const captureReport = {
  generatedAt: new Date().toISOString(),
  profile: iosSafariVisualProfile,
  url,
  userAgent: null,
  viewport: null,
  scrollStates: {},
  comparisons: []
};

try {
  await browser(["open", url]);
  await evaluate(setupScript);
  await browser(["wait", "2000"]);
  await evaluate(`document.querySelector(".entry-screen__resume-access")?.click(); true;`);
  await browser(["wait", ".game-world"]);
  await browser(["wait", ".world-map__stage--background-loaded"]);
  await evaluate(`
    (() => {
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
      return document.fonts.ready.then(() => ({
        userAgent: navigator.userAgent,
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }
      }));
    })()
  `).then((environment) => {
    captureReport.userAgent = environment.userAgent;
    captureReport.viewport = environment.viewport;
  });
  await browser(["screenshot", iosSafariCurrentPath(outputDir, "game")]);

  await evaluate(`
    (() => {
      const style = document.createElement("style");
      style.id = "ios-text-200-audit";
      style.textContent = ${JSON.stringify(iosText200AuditCss)};
      document.head.append(style);
      document.documentElement.dataset.textScale = "ios-200";
      document.querySelector(".world-menu-button")?.click();
      return true;
    })()
  `);
  await browser(["wait", ".world-menu-sheet"]);
  await evaluate(`
    [...document.querySelectorAll(".world-menu-sheet button")]
      .find((button) => button.textContent?.trim() === "오시는 길")?.click();
    true;
  `);
  await browser(["wait", ".bottom-sheet"]);

  for (const [state, ratio] of [
    ["directions-text-200", 0],
    ["directions-text-200-middle", 0.5],
    ["directions-text-200-bottom", 1]
  ]) {
    const scroll = await evaluate(`
      (() => {
        const sheet = document.querySelector(".bottom-sheet");
        if (!(sheet instanceof HTMLElement)) throw new Error("Directions sheet missing");
        const maxScroll = Math.max(0, sheet.scrollHeight - sheet.clientHeight);
        const target = Math.round(maxScroll * ${ratio});
        sheet.scrollTop = target;
        return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve({
          scrollTop: sheet.scrollTop,
          maxScroll,
          target,
          reached: Math.abs(sheet.scrollTop - target) <= 2
        }))));
      })()
    `);
    captureReport.scrollStates[state] = scroll;
    if (!scroll.reached) throw new Error(`${state} 실제 Safari 스크롤 위치 도달 실패`);
    if (scroll.maxScroll < iosSafariVisualProfile.requiredDirectionsScroll) {
      throw new Error(`${state} 실제 Safari 200% 스크롤 범위 부족: ${scroll.maxScroll}px`);
    }
    await browser(["screenshot", iosSafariCurrentPath(outputDir, state)]);
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
  await browser(["close"]).catch(() => undefined);
  await writeFile(path.join(outputDir, "ios-safari-capture-report.json"), `${JSON.stringify(captureReport, null, 2)}\n`);
}

console.log(
  `실제 iOS Simulator Safari 캡처 완료: ${iosSafariVisualStates.length}개 화면`
  + ` · 200% 스크롤 ${captureReport.scrollStates["directions-text-200-bottom"]?.maxScroll ?? 0}px`
);

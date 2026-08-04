import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export const mobileSoakProfiles = Object.freeze([
  { id: "android-chromium", engine: "chromium", device: "Pixel 7" },
  { id: "ios-webkit", engine: "webkit", device: "iPhone 13" }
]);

export function summarizeFrameSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new TypeError("Frame samples must contain at least one value");
  }
  const sorted = samples.map(Number).sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const medianFps = sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
  return { samples: [...samples], medianFps, minimumFps: sorted[0], maximumFps: sorted.at(-1) };
}

export function assessMobileSoakMetrics(metrics) {
  const issues = [];
  if (metrics.pageErrors.length > 0) issues.push(`페이지 오류 ${metrics.pageErrors.length}개`);
  if (metrics.failedRequests.length > 0) issues.push(`요청 실패 ${metrics.failedRequests.length}개`);
  if (!metrics.touchResponded) issues.push("반복 터치 무응답");
  if (!metrics.layoutStable) issues.push("반복 조작 후 HUD 또는 맵 화면 틀어짐");
  if (!metrics.typographyFallbackReady) issues.push("안드로이드 한글 폰트 대체 누락");
  if (!metrics.sheetContained) issues.push("큰 글자 바텀시트 화면 이탈");
  const baselineFps = Number.isFinite(metrics.baselineFps) ? metrics.baselineFps : 60;
  const relativeFps = baselineFps > 0 ? metrics.averageFps / baselineFps : 0;
  if ((baselineFps >= 25 && metrics.averageFps < 25) || (baselineFps < 25 && relativeFps < 0.75)) {
    issues.push(`낮은 프레임 ${metrics.averageFps} FPS (러너 기준 ${baselineFps} FPS)`);
  }
  if (metrics.heapGrowthRatio !== null && metrics.heapGrowthRatio > 0.35) issues.push(`메모리 증가 ${Math.round(metrics.heapGrowthRatio * 100)}%`);
  return issues;
}

async function waitForServer(url, process, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (process.exitCode !== null) throw new Error(`Vite exited before soak audit: ${process.exitCode}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the mobile soak audit server");
}

async function sampleFrames(page, durationMs) {
  return page.evaluate((duration) => new Promise((resolve) => {
    let frames = 0;
    const startedAt = performance.now();
    const tick = (now) => {
      frames += 1;
      if (now - startedAt >= duration) {
        resolve(Math.round(frames / Math.max(1, now - startedAt) * 1000));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), durationMs);
}

async function sampleFrameSeries(page, durationMs, sampleCount = 3) {
  const sampleDurationMs = Math.max(750, Math.floor(durationMs / sampleCount));
  await page.waitForTimeout(250);
  const samples = [];
  for (let index = 0; index < sampleCount; index += 1) {
    samples.push(await sampleFrames(page, sampleDurationMs));
  }
  return summarizeFrameSamples(samples);
}

async function heapUsed(page) {
  return page.evaluate(() => {
    const memory = performance.memory;
    return typeof memory?.usedJSHeapSize === "number" ? memory.usedJSHeapSize : null;
  });
}

export async function runMobileDeviceSoakAudit({ rootDir, outputDir, port = 4179, durationMs = 5_000, interactionCount = 18 }) {
  const server = spawn("pnpm", ["--filter", "@wedding-game/client", "exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: rootDir,
    env: { ...process.env, BROWSER: "none" },
    stdio: "pipe"
  });
  const url = `http://127.0.0.1:${port}/`;
  await mkdir(outputDir, { recursive: true });
  try {
    await waitForServer(url, server);
    const playwright = await import("playwright");
    const reports = [];
    for (const profile of mobileSoakProfiles) {
      const browser = await playwright[profile.engine].launch({ headless: true });
      const context = await browser.newContext({ ...playwright.devices[profile.device] });
      await context.route("http://127.0.0.1:8787/**", (route) => route.fulfill({
        status: 404,
        contentType: "application/json",
        body: "{}"
      }));
      const page = await context.newPage();
      const baselineFrames = await sampleFrameSeries(page, durationMs);
      const pageErrors = [];
      const failedRequests = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => {
        const failure = request.failure()?.errorText ?? "unknown";
        if (!failure.includes("ERR_ABORTED") && !failure.includes("cancelled")) failedRequests.push(`${request.url()} ${failure}`);
      });
      await page.addInitScript(() => {
        localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
          version: 1,
          nickname: "장시간감사",
          appearance: { presetId: "feminine-long-wave-dress" },
          updatedAt: new Date().toISOString()
        }));
        localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({ version: 1, completed: true }));
      });
      await page.goto(url, { waitUntil: "networkidle" });
      const resumeGarden = page.locator(".entry-screen__resume-access");
      if (await resumeGarden.isVisible().catch(() => false)) {
        await resumeGarden.click();
      }
      await page.locator(".game-world").waitFor({ state: "visible" });
      await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 15_000 });
      const readStableLayout = () => page.evaluate(() => {
        const read = (selector) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLElement)) return null;
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        };
        return { hud: read(".world-hud"), map: read(".world-map") };
      });
      const layoutBefore = await readStableLayout();
      await page.locator(".world-hud__tools-toggle").tap();
      await page.locator(".world-game-vault > summary").tap();
      await page.getByRole("button", { name: /빠른 도구 편집/ }).tap();
      await page.locator(".game-quick-dock__settings").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "게임 도구 닫기" }).tap();
      const beforeHeap = await heapUsed(page);
      let touchResponded = true;
      for (let index = 0; index < interactionCount; index += 1) {
        const toggle = page.locator(".world-hud__tools-toggle");
        await toggle.tap();
        touchResponded = touchResponded && await toggle.getAttribute("aria-expanded") === "true";
        await toggle.tap();
        touchResponded = touchResponded && await toggle.getAttribute("aria-expanded") === "false";
      }
      const layoutAfter = await readStableLayout();
      const layoutStable = ["hud", "map"].every((name) => {
        const before = layoutBefore[name];
        const after = layoutAfter[name];
        return before && after && ["x", "y", "width", "height"].every((key) => Math.abs(before[key] - after[key]) <= 1);
      });
      await page.evaluate(() => { document.documentElement.dataset.textScale = "xlarge"; });
      await page.locator(".world-menu-button").tap();
      await page.locator(".world-menu-sheet").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "오시는 길", exact: true }).tap();
      const sheet = page.locator(".bottom-sheet");
      await sheet.waitFor({ state: "visible" });
      const invitationMetrics = await page.evaluate(() => {
        const world = document.querySelector(".game-world");
        const heading = document.querySelector(".bottom-sheet__header h2");
        const sheetElement = document.querySelector(".bottom-sheet");
        if (!(world instanceof HTMLElement) || !(heading instanceof HTMLElement) || !(sheetElement instanceof HTMLElement)) {
          return { typographyFallbackReady: false, sheetContained: false };
        }
        const uiFamily = getComputedStyle(world).fontFamily;
        const displayFamily = getComputedStyle(heading).fontFamily;
        const rect = sheetElement.getBoundingClientRect();
        return {
          typographyFallbackReady: /Noto Sans (?:CJK )?KR/.test(uiFamily) && /Noto Serif (?:CJK )?KR/.test(displayFamily),
          sheetContained: rect.x >= -1 && rect.y >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1
            && sheetElement.scrollWidth <= sheetElement.clientWidth + 1
        };
      });
      await page.locator(".bottom-sheet__header button").tap();
      await sheet.waitFor({ state: "hidden" });
      await page.evaluate(() => { delete document.documentElement.dataset.textScale; });
      const applicationFrames = await sampleFrameSeries(page, durationMs);
      const averageFps = applicationFrames.medianFps;
      const baselineFps = baselineFrames.medianFps;
      const afterHeap = await heapUsed(page);
      const heapGrowthRatio = beforeHeap && afterHeap ? Math.max(0, (afterHeap - beforeHeap) / beforeHeap) : null;
      const metrics = {
        pageErrors,
        failedRequests,
        touchResponded,
        layoutStable,
        ...invitationMetrics,
        averageFps,
        baselineFps,
        frameRatio: baselineFps > 0 ? averageFps / baselineFps : null,
        frameSamples: applicationFrames.samples,
        baselineFrameSamples: baselineFrames.samples,
        beforeHeap,
        afterHeap,
        heapGrowthRatio
      };
      const issues = assessMobileSoakMetrics(metrics);
      const screenshotPath = path.join(outputDir, `${profile.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      reports.push({ ...profile, durationMs, interactionCount, metrics, issues, screenshotPath });
      await context.close();
      await browser.close();
    }
    const reportPath = path.join(outputDir, "mobile-device-soak-report.json");
    await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)}\n`);
    const issues = reports.flatMap((report) => report.issues.map((issue) => `${report.id}: ${issue}`));
    if (issues.length) throw new Error(`Mobile device soak audit failed:\n${issues.join("\n")}`);
    return { reports, reportPath };
  } finally {
    server.kill("SIGTERM");
  }
}

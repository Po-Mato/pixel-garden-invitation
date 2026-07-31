import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export const mobileSoakProfiles = Object.freeze([
  { id: "android-chromium", engine: "chromium", device: "Pixel 7" },
  { id: "ios-webkit", engine: "webkit", device: "iPhone 13" }
]);

export function assessMobileSoakMetrics(metrics) {
  const issues = [];
  if (metrics.pageErrors.length > 0) issues.push(`페이지 오류 ${metrics.pageErrors.length}개`);
  if (metrics.failedRequests.length > 0) issues.push(`요청 실패 ${metrics.failedRequests.length}개`);
  if (!metrics.touchResponded) issues.push("반복 터치 무응답");
  if (metrics.averageFps < 25) issues.push(`낮은 프레임 ${metrics.averageFps} FPS`);
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
      const averageFps = await sampleFrames(page, durationMs);
      const afterHeap = await heapUsed(page);
      const heapGrowthRatio = beforeHeap && afterHeap ? Math.max(0, (afterHeap - beforeHeap) / beforeHeap) : null;
      const metrics = { pageErrors, failedRequests, touchResponded, averageFps, beforeHeap, afterHeap, heapGrowthRatio };
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

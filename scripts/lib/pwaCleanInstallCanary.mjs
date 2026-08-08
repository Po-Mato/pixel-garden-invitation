import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { parsePwaPrecachePaths } from "./gameResourceBudget.mjs";

export function auditPwaCleanInstallCanary(snapshot) {
  const issues = [];
  if (!snapshot.serviceWorkerSupported) issues.push("서비스 워커 미지원");
  if (!snapshot.controlled) issues.push("첫 설치 페이지 제어 실패");
  if (!snapshot.precacheName?.startsWith("wedding-garden-precache-")) issues.push("핵심 프리캐시 미생성");
  if (snapshot.cachedPaths !== snapshot.expectedPaths) {
    issues.push(`핵심 프리캐시 누락 ${snapshot.cachedPaths}/${snapshot.expectedPaths}`);
  }
  if (!snapshot.offlineEntryVisible) issues.push("오프라인 재실행 진입 화면 실패");
  if (!snapshot.offlineStatusVisible) issues.push("오프라인 상태 안내 누락");
  if (!snapshot.offlineGameVisible) issues.push("오프라인 저장 여정 재개 실패");
  if (snapshot.blockingNoticeVisible) issues.push("오프라인 재실행 차단 안내 노출");
  if (snapshot.fallbackDocumentVisible) issues.push("오프라인 비상 문서로 강등");
  if (snapshot.criticalAssetFailures.length > 0) {
    issues.push(`오프라인 핵심 화면 자산 누락 ${snapshot.criticalAssetFailures.join(" | ")}`);
  }
  if (snapshot.pageErrors.length > 0) issues.push(`오프라인 재실행 페이지 오류 ${snapshot.pageErrors.join(" | ")}`);
  return issues;
}

export function criticalOfflineAssetFailures(requestFailures, baseUrl) {
  const origin = new URL(baseUrl).origin;
  return [...new Set(requestFailures
    .map(({ url: failedUrl }) => new URL(failedUrl))
    .filter((failedUrl) => failedUrl.origin === origin && !failedUrl.pathname.startsWith("/api/"))
    .map((failedUrl) => failedUrl.pathname))];
}

async function waitForServer(url, server, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited with code ${server.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export async function runPwaCleanInstallCanary({ rootDir, outputDir, port = 4187 }) {
  const distDir = path.join(rootDir, "client/dist");
  await stat(path.join(distDir, "index.html"));
  const serviceWorkerSource = await readFile(path.join(distDir, "service-worker.js"), "utf8");
  const expectedPaths = parsePwaPrecachePaths(serviceWorkerSource);
  await mkdir(outputDir, { recursive: true });
  const server = spawn(
    "pnpm",
    ["--filter", "@wedding-game/client", "exec", "vite", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: rootDir, env: { ...process.env, BROWSER: "none" }, stdio: "pipe" }
  );
  const url = `http://127.0.0.1:${port}/`;

  try {
    await waitForServer(url, server);
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 393, height: 852 },
        hasTouch: true,
        isMobile: true,
        locale: "ko-KR",
        reducedMotion: "reduce",
        serviceWorkers: "allow"
      });
      const page = await context.newPage();
      const pageErrors = [];
      const requestFailures = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => requestFailures.push({
        url: request.url(),
        errorText: request.failure()?.errorText ?? "unknown"
      }));
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.locator(".entry-screen").waitFor({ state: "visible" });

      let onlineCache = null;
      const cacheDeadline = Date.now() + 45_000;
      while (Date.now() < cacheDeadline) {
        onlineCache = await page.evaluate(async (paths) => {
          const registration = "serviceWorker" in navigator
            ? await navigator.serviceWorker.getRegistration()
            : null;
          const names = await caches.keys();
          const precacheName = names.find((name) => name.startsWith("wedding-garden-precache-")) ?? null;
          const cachedUrls = precacheName
            ? new Set((await (await caches.open(precacheName)).keys()).map((request) => request.url))
            : new Set();
          const scope = registration?.scope ?? location.href;
          return {
            serviceWorkerSupported: "serviceWorker" in navigator,
            controlled: Boolean(navigator.serviceWorker.controller),
            precacheName,
            cachedPaths: paths.filter((resourcePath) => cachedUrls.has(new URL(resourcePath, scope).href)).length
          };
        }, expectedPaths);
        if (onlineCache.controlled && onlineCache.cachedPaths === expectedPaths.length) break;
        await page.waitForTimeout(150);
      }
      if (!onlineCache) throw new Error("PWA cache state unavailable");

      await page.evaluate(() => {
        localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
          version: 1,
          nickname: "오프라인감사",
          appearance: { presetId: "feminine-long-wave-dress" },
          updatedAt: new Date().toISOString()
        }));
        localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({
          version: 1,
          completed: true,
          completedAt: new Date().toISOString()
        }));
      });
      const offlineFailureStart = requestFailures.length;
      server.kill("SIGTERM");
      await new Promise((resolve) => {
        if (server.exitCode !== null) resolve();
        else server.once("exit", resolve);
      });
      await page.evaluate(() => location.reload()).catch(() => undefined);
      await page.waitForLoadState("domcontentloaded");
      await context.setOffline(true);
      const offlineEntryVisible = await page.locator(".entry-screen").isVisible();
      const offlineStatusVisible = await page.getByText("오프라인 모드", { exact: true }).isVisible().catch(() => false);
      const resumeGarden = page.locator(".entry-screen__resume-access");
      const resumeVisible = await resumeGarden.isVisible().catch(() => false);
      if (resumeVisible) await resumeGarden.click();
      await page.locator(".game-world").waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
      const offlineGameVisible = await page.locator(".game-world").isVisible();
      if (offlineGameVisible) {
        await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
      }
      const blockingNoticeVisible = await page.locator(".pwa-status--notice, .pwa-status--error").isVisible().catch(() => false);
      const fallbackDocumentVisible = await page.getByText("오프라인 초대장을 준비하지 못했습니다", { exact: false }).isVisible().catch(() => false);
      const criticalAssetFailures = criticalOfflineAssetFailures(
        requestFailures.slice(offlineFailureStart),
        url
      );
      const screenshotPath = path.join(outputDir, "pwa-clean-install-offline.png");
      await page.screenshot({ path: screenshotPath, fullPage: false, scale: "css" });

      const snapshot = {
        ...onlineCache,
        expectedPaths: expectedPaths.length,
        offlineEntryVisible,
        offlineStatusVisible,
        resumeVisible,
        offlineGameVisible,
        blockingNoticeVisible,
        fallbackDocumentVisible,
        criticalAssetFailures,
        pageErrors,
        requestFailures,
        screenshotPath
      };
      const issues = auditPwaCleanInstallCanary(snapshot);
      const reportPath = path.join(outputDir, "pwa-clean-install-canary-report.json");
      await writeFile(reportPath, `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        snapshot,
        issues
      }, null, 2)}\n`);
      await context.close();
      if (issues.length > 0) throw new Error(`PWA clean-install canary failed:\n${issues.join("\n")}`);
      return { snapshot, issues, reportPath };
    } finally {
      await browser.close();
    }
  } finally {
    server.kill("SIGTERM");
  }
}

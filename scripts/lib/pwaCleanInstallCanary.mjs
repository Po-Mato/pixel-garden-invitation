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
  if ("transportProbe" in snapshot && snapshot.transportProbe?.transportBlocked !== true) {
    issues.push("오프라인 실제 전송 차단 실패");
  }
  if (snapshot.criticalAssetFailures.length > 0) {
    issues.push(`오프라인 핵심 화면 자산 누락 ${snapshot.criticalAssetFailures.join(" | ")}`);
  }
  if (snapshot.pageErrors.length > 0) issues.push(`오프라인 재실행 페이지 오류 ${snapshot.pageErrors.join(" | ")}`);
  if ("readinessTimeline" in snapshot) {
    issues.push(...auditPwaReadinessTimeline(snapshot.readinessTimeline ?? []));
  }
  return issues;
}

export const pwaCleanInstallReadinessPhases = Object.freeze([
  "first-navigation",
  "entry-visible",
  "service-worker-ready",
  "precache-ready",
  "session-seeded",
  "offline-enabled",
  "preview-stopped",
  "offline-reload-complete",
  "offline-entry-visible",
  "offline-game-visible"
]);

export function auditPwaReadinessTimeline(timeline) {
  const completed = new Set(timeline.filter(({ outcome }) => outcome === "completed").map(({ phase }) => phase));
  const missing = pwaCleanInstallReadinessPhases.filter((phase) => !completed.has(phase));
  return missing.length > 0 ? [`PWA 준비 단계 증거 누락 ${missing.join(", ")}`] : [];
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
  const startedAt = Date.now();
  const readinessTimeline = [];
  const pageErrors = [];
  const requestFailures = [];
  let browser = null;
  let context = null;
  let page = null;

  const serviceWorkerState = async () => page?.evaluate(async (paths) => {
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
      online: navigator.onLine,
      serviceWorkerSupported: "serviceWorker" in navigator,
      controlled: Boolean(navigator.serviceWorker.controller),
      controller: navigator.serviceWorker.controller ? {
        scriptURL: navigator.serviceWorker.controller.scriptURL,
        state: navigator.serviceWorker.controller.state
      } : null,
      registration: registration ? {
        scope: registration.scope,
        installing: registration.installing?.state ?? null,
        waiting: registration.waiting?.state ?? null,
        active: registration.active?.state ?? null
      } : null,
      cacheNames: names,
      precacheName,
      cachedPaths: paths.filter((resourcePath) => cachedUrls.has(new URL(resourcePath, scope).href)).length
    };
  }, expectedPaths).catch((error) => ({ inspectionError: error.message }));
  const recordPhase = async (phase, outcome = "completed", details = {}) => {
    readinessTimeline.push({
      phase,
      outcome,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      serviceWorker: await serviceWorkerState(),
      ...details
    });
  };
  const stopServer = async () => {
    if (server.exitCode !== null || server.signalCode !== null) return;
    server.kill("SIGTERM");
    if (server.exitCode !== null || server.signalCode !== null) return;
    await new Promise((resolve) => server.once("exit", resolve));
  };

  try {
    await waitForServer(url, server);
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
        viewport: { width: 393, height: 852 },
        hasTouch: true,
        isMobile: true,
        locale: "ko-KR",
        reducedMotion: "reduce",
        serviceWorkers: "allow"
      });
      page = await context.newPage();
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => requestFailures.push({
        url: request.url(),
        errorText: request.failure()?.errorText ?? "unknown"
      }));
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await recordPhase("first-navigation");
      await page.locator(".entry-screen").waitFor({ state: "visible" });
      await recordPhase("entry-visible");

      await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return;
        await navigator.serviceWorker.ready;
      });
      await recordPhase("service-worker-ready");

      let onlineCache = null;
      const cacheDeadline = Date.now() + 45_000;
      while (Date.now() < cacheDeadline) {
        onlineCache = await serviceWorkerState();
        if (onlineCache.controlled && onlineCache.cachedPaths === expectedPaths.length) break;
        await page.waitForTimeout(150);
      }
      if (!onlineCache) throw new Error("PWA cache state unavailable");
      await recordPhase("precache-ready", "completed", {
        cachedPaths: onlineCache.cachedPaths,
        expectedPaths: expectedPaths.length
      });

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
      await recordPhase("session-seeded");
      const offlineFailureStart = requestFailures.length;
      await context.setOffline(true);
      await recordPhase("offline-enabled");
      await stopServer();
      const previewProbeUrl = new URL(`?transport-probe=${Date.now()}`, url).href;
      let previewHostProbe;
      try {
        const response = await fetch(previewProbeUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(5_000)
        });
        previewHostProbe = { reachable: true, status: response.status, error: null };
      } catch (error) {
        previewHostProbe = { reachable: false, status: null, error: error.message };
      }
      await recordPhase("preview-stopped", "completed", { previewHostProbe });
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
      // Chromium can reset navigator.onLine after a service-worker document replacement.
      // Keep that browser signal separate from proof that transport is actually blocked.
      await context.setOffline(true);
      const navigatorOnlineAfterReload = await page.evaluate(() => navigator.onLine);
      const transportProbeUrl = new URL(`/api/__pwa_transport_probe__?nonce=${Date.now()}`, url).href;
      const transportFailureStart = requestFailures.length;
      const browserTransportProbe = await page.evaluate(async (probeUrl) => {
        try {
          const response = await fetch(probeUrl, { cache: "no-store" });
          return { resolved: true, status: response.status, error: null };
        } catch (error) {
          return { resolved: false, status: null, error: error instanceof Error ? error.message : String(error) };
        }
      }, transportProbeUrl);
      const browserNetworkError = requestFailures
        .slice(transportFailureStart)
        .find(({ url: failedUrl }) => failedUrl === transportProbeUrl)?.errorText ?? null;
      const transportProbe = {
        previewUrl: previewProbeUrl,
        previewHostReachableAfterStop: previewHostProbe.reachable,
        previewHostError: previewHostProbe.error,
        browserUrl: transportProbeUrl,
        browserFetchResolved: browserTransportProbe.resolved,
        browserStatus: browserTransportProbe.status,
        browserError: browserTransportProbe.error,
        browserNetworkError,
        transportBlocked: !previewHostProbe.reachable && !browserTransportProbe.resolved
      };
      const offlineEventDispatched = await page.evaluate(() => {
        if (!navigator.onLine) return false;
        dispatchEvent(new Event("offline"));
        return true;
      });
      await recordPhase("offline-reload-complete", "completed", {
        navigatorOnlineAfterReload,
        offlineEventDispatched,
        transportProbe
      });
      await page.locator(".entry-screen").waitFor({ state: "visible", timeout: 20_000 });
      const offlineEntryVisible = await page.locator(".entry-screen").isVisible();
      if (offlineEntryVisible) await recordPhase("offline-entry-visible");
      const offlineStatus = page.getByText("오프라인 모드", { exact: true });
      await offlineStatus.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
      const offlineStatusVisible = await offlineStatus.isVisible().catch(() => false);
      const resumeGarden = page.locator(".entry-screen__resume-access");
      const resumeVisible = await resumeGarden.isVisible().catch(() => false);
      if (resumeVisible) await resumeGarden.click();
      await page.locator(".game-world").waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
      const offlineGameVisible = await page.locator(".game-world").isVisible();
      if (offlineGameVisible) await recordPhase("offline-game-visible");
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
        navigatorOnlineAfterReload,
        offlineEventDispatched,
        transportProbe,
        criticalAssetFailures,
        pageErrors,
        requestFailures,
        screenshotPath,
        readinessTimeline
      };
      const issues = auditPwaCleanInstallCanary(snapshot);
      const reportPath = path.join(outputDir, "pwa-clean-install-canary-report.json");
      await writeFile(reportPath, `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        snapshot,
        issues
      }, null, 2)}\n`);
      if (issues.length > 0) throw new Error(`PWA clean-install canary failed:\n${issues.join("\n")}`);
      return { snapshot, issues, reportPath };
  } catch (error) {
    await recordPhase("failure", "failed", { error: error.message });
    const screenshotPath = path.join(outputDir, "pwa-clean-install-failure.png");
    const htmlPath = path.join(outputDir, "pwa-clean-install-failure.html");
    await page?.screenshot({ path: screenshotPath, fullPage: false, scale: "css" }).catch(() => undefined);
    const html = await page?.content().catch(() => null);
    if (html) await writeFile(htmlPath, html);
    await writeFile(path.join(outputDir, "pwa-clean-install-failure-trace.json"), `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      error: { name: error.name, message: error.message, stack: error.stack },
      url: page?.url() ?? url,
      readinessTimeline,
      pageErrors,
      requestFailures,
      screenshotPath,
      htmlPath: html ? htmlPath : null
    }, null, 2)}\n`);
    throw error;
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    await stopServer();
  }
}

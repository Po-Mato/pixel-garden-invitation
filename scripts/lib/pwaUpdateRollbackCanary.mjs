import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parsePwaPrecachePaths } from "./gameResourceBudget.mjs";

const contentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

export function createServiceWorkerVariant(source, version, extraPrecachePaths = []) {
  const precachePaths = [...new Set([...parsePwaPrecachePaths(source), ...extraPrecachePaths])];
  return source
    .replace(/const VERSION = [^;]+;/, `const VERSION = ${JSON.stringify(version)};`)
    .replace(/const PRECACHE_URLS = \[[^;]*\];/, `const PRECACHE_URLS = ${JSON.stringify(precachePaths)};`);
}

export function auditPwaUpdateRollbackCanary(snapshot) {
  const issues = [];
  if (snapshot.brokenInstallState !== "redundant") issues.push("깨진 업데이트 설치가 거부되지 않음");
  if (!snapshot.previousControllerSurvived) issues.push("깨진 업데이트가 기존 제어권을 손상함");
  if (!snapshot.previousCacheSurvived) issues.push("깨진 업데이트가 기존 프리캐시를 손상함");
  if (snapshot.brokenCachePresent) issues.push("깨진 업데이트의 부분 프리캐시 잔존");
  if (!snapshot.offlineAfterRejectedUpdate) issues.push("업데이트 거부 후 오프라인 재실행 실패");
  if (snapshot.updateInstallState !== "installed") issues.push("정상 업데이트 대기 설치 실패");
  if (!snapshot.updatedControllerActive) issues.push("정상 업데이트 제어권 전환 실패");
  if (!snapshot.updatedCacheComplete) issues.push("정상 업데이트 프리캐시 불완전");
  if (snapshot.previousCacheAfterUpdate) issues.push("정상 업데이트 후 이전 프리캐시 잔존");
  if (snapshot.rollbackInstallState !== "installed") issues.push("롤백 버전 대기 설치 실패");
  if (!snapshot.rollbackControllerActive) issues.push("롤백 버전 제어권 전환 실패");
  if (!snapshot.rollbackCacheComplete) issues.push("롤백 프리캐시 불완전");
  if (snapshot.updatedCacheAfterRollback) issues.push("롤백 후 신규 프리캐시 잔존");
  if (!snapshot.offlineAfterRollback) issues.push("롤백 후 오프라인 재실행 실패");
  if (snapshot.pageErrors.length > 0) issues.push(`페이지 오류 ${snapshot.pageErrors.join(" | ")}`);
  return issues;
}

async function startVariantServer(distDir, initialWorkerSource, port) {
  const state = { workerSource: initialWorkerSource };
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`).pathname;
    if (pathname === "/service-worker.js") {
      response.writeHead(200, {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "text/javascript; charset=utf-8",
        "Service-Worker-Allowed": "/"
      });
      response.end(state.workerSource);
      return;
    }
    if (pathname === "/__canary_missing_core__") {
      response.writeHead(503, { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" });
      response.end("deliberate update canary failure");
      return;
    }

    const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
    const resolvedPath = path.resolve(distDir, relativePath);
    const safePath = resolvedPath.startsWith(`${path.resolve(distDir)}${path.sep}`)
      ? resolvedPath
      : path.join(distDir, "index.html");
    try {
      const body = await readFile(safePath);
      response.writeHead(200, {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": contentTypes[path.extname(safePath)] ?? "application/octet-stream"
      });
      response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    setWorkerSource(workerSource) {
      state.workerSource = workerSource;
    },
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function waitForControllerAndCache(page, cacheName, paths, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let snapshot = null;
  while (Date.now() < deadline) {
    snapshot = await page.evaluate(async ({ cacheName: expectedName, paths: expectedPaths }) => {
      const registration = await navigator.serviceWorker.getRegistration();
      const names = await caches.keys();
      const cache = names.includes(expectedName) ? await caches.open(expectedName) : null;
      const urls = new Set(cache ? (await cache.keys()).map((request) => request.url) : []);
      const scope = registration?.scope ?? location.href;
      return {
        controlled: Boolean(navigator.serviceWorker.controller),
        active: Boolean(registration?.active),
        complete: expectedPaths.every((resourcePath) => urls.has(new URL(resourcePath, scope).href))
      };
    }, { cacheName, paths });
    if (snapshot.controlled && snapshot.active && snapshot.complete) return snapshot;
    await page.waitForTimeout(150);
  }
  return snapshot ?? { controlled: false, active: false, complete: false };
}

async function installUpdate(page, timeoutMs = 45_000) {
  return page.evaluate(async (timeout) => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return "missing";
    return new Promise((resolve) => {
      let worker = registration.installing;
      let settled = false;
      const finish = (state) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        registration.removeEventListener("updatefound", onUpdateFound);
        worker?.removeEventListener("statechange", onStateChange);
        resolve(state);
      };
      const onStateChange = () => {
        if (worker?.state === "installed" || worker?.state === "redundant") finish(worker.state);
      };
      const onUpdateFound = () => {
        worker?.removeEventListener("statechange", onStateChange);
        worker = registration.installing;
        worker?.addEventListener("statechange", onStateChange);
        onStateChange();
      };
      const timer = setTimeout(() => finish(worker?.state ?? "timeout"), timeout);
      registration.addEventListener("updatefound", onUpdateFound);
      void registration.update().then(() => {
        if (!worker && registration.installing) onUpdateFound();
      }).catch(() => finish(worker?.state ?? "update-error"));
    });
  }, timeoutMs);
}

async function activateWaitingWorker(page, timeoutMs = 20_000) {
  return page.evaluate(async (timeout) => {
    const registration = await navigator.serviceWorker.getRegistration();
    const waiting = registration?.waiting;
    if (!waiting) return false;
    const previous = navigator.serviceWorker.controller;
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeout);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        clearTimeout(timer);
        resolve(Boolean(navigator.serviceWorker.controller && navigator.serviceWorker.controller !== previous));
      }, { once: true });
      waiting.postMessage({ type: "SKIP_WAITING" });
    });
  }, timeoutMs);
}

async function cacheState(page, names, paths) {
  return page.evaluate(async ({ names: expectedNames, paths: expectedPaths }) => {
    const registration = await navigator.serviceWorker.getRegistration();
    const scope = registration?.scope ?? location.href;
    const existingNames = await caches.keys();
    const complete = {};
    for (const name of expectedNames) {
      const cache = existingNames.includes(name) ? await caches.open(name) : null;
      const urls = new Set(cache ? (await cache.keys()).map((request) => request.url) : []);
      complete[name] = Boolean(cache) && expectedPaths.every((resourcePath) => urls.has(new URL(resourcePath, scope).href));
    }
    return { names: existingNames, complete, controlled: Boolean(navigator.serviceWorker.controller) };
  }, { names, paths });
}

async function waitForCacheReplacement(page, currentName, obsoleteName, paths, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let snapshot = null;
  while (Date.now() < deadline) {
    snapshot = await cacheState(page, [currentName, obsoleteName], paths);
    if (snapshot.complete[currentName] === true && !snapshot.names.includes(obsoleteName)) return snapshot;
    await page.waitForTimeout(100);
  }
  return snapshot ?? { names: [], complete: {}, controlled: false };
}

async function verifyOfflineEntry(context, page) {
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
    return await page.locator(".entry-screen").isVisible().catch(() => false);
  } finally {
    await context.setOffline(false);
  }
}

export async function runPwaUpdateRollbackCanary({ rootDir, outputDir, port = 4188 }) {
  const distDir = path.join(rootDir, "client/dist");
  await stat(path.join(distDir, "index.html"));
  const builtSource = await readFile(path.join(distDir, "service-worker.js"), "utf8");
  const expectedPaths = parsePwaPrecachePaths(builtSource);
  const versions = {
    previous: "update-canary-v1",
    broken: "update-canary-v2-broken",
    updated: "update-canary-v2",
    rollback: "update-canary-v1-rollback"
  };
  const workers = {
    previous: createServiceWorkerVariant(builtSource, versions.previous),
    broken: createServiceWorkerVariant(builtSource, versions.broken, ["./__canary_missing_core__"]),
    updated: createServiceWorkerVariant(builtSource, versions.updated),
    rollback: createServiceWorkerVariant(builtSource, versions.rollback)
  };
  const cacheNames = Object.fromEntries(Object.entries(versions).map(([key, version]) => [key, `wedding-garden-precache-${version}`]));
  await mkdir(outputDir, { recursive: true });
  const server = await startVariantServer(distDir, workers.previous, port);
  const url = `http://127.0.0.1:${port}/`;

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
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.locator(".entry-screen").waitFor({ state: "visible" });
    const previousReady = await waitForControllerAndCache(page, cacheNames.previous, expectedPaths);
    const previousControllerUrl = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "");

    server.setWorkerSource(workers.broken);
    const brokenInstallState = await installUpdate(page);
    const afterBroken = await cacheState(page, [cacheNames.previous, cacheNames.broken], expectedPaths);
    const currentControllerUrl = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "");
    const offlineAfterRejectedUpdate = await verifyOfflineEntry(context, page);

    server.setWorkerSource(workers.updated);
    const updateInstallState = await installUpdate(page);
    const updatedControllerActive = await activateWaitingWorker(page);
    const afterUpdate = await waitForCacheReplacement(page, cacheNames.updated, cacheNames.previous, expectedPaths);

    server.setWorkerSource(workers.rollback);
    const rollbackInstallState = await installUpdate(page);
    const rollbackControllerActive = await activateWaitingWorker(page);
    const afterRollback = await waitForCacheReplacement(page, cacheNames.rollback, cacheNames.updated, expectedPaths);
    const offlineAfterRollback = await verifyOfflineEntry(context, page);
    const screenshotPath = path.join(outputDir, "pwa-update-rollback-offline.png");
    await page.screenshot({ path: screenshotPath, fullPage: false, scale: "css" });

    const snapshot = {
      brokenInstallState,
      previousControllerSurvived: previousReady.controlled && currentControllerUrl === previousControllerUrl,
      previousCacheSurvived: afterBroken.complete[cacheNames.previous] === true,
      brokenCachePresent: afterBroken.names.includes(cacheNames.broken),
      offlineAfterRejectedUpdate,
      updateInstallState,
      updatedControllerActive,
      updatedCacheComplete: afterUpdate.complete[cacheNames.updated] === true,
      previousCacheAfterUpdate: afterUpdate.names.includes(cacheNames.previous),
      rollbackInstallState,
      rollbackControllerActive,
      rollbackCacheComplete: afterRollback.complete[cacheNames.rollback] === true,
      updatedCacheAfterRollback: afterRollback.names.includes(cacheNames.updated),
      offlineAfterRollback,
      pageErrors,
      screenshotPath
    };
    const issues = auditPwaUpdateRollbackCanary(snapshot);
    const reportPath = path.join(outputDir, "pwa-update-rollback-canary-report.json");
    await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), snapshot, issues }, null, 2)}\n`);
    await context.close();
    if (issues.length > 0) throw new Error(`PWA update/rollback canary failed:\n${issues.join("\n")}`);
    return { snapshot, issues, reportPath };
  } finally {
    await browser.close();
    await server.close();
  }
}

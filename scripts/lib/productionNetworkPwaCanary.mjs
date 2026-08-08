import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parsePwaPrecachePaths } from "./gameResourceBudget.mjs";

export const slow4gNetworkProfile = Object.freeze({
  offline: false,
  latency: 150,
  downloadThroughput: 1_600_000 / 8,
  uploadThroughput: 750_000 / 8,
  connectionType: "cellular4g"
});

export const productionNetworkPwaBudgets = Object.freeze({
  freshEntryMs: 12_000,
  updatedEntryMs: 5_000,
  updateInstallMs: 180_000
});

export function buildProductionNetworkCanaryUrl(rawUrl, marker) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new TypeError("공개 네트워크 카나리 URL은 HTTPS여야 합니다.");
  url.searchParams.set("quality-network-pwa", marker);
  return url.toString();
}

export function parseServiceWorkerVersion(source) {
  const match = String(source).match(/const VERSION = ["']([^"']+)["'];/);
  if (!match) throw new Error("공개 서비스 워커 버전을 찾을 수 없습니다.");
  return match[1];
}

export function auditProductionNetworkPwaCanary(snapshot) {
  const issues = [];
  if (snapshot.readinessStatus !== 200) issues.push(`공개 URL HTTP ${snapshot.readinessStatus}`);
  if (snapshot.expectedVersion !== snapshot.deployedVersion) issues.push("배포 SHA와 서비스 워커 버전 불일치");
  if (!snapshot.freshColdStart.entryVisible) issues.push("느린 4G 최초 진입 화면 누락");
  if (snapshot.freshColdStart.entryVisibleMs > productionNetworkPwaBudgets.freshEntryMs) {
    issues.push(`느린 4G 최초 진입 ${snapshot.freshColdStart.entryVisibleMs}ms`);
  }
  if (!snapshot.freshColdStart.layoutContained) issues.push("느린 4G 최초 진입 화면 넘침");
  if (!snapshot.update.previousControllerActive) issues.push("배포 전 서비스 워커 제어권 누락");
  if (snapshot.update.previousVersion !== snapshot.expectedVersion && snapshot.update.installState !== "installed") {
    issues.push(`서비스 워커 교체 설치 실패 ${snapshot.update.installState}`);
  }
  if (!snapshot.update.updatedControllerActive) issues.push("새 서비스 워커 제어권 전환 실패");
  if (!snapshot.update.updatedCacheComplete) issues.push("새 서비스 워커 프리캐시 불완전");
  if (snapshot.update.previousVersion !== snapshot.expectedVersion && snapshot.update.previousCachePresent) {
    issues.push("교체 후 이전 서비스 워커 캐시 잔존");
  }
  if (!snapshot.updatedColdStart.entryVisible) issues.push("서비스 워커 교체 후 진입 화면 누락");
  if (snapshot.updatedColdStart.entryVisibleMs > productionNetworkPwaBudgets.updatedEntryMs) {
    issues.push(`서비스 워커 교체 후 콜드 진입 ${snapshot.updatedColdStart.entryVisibleMs}ms`);
  }
  if (!snapshot.updatedColdStart.layoutContained) issues.push("서비스 워커 교체 후 화면 넘침");
  const pageErrors = [...snapshot.freshColdStart.pageErrors, ...snapshot.updatedColdStart.pageErrors];
  if (pageErrors.length > 0) issues.push(`페이지 오류 ${pageErrors.length}개`);
  const failedRequests = [...snapshot.freshColdStart.failedRequests, ...snapshot.updatedColdStart.failedRequests];
  if (failedRequests.length > 0) issues.push(`요청 실패 ${failedRequests.length}개`);
  return issues;
}

async function fetchServiceWorker(url) {
  const workerUrl = new URL("service-worker.js", url);
  workerUrl.searchParams.set("quality-worker", Date.now().toString());
  const response = await fetch(workerUrl, { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`서비스 워커 HTTP ${response.status}`);
  const source = await response.text();
  return { source, version: parseServiceWorkerVersion(source), status: response.status };
}

async function waitForServiceWorkerVersion(url, expectedVersion, attempts = 18) {
  let latest = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    latest = await fetchServiceWorker(url);
    if (latest.version === expectedVersion) return { ...latest, attempt };
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`서비스 워커 배포 대기 실패: ${latest?.version ?? "unknown"} != ${expectedVersion}`);
}

async function applySlow4g(context, page) {
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.clearBrowserCache");
  await session.send("Network.emulateNetworkConditions", slow4gNetworkProfile);
  return session;
}

async function measureEntry(page, url, timeoutMs) {
  const startedAt = Date.now();
  const pageErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (!failure.includes("ERR_ABORTED") && !failure.includes("cancelled")) {
      failedRequests.push(`${request.method()} ${request.url()} ${failure}`);
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const entry = page.locator(".entry-screen");
  await entry.waitFor({ state: "visible", timeout: timeoutMs });
  const entryVisibleMs = Date.now() - startedAt;
  await page.waitForTimeout(250);
  const metrics = await page.evaluate(() => {
    const entryElement = document.querySelector(".entry-screen");
    const rect = entryElement?.getBoundingClientRect();
    const navigation = performance.getEntriesByType("navigation")[0];
    const lcp = performance.getEntriesByType("largest-contentful-paint").at(-1);
    return {
      entryVisible: Boolean(entryElement && rect && rect.width > 0 && rect.height > 0),
      layoutContained: Boolean(rect && rect.left >= -1 && rect.top >= -1
        && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1
        && document.documentElement.scrollWidth <= innerWidth + 1),
      domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      loadEventMs: navigation?.loadEventEnd ? Math.round(navigation.loadEventEnd) : null,
      transferSize: navigation?.transferSize ?? null,
      largestContentfulPaintMs: lcp ? Math.round(lcp.startTime) : null,
      controlled: Boolean(navigator.serviceWorker.controller),
      viewport: { width: innerWidth, height: innerHeight }
    };
  });
  return { ...metrics, entryVisibleMs, pageErrors, failedRequests };
}

async function waitForControllerAndCache(page, version, expectedPaths, timeoutMs = 180_000, obsoleteName = null) {
  return page.evaluate(async ({ targetVersion, paths, timeout, obsolete }) => {
    const deadline = Date.now() + timeout;
    const expectedName = `wedding-garden-precache-${targetVersion}`;
    while (Date.now() < deadline) {
      const registration = await navigator.serviceWorker.getRegistration();
      const names = await caches.keys();
      const cache = names.includes(expectedName) ? await caches.open(expectedName) : null;
      const urls = new Set(cache ? (await cache.keys()).map((request) => request.url) : []);
      const scope = registration?.scope ?? location.href;
      const complete = Boolean(cache) && paths.every((resourcePath) => urls.has(new URL(resourcePath, scope).href));
      const obsoleteRemoved = !obsolete || !names.includes(obsolete);
      if (registration?.active && navigator.serviceWorker.controller && complete && obsoleteRemoved) {
        return { controlled: true, complete, names, expectedName, cachedPaths: urls.size };
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const registration = await navigator.serviceWorker.getRegistration();
    return { controlled: Boolean(navigator.serviceWorker.controller), complete: false, names: await caches.keys(), expectedName, cachedPaths: 0, registrationActive: Boolean(registration?.active) };
  }, { targetVersion: version, paths: expectedPaths, timeout: timeoutMs, obsolete: obsoleteName });
}

async function installPublicUpdate(page, timeoutMs) {
  return page.evaluate(async (timeout) => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return "registration-missing";
    return new Promise((resolve) => {
      let worker = registration.installing;
      let finished = false;
      const finish = (state) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        registration.removeEventListener("updatefound", onUpdateFound);
        worker?.removeEventListener("statechange", onStateChange);
        resolve(state);
      };
      const onStateChange = () => {
        if (registration.waiting || worker?.state === "installed") finish("installed");
        else if (worker?.state === "redundant") finish("redundant");
      };
      const onUpdateFound = () => {
        worker?.removeEventListener("statechange", onStateChange);
        worker = registration.installing;
        worker?.addEventListener("statechange", onStateChange);
        onStateChange();
      };
      const timer = setTimeout(() => finish(registration.waiting ? "installed" : "unchanged"), timeout);
      registration.addEventListener("updatefound", onUpdateFound);
      void registration.update().then(onUpdateFound).catch(() => finish("update-error"));
    });
  }, timeoutMs);
}

async function activateWaitingWorker(page, timeoutMs = 20_000) {
  return page.evaluate(async (timeout) => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    if (!registration.waiting) return Boolean(registration.active && navigator.serviceWorker.controller);
    const previous = navigator.serviceWorker.controller;
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeout);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        clearTimeout(timer);
        resolve(Boolean(navigator.serviceWorker.controller && navigator.serviceWorker.controller !== previous));
      }, { once: true });
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    });
  }, timeoutMs);
}

export async function prepareProductionNetworkPwaCanary({ url, profileDir, outputDir }) {
  const publicUrl = buildProductionNetworkCanaryUrl(url, `prepare-${Date.now()}`);
  await mkdir(outputDir, { recursive: true });
  const worker = await fetchServiceWorker(publicUrl);
  const expectedPaths = parsePwaPrecachePaths(worker.source);
  const { chromium } = await import("playwright");
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 393, height: 852 },
    locale: "ko-KR",
    serviceWorkers: "allow"
  });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(publicUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator(".entry-screen").waitFor({ state: "visible", timeout: 20_000 });
    const cache = await waitForControllerAndCache(page, worker.version, expectedPaths);
    const report = {
      generatedAt: new Date().toISOString(),
      publicUrl,
      previousVersion: worker.version,
      expectedPathCount: expectedPaths.length,
      previousControllerActive: cache.controlled,
      previousCacheComplete: cache.complete,
      previousCacheName: cache.expectedName
    };
    if (!cache.controlled || !cache.complete) throw new Error("배포 전 공개 서비스 워커 상태 준비 실패");
    const reportPath = path.join(outputDir, "production-network-pwa-prepare.json");
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return { ...report, reportPath };
  } finally {
    await context.close();
  }
}

export async function verifyProductionNetworkPwaCanary({ url, expectedSha, profileDir, outputDir }) {
  if (!expectedSha) throw new TypeError("배포 SHA가 필요합니다.");
  await mkdir(outputDir, { recursive: true });
  const expectedVersion = expectedSha.slice(0, 12);
  const deployed = await waitForServiceWorkerVersion(url, expectedVersion);
  const expectedPaths = parsePwaPrecachePaths(deployed.source);
  const prepare = JSON.parse(await readFile(path.join(outputDir, "production-network-pwa-prepare.json"), "utf8"));
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  let freshColdStart;
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: "ko-KR", serviceWorkers: "allow" });
    const page = await context.newPage();
    await applySlow4g(context, page);
    freshColdStart = await measureEntry(page, buildProductionNetworkCanaryUrl(url, `fresh-${expectedVersion}`), productionNetworkPwaBudgets.freshEntryMs);
    await page.screenshot({ path: path.join(outputDir, "slow-4g-fresh-cold-start.png"), scale: "css" });
    await context.close();
  } finally {
    await browser.close();
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 393, height: 852 },
    locale: "ko-KR",
    serviceWorkers: "allow"
  });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    const session = await applySlow4g(context, page);
    await page.goto(buildProductionNetworkCanaryUrl(url, `update-${expectedVersion}`), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator(".entry-screen").waitFor({ state: "visible", timeout: 20_000 });
    const beforeNames = await page.evaluate(() => caches.keys());
    const installState = prepare.previousVersion === expectedVersion
      ? await page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          if (!registration) return "registration-missing";
          await registration.update();
          return "unchanged";
        }).catch(() => "update-error")
      : await installPublicUpdate(page, productionNetworkPwaBudgets.updateInstallMs);
    const updatedControllerActive = installState === "installed"
      ? await activateWaitingWorker(page)
      : Boolean(await page.evaluate(() => navigator.serviceWorker.controller));
    const obsoleteName = prepare.previousVersion === expectedVersion ? null : prepare.previousCacheName;
    const cache = await waitForControllerAndCache(
      page,
      expectedVersion,
      expectedPaths,
      productionNetworkPwaBudgets.updateInstallMs,
      obsoleteName
    );
    await session.send("Network.clearBrowserCache");
    const updatedColdStart = await measureEntry(
      page,
      buildProductionNetworkCanaryUrl(url, `updated-cold-${expectedVersion}`),
      productionNetworkPwaBudgets.updatedEntryMs
    );
    await page.screenshot({ path: path.join(outputDir, "slow-4g-updated-cold-start.png"), scale: "css" });
    const snapshot = {
      readinessStatus: deployed.status,
      readinessAttempt: deployed.attempt,
      expectedVersion,
      deployedVersion: deployed.version,
      networkProfile: slow4gNetworkProfile,
      freshColdStart,
      update: {
        previousVersion: prepare.previousVersion,
        previousControllerActive: prepare.previousControllerActive,
        previousCacheComplete: prepare.previousCacheComplete,
        previousCacheName: prepare.previousCacheName,
        installState,
        updatedControllerActive: updatedControllerActive && cache.controlled,
        updatedCacheComplete: cache.complete,
        updatedCacheName: cache.expectedName,
        cachedPaths: cache.cachedPaths,
        expectedPaths: expectedPaths.length,
        previousCachePresent: prepare.previousVersion === expectedVersion
          ? false
          : cache.names.includes(prepare.previousCacheName),
        cacheNamesBeforeUpdate: beforeNames,
        cacheNamesAfterUpdate: cache.names
      },
      updatedColdStart
    };
    const issues = auditProductionNetworkPwaCanary(snapshot);
    const reportPath = path.join(outputDir, "production-network-pwa-canary-report.json");
    await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), publicUrl: url, expectedSha, ...snapshot, issues }, null, 2)}\n`);
    if (issues.length > 0) throw new Error(`공개 느린 4G·PWA 카나리 실패:\n${issues.join("\n")}`);
    return { snapshot, issues, reportPath };
  } finally {
    await context.close();
  }
}

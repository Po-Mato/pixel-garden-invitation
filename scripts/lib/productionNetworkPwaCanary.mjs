import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parsePwaFeaturePaths, parsePwaPrecachePaths } from "./gameResourceBudget.mjs";

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
  updateInstallMs: 180_000,
  largestContentfulPaintMs: 4_000,
  maximumCorePrecachePaths: 90
});

export const productionNetworkPwaTrendPolicy = Object.freeze({
  requiredRuns: 5,
  retainedRuns: 12,
  largestContentfulPaintRatio: 1.5,
  largestContentfulPaintNoiseMs: 750,
  updateInstallRatio: 2.5,
  updateInstallNoiseMs: 2_500
});

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) throw new TypeError("추세 중앙값 표본이 필요합니다.");
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function productionNetworkPwaTrendSample(report, runId = null) {
  const largestContentfulPaintMs = report?.freshColdStart?.largestContentfulPaintMs;
  const updateInstallMs = report?.update?.installDurationMs;
  if (!Number.isFinite(largestContentfulPaintMs) || !Number.isFinite(updateInstallMs)) return null;
  return {
    runId: runId ? String(runId) : null,
    expectedSha: report.expectedSha ?? null,
    generatedAt: report.generatedAt ?? new Date().toISOString(),
    status: Array.isArray(report.issues) && report.issues.length > 0 ? "failed" : "passed",
    largestContentfulPaintMs,
    updateInstallMs
  };
}

export function mergeProductionNetworkPwaTrendRuns(runs, incoming) {
  const merged = [...(Array.isArray(runs) ? runs : [])];
  for (const run of Array.isArray(incoming) ? incoming : []) {
    if (!run) continue;
    const identity = run.expectedSha || run.runId;
    const duplicateAt = merged.findIndex((candidate) => (
      identity && (candidate.expectedSha || candidate.runId) === identity
    ));
    if (duplicateAt >= 0) merged.splice(duplicateAt, 1);
    merged.push(run);
  }
  const normalized = [];
  for (const run of merged.sort((left, right) => Date.parse(left.generatedAt) - Date.parse(right.generatedAt))) {
    const identity = run.expectedSha || run.runId;
    const duplicateAt = normalized.findIndex((candidate) => (
      identity && (candidate.expectedSha || candidate.runId) === identity
    ));
    if (duplicateAt >= 0) normalized.splice(duplicateAt, 1);
    normalized.push(run);
  }
  return normalized.slice(-productionNetworkPwaTrendPolicy.retainedRuns);
}

export function assessProductionNetworkPwaTrend(previousRuns, currentRun) {
  if (!currentRun || currentRun.status !== "passed") {
    return { status: "skipped", sampleCount: 0, requiredSampleCount: productionNetworkPwaTrendPolicy.requiredRuns, baselineRunIds: [], comparisons: [], issues: [] };
  }
  const currentIdentity = currentRun.expectedSha || currentRun.runId;
  const seenDeployments = new Set();
  const baselines = [...(Array.isArray(previousRuns) ? previousRuns : [])]
    .reverse()
    .filter(({ status, largestContentfulPaintMs, updateInstallMs }) => (
      status === "passed" && Number.isFinite(largestContentfulPaintMs) && Number.isFinite(updateInstallMs)
    ))
    .filter((run) => {
      const identity = run.expectedSha || run.runId;
      if (identity && (identity === currentIdentity || seenDeployments.has(identity))) return false;
      if (identity) seenDeployments.add(identity);
      return true;
    })
    .slice(0, productionNetworkPwaTrendPolicy.requiredRuns - 1)
    .reverse();
  const sampleCount = baselines.length + 1;
  if (sampleCount < productionNetworkPwaTrendPolicy.requiredRuns) {
    return {
      status: "warming",
      sampleCount,
      requiredSampleCount: productionNetworkPwaTrendPolicy.requiredRuns,
      baselineRunIds: baselines.map(({ runId }) => runId).filter(Boolean),
      comparisons: [],
      issues: []
    };
  }
  const policies = [
    {
      key: "largestContentfulPaintMs",
      label: "느린 4G LCP",
      ratio: productionNetworkPwaTrendPolicy.largestContentfulPaintRatio,
      noise: productionNetworkPwaTrendPolicy.largestContentfulPaintNoiseMs
    },
    {
      key: "updateInstallMs",
      label: "서비스 워커 설치",
      ratio: productionNetworkPwaTrendPolicy.updateInstallRatio,
      noise: productionNetworkPwaTrendPolicy.updateInstallNoiseMs
    }
  ];
  const comparisons = policies.map(({ key, label, ratio, noise }) => {
    const baseline = Math.round(median(baselines.map((run) => run[key])));
    const current = Number(currentRun[key]);
    const limit = Math.round(Math.max(baseline * ratio, baseline + noise));
    return { key, label, baseline, current, limit, passed: Number.isFinite(current) && current <= limit };
  });
  const issues = comparisons
    .filter(({ passed }) => !passed)
    .map(({ label, current, limit }) => `최근 5회 ${label} 회귀 ${current}ms > ${limit}ms`);
  return {
    status: issues.length === 0 ? "passed" : "failed",
    sampleCount,
    requiredSampleCount: productionNetworkPwaTrendPolicy.requiredRuns,
    baselineRunIds: baselines.map(({ runId }) => runId).filter(Boolean),
    comparisons,
    issues
  };
}

export function buildProductionNetworkCanaryUrl(rawUrl, marker) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new TypeError("공개 네트워크 카나리 URL은 HTTPS여야 합니다.");
  url.searchParams.set("quality-network-pwa", marker);
  return url.toString();
}

export async function waitForPublicPrecacheAvailability(
  rawUrl,
  paths,
  { attempts = 12, intervalMs = 1_000, fetchImpl = fetch } = {}
) {
  let unavailable = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const results = await Promise.all(paths.map(async (resourcePath) => {
      try {
        const response = await fetchImpl(new URL(resourcePath, rawUrl), { cache: "no-store" });
        if (response.ok) await response.arrayBuffer();
        return response.ok ? null : { path: resourcePath, status: response.status };
      } catch {
        return { path: resourcePath, status: 0 };
      }
    }));
    unavailable = results.filter(Boolean);
    if (unavailable.length === 0) return { attempt, checkedPaths: paths.length };
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`공개 프리캐시 자산 준비 지연: ${unavailable.map(({ path: resourcePath, status }) => (
    `${resourcePath}(${status || "network"})`
  )).join(", ")}`);
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
  if (!snapshot.freshColdStart.largestContentfulPaintSupported
    || !Number.isFinite(snapshot.freshColdStart.largestContentfulPaintMs)) {
    issues.push("느린 4G LCP 관측 누락");
  } else if (snapshot.freshColdStart.largestContentfulPaintMs > productionNetworkPwaBudgets.largestContentfulPaintMs) {
    issues.push(`느린 4G LCP ${snapshot.freshColdStart.largestContentfulPaintMs}ms`);
  }
  if (!snapshot.update.previousControllerActive) issues.push("배포 전 서비스 워커 제어권 누락");
  if (snapshot.update.previousVersion !== snapshot.expectedVersion && snapshot.update.installState !== "installed") {
    issues.push(`서비스 워커 교체 설치 실패 ${snapshot.update.installState}`);
  }
  if (!snapshot.update.updatedControllerActive) issues.push("새 서비스 워커 제어권 전환 실패");
  if (!snapshot.update.updatedCacheComplete) issues.push("새 서비스 워커 프리캐시 불완전");
  if (snapshot.update.expectedPaths > productionNetworkPwaBudgets.maximumCorePrecachePaths) {
    issues.push(`핵심 프리캐시 과다 ${snapshot.update.expectedPaths}개`);
  }
  if (snapshot.update.expectedFeaturePaths < 1) issues.push("선택 기능 캐시 분리 누락");
  if (snapshot.update.installDurationMs > productionNetworkPwaBudgets.updateInstallMs) {
    issues.push(`서비스 워커 설치 지연 ${snapshot.update.installDurationMs}ms`);
  }
  if (snapshot.update.previousVersion !== snapshot.expectedVersion && snapshot.update.previousCachePresent) {
    issues.push("교체 후 이전 서비스 워커 캐시 잔존");
  }
  if (!snapshot.updatedColdStart.entryVisible) issues.push("서비스 워커 교체 후 진입 화면 누락");
  if (snapshot.updatedColdStart.entryVisibleMs > productionNetworkPwaBudgets.updatedEntryMs) {
    issues.push(`서비스 워커 교체 후 콜드 진입 ${snapshot.updatedColdStart.entryVisibleMs}ms`);
  }
  if (!snapshot.updatedColdStart.layoutContained) issues.push("서비스 워커 교체 후 화면 넘침");
  if (!snapshot.updatedColdStart.largestContentfulPaintSupported
    || !Number.isFinite(snapshot.updatedColdStart.largestContentfulPaintMs)) {
    issues.push("교체 후 LCP 관측 누락");
  } else if (snapshot.updatedColdStart.largestContentfulPaintMs > productionNetworkPwaBudgets.largestContentfulPaintMs) {
    issues.push(`교체 후 LCP ${snapshot.updatedColdStart.largestContentfulPaintMs}ms`);
  }
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

export async function waitForServiceWorkerVersion(
  url,
  expectedVersion,
  { attempts = 18, intervalMs = 5_000 } = {}
) {
  let latest = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    latest = await fetchServiceWorker(url);
    if (latest.version === expectedVersion) return { ...latest, attempt };
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
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
  await page.addInitScript(() => {
    globalThis.__weddingQualityLcp = {
      supported: typeof PerformanceObserver === "function"
        && PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint") === true,
      value: null
    };
    if (!globalThis.__weddingQualityLcp.supported) return;
    const observer = new PerformanceObserver((list) => {
      const latest = list.getEntries().at(-1);
      if (latest) globalThis.__weddingQualityLcp.value = Math.round(latest.startTime);
    });
    observer.observe({ type: "largest-contentful-paint", buffered: true });
  });
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
  await page.waitForFunction(
    () => Number.isFinite(globalThis.__weddingQualityLcp?.value),
    undefined,
    { timeout: Math.min(timeoutMs, 6_000) }
  ).catch(() => undefined);
  const metrics = await page.evaluate(() => {
    const entryElement = document.querySelector(".entry-screen");
    const rect = entryElement?.getBoundingClientRect();
    const navigation = performance.getEntriesByType("navigation")[0];
    const lcp = globalThis.__weddingQualityLcp;
    return {
      entryVisible: Boolean(entryElement && rect && rect.width > 0 && rect.height > 0),
      layoutContained: Boolean(rect && rect.left >= -1 && rect.top >= -1
        && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1
        && document.documentElement.scrollWidth <= innerWidth + 1),
      domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      loadEventMs: navigation?.loadEventEnd ? Math.round(navigation.loadEventEnd) : null,
      transferSize: navigation?.transferSize ?? null,
      largestContentfulPaintSupported: lcp?.supported === true,
      largestContentfulPaintMs: Number.isFinite(lcp?.value) ? lcp.value : null,
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
  const expectedFeaturePaths = parsePwaFeaturePaths(worker.source);
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
      expectedFeaturePathCount: expectedFeaturePaths.length,
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
  const expectedFeaturePaths = parsePwaFeaturePaths(deployed.source);
  const assetReadiness = await waitForPublicPrecacheAvailability(url, expectedPaths);
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
    const installStartedAt = Date.now();
    const installState = prepare.previousVersion === expectedVersion
      ? await page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          if (!registration) return "registration-missing";
          await registration.update();
          return "unchanged";
        }).catch(() => "update-error")
      : await installPublicUpdate(page, productionNetworkPwaBudgets.updateInstallMs);
    const installDurationMs = Date.now() - installStartedAt;
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
      assetReadinessAttempt: assetReadiness.attempt,
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
        installDurationMs,
        updatedControllerActive: updatedControllerActive && cache.controlled,
        updatedCacheComplete: cache.complete,
        updatedCacheName: cache.expectedName,
        cachedPaths: cache.cachedPaths,
        expectedPaths: expectedPaths.length,
        expectedFeaturePaths: expectedFeaturePaths.length,
        previousExpectedPaths: prepare.expectedPathCount,
        previousExpectedFeaturePaths: prepare.expectedFeaturePathCount,
        previousCachePresent: prepare.previousVersion === expectedVersion
          ? false
          : cache.names.includes(prepare.previousCacheName),
        cacheNamesBeforeUpdate: beforeNames,
        cacheNamesAfterUpdate: cache.names
      },
      updatedColdStart
    };
    const baseIssues = auditProductionNetworkPwaCanary(snapshot);
    const generatedAt = new Date().toISOString();
    const currentRun = productionNetworkPwaTrendSample({
      generatedAt,
      expectedSha,
      ...snapshot,
      issues: baseIssues
    }, process.env.GITHUB_RUN_ID ?? expectedSha);
    const historyPath = path.join(outputDir, "production-network-pwa-trend-history.json");
    let previousRuns = [];
    try {
      const history = JSON.parse(await readFile(historyPath, "utf8"));
      if (Array.isArray(history.runs)) previousRuns = history.runs;
    } catch {
      // The first deployment warms the five-run trend from an empty history.
    }
    const priorRuns = previousRuns.filter(({ runId, expectedSha: sha }) => (
      (sha || runId) !== (currentRun?.expectedSha || currentRun?.runId)
    ));
    const trend = assessProductionNetworkPwaTrend(priorRuns, currentRun);
    const issues = [...baseIssues, ...trend.issues];
    if (currentRun) currentRun.status = issues.length === 0 ? "passed" : "failed";
    const historyRuns = mergeProductionNetworkPwaTrendRuns(priorRuns, [currentRun]);
    const reportPath = path.join(outputDir, "production-network-pwa-canary-report.json");
    await Promise.all([
      writeFile(reportPath, `${JSON.stringify({ generatedAt, publicUrl: url, expectedSha, ...snapshot, trend, issues }, null, 2)}\n`),
      writeFile(historyPath, `${JSON.stringify({ version: 1, runs: historyRuns }, null, 2)}\n`),
      writeFile(path.join(outputDir, "production-network-pwa-trend.md"), [
        "# 공개 배포 네트워크 품질 추세",
        "",
        `- 상태: ${trend.status}`,
        `- 유효 표본: ${trend.sampleCount}/${trend.requiredSampleCount}`,
        `- 현재 느린 4G LCP: ${currentRun?.largestContentfulPaintMs ?? "미측정"}ms`,
        `- 현재 서비스 워커 설치: ${currentRun?.updateInstallMs ?? "미측정"}ms`,
        `- 보존된 배포: ${historyRuns.length}/${productionNetworkPwaTrendPolicy.retainedRuns}`,
        "",
        ...(trend.issues.length ? trend.issues.map((issue) => `- 실패: ${issue}`) : ["- 추세 실패 항목 없음"]),
        ""
      ].join("\n"))
    ]);
    if (issues.length > 0) throw new Error(`공개 느린 4G·PWA 카나리 실패:\n${issues.join("\n")}`);
    return { snapshot, trend, issues, reportPath };
  } finally {
    await context.close();
  }
}

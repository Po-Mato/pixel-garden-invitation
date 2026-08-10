import { classifyVisualDifference, summarizeVisualDifferenceClassifications } from "./visualDiffClassifier.mjs";

export const releaseQualityEvidenceNames = Object.freeze({
  mapDiagnostics: "map-diagnostics-browser-report.json",
  mobileRegions: "mobile-game-regions.json",
  hud: "mobile-hud-browser-report.json",
  android: "android-chrome-capture-report.json",
  ios: "ios-safari-capture-report.json",
  pwaAssets: "pwa-cache-asset-trend.json",
  pwaNetwork: "production-network-pwa-canary-report.json",
  pagesRuntimeContract: "pages-runtime-contract-report.json",
  ciEfficiency: "quality-ci-efficiency-summary.json",
  evidenceEfficiency: "quality-evidence-efficiency-summary.json"
});

function nestedIssues(value, prefix = "") {
  const issues = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => issues.push(...nestedIssues(item, `${prefix}[${index}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (/issues$/i.test(key) && Array.isArray(item)) {
        item.forEach((issue) => issues.push(`${path}: ${String(issue)}`));
      } else {
        issues.push(...nestedIssues(item, path));
      }
    }
  }
  return issues;
}

function category(id, evidenceNames, details, issues) {
  const missing = evidenceNames.filter((name) => details[name] === null);
  return {
    id,
    status: missing.length > 0 ? "blocked" : issues.length > 0 ? "failed" : "passed",
    missing,
    issues,
    metrics: Object.fromEntries(Object.entries(details).filter(([, value]) => value !== null))
  };
}

function comparisonIssues(report, label) {
  return (report?.comparisons ?? []).flatMap((comparison) => comparison.passed === true
    ? []
    : [`${label}/${comparison.state ?? "unknown"}: 시각 기준선 불일치`]);
}

function offlineIssues(report, label) {
  if (!report?.pwaOffline) return [`${label}: 오프라인 PWA 증거 누락`];
  const snapshot = report.pwaOffline;
  const issues = [];
  if (!snapshot.controlled) issues.push(`${label}: 서비스 워커 제어 실패`);
  if (snapshot.cachedPaths !== snapshot.expectedPaths) {
    issues.push(`${label}: 오프라인 캐시 ${snapshot.cachedPaths}/${snapshot.expectedPaths}`);
  }
  for (const issue of snapshot.criticalAssetFailures ?? []) issues.push(`${label}: ${issue}`);
  for (const issue of snapshot.pageErrors ?? []) issues.push(`${label}: ${issue}`);
  return issues;
}

function visualComparisons(evidence, policies = {}) {
  const hud = (evidence.hud?.reports ?? []).flatMap((report) => Object.entries(report.deviceVisualBaselines ?? {}).flatMap(([state, value]) => (
    value?.comparison ? [{
      source: `hud/${report.id}`,
      engine: report.engine ?? "chromium",
      state,
      ...value.comparison,
      classification: classifyVisualDifference(value.comparison, null, policies[report.engine ?? "chromium"])
    }] : []
  )));
  const device = ["android", "ios"].flatMap((source) => (evidence[source]?.comparisons ?? []).map((comparison) => ({
    source,
    engine: source === "ios" ? "webkit" : "chromium",
    ...comparison,
    classification: classifyVisualDifference(comparison, null, policies[source === "ios" ? "webkit" : "chromium"])
  })));
  const regions = (evidence.mobileRegions?.regionResults ?? []).map((region) => {
    const maxChangedRatio = evidence.mobileRegions?.maxRegionChangedRatio ?? 0;
    const comparison = {
      source: `map/${region.kind ?? "unknown"}`,
      engine: "renderer",
      state: region.id,
      changedRatio: region.changedRatio,
      maxChangedRatio,
      passed: region.changedRatio <= maxChangedRatio
    };
    return { ...comparison, classification: classifyVisualDifference(comparison) };
  });
  return [...hud, ...device, ...regions];
}

export function buildReleaseQualitySummary(evidence = {}, metadata = {}) {
  const mapIssues = [
    ...nestedIssues(evidence.mapDiagnostics),
    ...(evidence.mobileRegions?.regionResults ?? []).flatMap((region) => (
      region.changedRatio <= (evidence.mobileRegions.maxRegionChangedRatio ?? 0) ? []
        : [`${region.id}: 변경률 ${region.changedRatio}`]
    ))
  ];
  const map = category("map", ["mapDiagnostics", "mobileRegions"], {
    mapDiagnostics: evidence.mapDiagnostics ? evidence.mapDiagnostics.reports?.length ?? 0 : null,
    mobileRegions: evidence.mobileRegions ? evidence.mobileRegions.regionResults?.filter(({ kind }) => kind === "map").length ?? 0 : null,
    changedRatio: evidence.mobileRegions?.changedRatio ?? null
  }, mapIssues);

  const hud = category("hud", ["hud"], {
    hud: evidence.hud ? evidence.hud.reports?.length ?? 0 : null,
    typographyProfiles: evidence.hud?.typographyScaleAudit?.reports?.length ?? null,
    collisionProfiles: evidence.hud?.collisionMatrix?.reports?.length ?? null
  }, nestedIssues(evidence.hud));

  const android = category("android", ["android"], {
    android: evidence.android ? evidence.android.comparisons?.length ?? 0 : null,
    cachedPaths: evidence.android?.pwaOffline?.cachedPaths ?? null,
    expectedPaths: evidence.android?.pwaOffline?.expectedPaths ?? null
  }, [
    ...nestedIssues(evidence.android),
    ...comparisonIssues(evidence.android, "Android"),
    ...(evidence.android ? offlineIssues(evidence.android, "Android") : [])
  ]);

  const ios = category("ios", ["ios"], {
    ios: evidence.ios ? evidence.ios.comparisons?.length ?? 0 : null,
    cachedPaths: evidence.ios?.pwaOffline?.cachedPaths ?? null,
    expectedPaths: evidence.ios?.pwaOffline?.expectedPaths ?? null,
    p95FrameMs: evidence.ios?.landscape?.frameTimings?.p95FrameMs ?? null,
    expandedPlayerCenterErrorPx: evidence.ios?.landscape?.expanded?.playerCenter?.errorPx ?? null,
    collapsedPlayerCenterErrorPx: evidence.ios?.landscape?.collapsed?.playerCenter?.errorPx ?? null,
    compositorRecoveryCount: evidence.ios?.nativeCompositor?.recoveryCount ?? null,
    compositorRecoveryDurationMs: evidence.ios?.nativeCompositor?.recoveryDurationMs ?? null,
    compositorFaultInjected: evidence.ios?.nativeCompositor?.faultInjection?.triggered ?? null
  }, [
    ...nestedIssues(evidence.ios),
    ...comparisonIssues(evidence.ios, "iOS"),
    ...(evidence.ios ? offlineIssues(evidence.ios, "iOS") : [])
  ]);

  const assetTrend = evidence.pwaAssets?.trend;
  const pwaIssues = [
    ...(assetTrend?.logicalChunkBudget?.issues ?? []),
    ...(evidence.pwaNetwork?.issues ?? []),
    ...(evidence.pagesRuntimeContract?.issues ?? [])
  ];
  const pwaNetworkStatus = evidence.pwaNetwork?.status
    ?? evidence.pwaNetwork?.trend?.status
    ?? ((evidence.pwaNetwork?.issues?.length ?? 0) === 0 ? "passed" : "failed");
  if (assetTrend && assetTrend.logicalChunkBudget?.status !== "passed") {
    pwaIssues.push("PWA 논리 청크 예산 미통과");
  }
  if (evidence.pwaNetwork && pwaNetworkStatus !== "passed") {
    pwaIssues.push(`공개 네트워크 캔어리 ${pwaNetworkStatus}`);
  }
  if (evidence.pagesRuntimeContract && evidence.pagesRuntimeContract.status !== "passed") {
    pwaIssues.push(`Pages 운영 복원 계약 ${evidence.pagesRuntimeContract.status}`);
  }
  const pwa = category("pwa", ["pwaAssets", "pwaNetwork", "pagesRuntimeContract"], {
    pwaAssets: assetTrend ? (assetTrend.groups?.core?.total ?? 0) + (assetTrend.groups?.features?.total ?? 0) : null,
    logicalChunks: assetTrend?.logicalChunkBudget?.evaluations?.length ?? null,
    pagesRuntimeAssets: evidence.pagesRuntimeContract?.assets?.probes?.length ?? null,
    serviceWorkerScope: evidence.pagesRuntimeContract?.serviceWorker?.allowedScope ?? null,
    largestContentfulPaintMs: evidence.pwaNetwork?.slow4g?.largestContentfulPaintMs
      ?? evidence.pwaNetwork?.freshColdStart?.largestContentfulPaintMs
      ?? evidence.pwaNetwork?.metrics?.largestContentfulPaintMs
      ?? null
  }, pwaIssues);

  const automationIssues = [];
  if (evidence.ciEfficiency?.status === "failed") {
    automationIssues.push(...(evidence.ciEfficiency.issues ?? ["CI 효율 예산 미통과"]));
  }
  if (evidence.evidenceEfficiency?.status === "failed") {
    automationIssues.push(...(evidence.evidenceEfficiency.issues ?? ["품질 증거 저장 예산 미통과"]));
  }
  const automation = category("automation", ["ciEfficiency", "evidenceEfficiency"], {
    ciReports: evidence.ciEfficiency?.metrics?.reportCount ?? null,
    dependencyCacheHitRate: evidence.ciEfficiency?.metrics?.dependencyCacheHitRate ?? null,
    sharedBuildRestoreRate: evidence.ciEfficiency?.metrics?.sharedBuildRestoreRate ?? null,
    estimatedSavedMs: evidence.ciEfficiency?.metrics?.estimatedSavedMs ?? null,
    artifactBytes: evidence.ciEfficiency?.metrics?.artifactBytes ?? null,
    coldCacheP95Ms: evidence.ciEfficiency?.trend?.cacheTiming?.cold?.p95RunDurationMs ?? null,
    warmCacheP95Ms: evidence.ciEfficiency?.trend?.cacheTiming?.warm?.p95RunDurationMs ?? null,
    monthlyRunnerMinutes: evidence.ciEfficiency?.trend?.monthly?.runnerMinutes ?? null,
    monthlyEstimatedChargeUsd: evidence.ciEfficiency?.trend?.monthly?.estimatedChargeUsd ?? null,
    evidenceStoredBytes: evidence.evidenceEfficiency?.metrics?.storedBytes ?? null,
    omittedDuplicateBytes: evidence.evidenceEfficiency?.metrics?.omittedDuplicateBytes ?? null,
    evidenceTrendStatus: evidence.evidenceEfficiency?.status ?? null,
    evidenceBudgetBytes: evidence.evidenceEfficiency?.budgetCalibration?.effectiveMaximumStoredBytes ?? null
  }, automationIssues);

  const categories = [map, hud, android, ios, pwa, automation];
  const visualDifferences = summarizeVisualDifferenceClassifications(visualComparisons(
    evidence,
    metadata.visualCalibrationPolicies ?? {}
  ));
  return {
    generatedAt: metadata.generatedAt ?? new Date().toISOString(),
    sha: metadata.sha ?? null,
    runUrl: metadata.runUrl ?? null,
    status: categories.some(({ status }) => status === "failed")
      ? "failed"
      : categories.some(({ status }) => status === "blocked") ? "blocked" : "passed",
    categories,
    visualDifferences,
    visualCalibration: metadata.visualCalibration ?? null
  };
}

export function formatReleaseQualitySummaryMarkdown(summary) {
  const label = { map: "맵", hud: "HUD·타이포", android: "Android", ios: "iOS", pwa: "PWA", automation: "자동화 효율" };
  const lines = [
    "<!-- release-quality-summary -->",
    "## 릴리스 품질 요약",
    "",
    `- 커밋: \`${summary.sha ?? "unknown"}\``,
    `- 종합 상태: **${summary.status}**`,
    "",
    "| 영역 | 상태 | 핵심 수치 |",
    "| --- | --- | --- |"
  ];
  for (const item of summary.categories) {
    const metrics = Object.entries(item.metrics).map(([key, value]) => `${key} ${value}`).join(" · ") || "-";
    lines.push(`| ${label[item.id] ?? item.id} | ${item.status} | ${metrics} |`);
  }
  if (summary.visualDifferences) {
    const counts = Object.entries(summary.visualDifferences.counts)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => `${id} ${count}`)
      .join(" · ") || "없음";
    lines.push("", "### 시각 차이 원인 분류", "", `- 상태: **${summary.visualDifferences.status}**`, `- ${counts}`);
  }
  if (summary.visualCalibration) {
    const engines = Object.entries(summary.visualCalibration.engines)
      .map(([engine, value]) => `${engine} ${value.status} ${value.sampleCount}/${value.requiredSamples}`)
      .join(" · ");
    lines.push("", "### 엔진별 시각 임계치 보정", "", `- 상태: **${summary.visualCalibration.status}**`, `- ${engines}`);
  }
  if (summary.trend) {
    lines.push(
      "",
      "### 이전 릴리스 대비",
      "",
      `- 상태: **${summary.trend.status}** · 표본 ${summary.trend.sampleCount}개`,
      `- 이전 커밋: \`${summary.trend.previousSha ?? "없음"}\``,
      ...(summary.trend.regressions.length ? summary.trend.regressions.map((issue) => `- ${issue}`) : ["- 유의미한 악화 없음"])
    );
  }
  const issues = summary.categories.flatMap((item) => [
    ...item.missing.map((name) => `${label[item.id] ?? item.id}: ${name} 증거 누락`),
    ...item.issues
  ]);
  lines.push("", "### 확인 필요", "", ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- 없음"]), "");
  return lines.join("\n");
}

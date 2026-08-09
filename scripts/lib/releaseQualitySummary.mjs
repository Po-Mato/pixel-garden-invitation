export const releaseQualityEvidenceNames = Object.freeze({
  mapDiagnostics: "map-diagnostics-browser-report.json",
  mobileRegions: "mobile-game-regions.json",
  hud: "mobile-hud-browser-report.json",
  android: "android-chrome-capture-report.json",
  ios: "ios-safari-capture-report.json",
  pwaAssets: "pwa-cache-asset-trend.json",
  pwaNetwork: "production-network-pwa-canary-report.json"
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
    p95FrameMs: evidence.ios?.landscape?.frameTimings?.p95FrameMs ?? null
  }, [
    ...nestedIssues(evidence.ios),
    ...comparisonIssues(evidence.ios, "iOS"),
    ...(evidence.ios ? offlineIssues(evidence.ios, "iOS") : [])
  ]);

  const assetTrend = evidence.pwaAssets?.trend;
  const pwaIssues = [
    ...(assetTrend?.logicalChunkBudget?.issues ?? []),
    ...(evidence.pwaNetwork?.issues ?? [])
  ];
  if (assetTrend && assetTrend.logicalChunkBudget?.status !== "passed") {
    pwaIssues.push("PWA 논리 청크 예산 미통과");
  }
  if (evidence.pwaNetwork && evidence.pwaNetwork.status !== "passed") {
    pwaIssues.push(`공개 네트워크 캔어리 ${evidence.pwaNetwork.status ?? "unknown"}`);
  }
  const pwa = category("pwa", ["pwaAssets", "pwaNetwork"], {
    pwaAssets: assetTrend ? (assetTrend.groups?.core?.total ?? 0) + (assetTrend.groups?.features?.total ?? 0) : null,
    logicalChunks: assetTrend?.logicalChunkBudget?.evaluations?.length ?? null,
    largestContentfulPaintMs: evidence.pwaNetwork?.slow4g?.largestContentfulPaintMs
      ?? evidence.pwaNetwork?.metrics?.largestContentfulPaintMs
      ?? null
  }, pwaIssues);

  const categories = [map, hud, android, ios, pwa];
  return {
    generatedAt: metadata.generatedAt ?? new Date().toISOString(),
    sha: metadata.sha ?? null,
    runUrl: metadata.runUrl ?? null,
    status: categories.some(({ status }) => status === "failed")
      ? "failed"
      : categories.some(({ status }) => status === "blocked") ? "blocked" : "passed",
    categories
  };
}

export function formatReleaseQualitySummaryMarkdown(summary) {
  const label = { map: "맵", hud: "HUD·타이포", android: "Android", ios: "iOS", pwa: "PWA" };
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
  const issues = summary.categories.flatMap((item) => [
    ...item.missing.map((name) => `${label[item.id] ?? item.id}: ${name} 증거 누락`),
    ...item.issues
  ]);
  lines.push("", "### 확인 필요", "", ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- 없음"]), "");
  return lines.join("\n");
}

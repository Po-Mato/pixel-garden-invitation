export const qualityEvidenceEfficiencyPolicy = Object.freeze({
  retainedReleases: 20,
  requiredHistoricalReleases: 3,
  maximumStoredBytes: 140 * 1024 * 1024,
  maximumStoredGrowthRate: 0.25,
  minimumStoredGrowthBytes: 5 * 1024 * 1024,
  maximumSavingsRateDrop: 0.05,
  maximumForbiddenFiles: 0
});

function median(values) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
}

function manifestTotals(manifest = {}) {
  return {
    totalBytes: Math.max(0, Number(manifest.totals?.totalBytes) || 0),
    storedBytes: Math.max(0, Number(manifest.totals?.storedBytes) || 0),
    omittedDuplicateBytes: Math.max(0, Number(manifest.totals?.omittedDuplicateBytes) || 0)
  };
}

export function mergeQualityEvidenceEfficiencyHistory(history = {}, snapshots = []) {
  const bySha = new Map();
  for (const snapshot of [...(history.snapshots ?? []), ...snapshots]) {
    if (!snapshot?.sha) continue;
    bySha.set(String(snapshot.sha), snapshot);
  }
  return {
    version: 1,
    snapshots: [...bySha.values()]
      .sort((left, right) => Date.parse(left.generatedAt) - Date.parse(right.generatedAt))
      .slice(-qualityEvidenceEfficiencyPolicy.retainedReleases)
  };
}

export function buildQualityEvidenceEfficiency(manifests = [], history = {}, metadata = {}) {
  const totals = manifests.reduce((aggregate, manifest) => {
    const current = manifestTotals(manifest);
    aggregate.packages += 1;
    aggregate.files += Array.isArray(manifest.files) ? manifest.files.length : 0;
    aggregate.totalBytes += current.totalBytes;
    aggregate.storedBytes += current.storedBytes;
    aggregate.omittedDuplicateBytes += current.omittedDuplicateBytes;
    for (const entry of manifest.files ?? []) {
      if (/(?:-diff\.png|-trace\.zip)$/i.test(entry.logicalPath ?? "")) {
        aggregate.forbiddenFiles.push(entry.logicalPath);
      }
    }
    return aggregate;
  }, { packages: 0, files: 0, totalBytes: 0, storedBytes: 0, omittedDuplicateBytes: 0, forbiddenFiles: [] });
  const savingsRate = totals.totalBytes === 0 ? 0 : totals.omittedDuplicateBytes / totals.totalBytes;
  const storedRatio = totals.totalBytes === 0 ? 0 : totals.storedBytes / totals.totalBytes;
  const current = {
    sha: metadata.sha ?? null,
    generatedAt: metadata.generatedAt ?? new Date().toISOString(),
    packages: totals.packages,
    files: totals.files,
    totalBytes: totals.totalBytes,
    storedBytes: totals.storedBytes,
    omittedDuplicateBytes: totals.omittedDuplicateBytes,
    savingsRate,
    storedRatio,
    forbiddenFileCount: totals.forbiddenFiles.length
  };
  const previous = (history.snapshots ?? []).filter(({ sha }) => sha && sha !== current.sha).slice(-3);
  const baselineStoredBytes = median(previous.map(({ storedBytes }) => storedBytes));
  const baselineSavingsRate = median(previous.map(({ savingsRate }) => savingsRate));
  const issues = [];
  if (totals.packages === 0) issues.push("콘텐츠 주소형 품질 증거 패키지 누락");
  if (totals.storedBytes > qualityEvidenceEfficiencyPolicy.maximumStoredBytes) {
    issues.push(`저장 크기 ${totals.storedBytes}/${qualityEvidenceEfficiencyPolicy.maximumStoredBytes} bytes`);
  }
  if (totals.forbiddenFiles.length > qualityEvidenceEfficiencyPolicy.maximumForbiddenFiles) {
    issues.push(`성공 패키지 diff/trace 누출 ${totals.forbiddenFiles.length}개`);
  }
  if (
    previous.length >= qualityEvidenceEfficiencyPolicy.requiredHistoricalReleases
    && baselineStoredBytes > 0
    && totals.storedBytes - baselineStoredBytes > qualityEvidenceEfficiencyPolicy.minimumStoredGrowthBytes
    && totals.storedBytes > baselineStoredBytes * (1 + qualityEvidenceEfficiencyPolicy.maximumStoredGrowthRate)
  ) {
    issues.push(`저장 크기 회귀 ${Math.round((totals.storedBytes / baselineStoredBytes - 1) * 100)}%`);
  }
  if (
    previous.length >= qualityEvidenceEfficiencyPolicy.requiredHistoricalReleases
    && baselineSavingsRate - savingsRate > qualityEvidenceEfficiencyPolicy.maximumSavingsRateDrop
  ) {
    issues.push(`중복 절감률 회귀 ${Math.round((baselineSavingsRate - savingsRate) * 100)}%p`);
  }
  const status = issues.length > 0
    ? "failed"
    : previous.length < qualityEvidenceEfficiencyPolicy.requiredHistoricalReleases ? "warming" : "passed";
  const nextHistory = mergeQualityEvidenceEfficiencyHistory(history, current.sha ? [current] : []);
  return {
    report: {
      version: 1,
      generatedAt: current.generatedAt,
      sha: current.sha,
      status,
      policy: qualityEvidenceEfficiencyPolicy,
      metrics: current,
      trend: {
        historicalSamples: previous.length,
        baselineStoredBytes,
        baselineSavingsRate
      },
      forbiddenFiles: totals.forbiddenFiles,
      issues
    },
    history: nextHistory
  };
}

export function formatQualityEvidenceEfficiencyMarkdown(report) {
  const metrics = report.metrics;
  return [
    "## 콘텐츠 주소형 품질 증거 효율",
    "",
    `- 상태: **${report.status}** · 패키지 ${metrics.packages}개 · 파일 ${metrics.files}개`,
    `- 논리 ${metrics.totalBytes} bytes → 저장 ${metrics.storedBytes} bytes`,
    `- 중복 절감 ${metrics.omittedDuplicateBytes} bytes · ${Math.round(metrics.savingsRate * 100)}%`,
    `- 추세 표본 ${report.trend.historicalSamples}/${report.policy.requiredHistoricalReleases}`,
    ...report.issues.map((issue) => `- ${issue}`),
    ""
  ].join("\n");
}

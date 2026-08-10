export const qualityEvidenceEfficiencyPolicy = Object.freeze({
  retainedReleases: 20,
  requiredHistoricalReleases: 3,
  maximumStoredBytes: 140 * 1024 * 1024,
  minimumCalibratedStoredBytes: 96 * 1024 * 1024,
  calibrationStoredHeadroomRate: 0.15,
  calibrationRoundingBytes: 4 * 1024 * 1024,
  minimumCalibratedGrowthRate: 0.1,
  maximumStoredGrowthRate: 0.25,
  minimumStoredGrowthBytes: 5 * 1024 * 1024,
  minimumCalibratedSavingsRateDrop: 0.03,
  maximumSavingsRateDrop: 0.05,
  maximumForbiddenFiles: 0
});

function median(values) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * ratio) - 1)];
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundUp(value, quantum) {
  return Math.ceil(value / quantum) * quantum;
}

function sequentialRates(samples, selector, direction = "growth") {
  const rates = [];
  for (let index = 1; index < samples.length; index += 1) {
    const previous = Number(selector(samples[index - 1]));
    const current = Number(selector(samples[index]));
    if (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0) continue;
    const rate = direction === "drop" ? previous - current : current / previous - 1;
    if (rate > 0) rates.push(rate);
  }
  return rates;
}

function calibratePolicy(samples, historicalCount) {
  const active = samples.length >= qualityEvidenceEfficiencyPolicy.requiredHistoricalReleases;
  if (!active) {
    return {
      status: "warming",
      sampleCount: samples.length,
      requiredSamples: qualityEvidenceEfficiencyPolicy.requiredHistoricalReleases,
      enforced: false,
      effectiveMaximumStoredBytes: qualityEvidenceEfficiencyPolicy.maximumStoredBytes,
      effectiveMaximumStoredGrowthRate: qualityEvidenceEfficiencyPolicy.maximumStoredGrowthRate,
      effectiveMaximumSavingsRateDrop: qualityEvidenceEfficiencyPolicy.maximumSavingsRateDrop,
      observedP95StoredBytes: 0,
      observedP95GrowthRate: 0,
      observedP95SavingsRateDrop: 0
    };
  }
  const observedP95StoredBytes = percentile(samples.map(({ storedBytes }) => storedBytes), 0.95);
  const observedP95GrowthRate = percentile(sequentialRates(samples, ({ storedBytes }) => storedBytes), 0.95);
  const observedP95SavingsRateDrop = percentile(sequentialRates(samples, ({ savingsRate }) => savingsRate, "drop"), 0.95);
  return {
    status: "active",
    sampleCount: samples.length,
    requiredSamples: qualityEvidenceEfficiencyPolicy.requiredHistoricalReleases,
    enforced: historicalCount >= qualityEvidenceEfficiencyPolicy.requiredHistoricalReleases,
    effectiveMaximumStoredBytes: clamp(
      roundUp(
        observedP95StoredBytes * (1 + qualityEvidenceEfficiencyPolicy.calibrationStoredHeadroomRate),
        qualityEvidenceEfficiencyPolicy.calibrationRoundingBytes
      ),
      qualityEvidenceEfficiencyPolicy.minimumCalibratedStoredBytes,
      qualityEvidenceEfficiencyPolicy.maximumStoredBytes
    ),
    effectiveMaximumStoredGrowthRate: clamp(
      observedP95GrowthRate * 1.5 + 0.05,
      qualityEvidenceEfficiencyPolicy.minimumCalibratedGrowthRate,
      qualityEvidenceEfficiencyPolicy.maximumStoredGrowthRate
    ),
    effectiveMaximumSavingsRateDrop: clamp(
      observedP95SavingsRateDrop * 1.5 + 0.01,
      qualityEvidenceEfficiencyPolicy.minimumCalibratedSavingsRateDrop,
      qualityEvidenceEfficiencyPolicy.maximumSavingsRateDrop
    ),
    observedP95StoredBytes,
    observedP95GrowthRate,
    observedP95SavingsRateDrop
  };
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
  const previous = (history.snapshots ?? []).filter(({ sha }) => sha && sha !== current.sha).slice(-5);
  const calibrationSamples = (previous.length >= qualityEvidenceEfficiencyPolicy.requiredHistoricalReleases
    ? previous
    : [...previous, current]).slice(-5);
  const calibration = calibratePolicy(calibrationSamples, previous.length);
  const baselineStoredBytes = median(previous.map(({ storedBytes }) => storedBytes));
  const baselineSavingsRate = median(previous.map(({ savingsRate }) => savingsRate));
  const issues = [];
  if (totals.packages === 0) issues.push("콘텐츠 주소형 품질 증거 패키지 누락");
  if (totals.storedBytes > qualityEvidenceEfficiencyPolicy.maximumStoredBytes) {
    issues.push(`저장 크기 ${totals.storedBytes}/${qualityEvidenceEfficiencyPolicy.maximumStoredBytes} bytes`);
  }
  if (calibration.enforced && totals.storedBytes > calibration.effectiveMaximumStoredBytes) {
    issues.push(`보정 저장 예산 ${totals.storedBytes}/${calibration.effectiveMaximumStoredBytes} bytes`);
  }
  if (totals.forbiddenFiles.length > qualityEvidenceEfficiencyPolicy.maximumForbiddenFiles) {
    issues.push(`성공 패키지 diff/trace 누출 ${totals.forbiddenFiles.length}개`);
  }
  if (
    previous.length >= qualityEvidenceEfficiencyPolicy.requiredHistoricalReleases
    && baselineStoredBytes > 0
    && totals.storedBytes - baselineStoredBytes > qualityEvidenceEfficiencyPolicy.minimumStoredGrowthBytes
    && totals.storedBytes > baselineStoredBytes * (1 + calibration.effectiveMaximumStoredGrowthRate)
  ) {
    issues.push(`저장 크기 회귀 ${Math.round((totals.storedBytes / baselineStoredBytes - 1) * 100)}%`);
  }
  if (
    previous.length >= qualityEvidenceEfficiencyPolicy.requiredHistoricalReleases
    && baselineSavingsRate - savingsRate > calibration.effectiveMaximumSavingsRateDrop
  ) {
    issues.push(`중복 절감률 회귀 ${Math.round((baselineSavingsRate - savingsRate) * 100)}%p`);
  }
  const status = issues.length > 0
    ? "failed"
    : calibration.status === "active" ? "passed" : "warming";
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
      budgetCalibration: calibration,
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
    `- 자동 보정 ${report.budgetCalibration.status} ${report.budgetCalibration.sampleCount}/${report.budgetCalibration.requiredSamples}`
      + ` · 저장 ${report.budgetCalibration.effectiveMaximumStoredBytes} bytes`
      + ` · 증가 ${Math.round(report.budgetCalibration.effectiveMaximumStoredGrowthRate * 100)}%`
      + ` · 절감률 하락 ${Math.round(report.budgetCalibration.effectiveMaximumSavingsRateDrop * 100)}%p`
      + ` · ${report.budgetCalibration.enforced ? "즉시 적용" : "다음 릴리스 적용"}`,
    ...report.issues.map((issue) => `- ${issue}`),
    ""
  ].join("\n");
}

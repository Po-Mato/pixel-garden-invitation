import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const pwaCacheAssetTrendPolicy = Object.freeze({ retainedDeployments: 12, listedAssets: 12 });
export const pwaLogicalChunkBudgetPolicy = Object.freeze({
  maximumGrowthBytes: Object.freeze({ core: 12 * 1024, features: 8 * 1024 }),
  maximumNewChunkBytes: Object.freeze({ core: 64 * 1024, features: 128 * 1024 }),
  maximumTransferBytes: Object.freeze({
    "core:./assets/index.js": 112 * 1024,
    "core:./assets/index.css": 72 * 1024,
    "core:./assets/GameWorld.js": 96 * 1024,
    "core:./assets/GameWorld.css": 52 * 1024,
    "core:./assets/QuickInvitation.js": 10 * 1024,
    "features:./assets/esm.js": 128 * 1024,
    "features:./assets/html2canvas.js": 56 * 1024,
    "features:./assets/GameMemoryAlbum.js": 20 * 1024,
    "features:./assets/GameSaveDataCenter.js": 18 * 1024
  })
});

function deploymentIdentity(sample) {
  return sample.sha || sample.runId;
}

function normalizeGroup(group = {}) {
  return {
    total: Number(group.total) || 0,
    rawBytes: Number(group.rawBytes) || 0,
    transferBytes: Number(group.transferBytes) || 0,
    assets: Array.isArray(group.assets)
      ? group.assets.map((asset) => ({
        path: String(asset.path),
        rawBytes: Number(asset.rawBytes) || 0,
        transferBytes: Number(asset.transferBytes) || 0,
        sha256: /^[a-f0-9]{64}$/i.test(asset.sha256 ?? "") ? String(asset.sha256).toLowerCase() : null
      })).sort((left, right) => left.path.localeCompare(right.path))
      : []
  };
}

export function pwaCacheAssetSample(precache, metadata = {}) {
  return {
    sha: metadata.sha || null,
    runId: metadata.runId || null,
    generatedAt: metadata.generatedAt || new Date().toISOString(),
    groups: {
      core: normalizeGroup(precache.core),
      features: normalizeGroup(precache.features)
    }
  };
}

export function mergePwaCacheAssetHistory(previousSamples, sample) {
  const samples = Array.isArray(previousSamples) ? previousSamples.filter(Boolean) : [];
  const identity = deploymentIdentity(sample);
  const withoutDuplicate = identity
    ? samples.filter((candidate) => deploymentIdentity(candidate) !== identity)
    : samples;
  return [...withoutDuplicate, sample].slice(-pwaCacheAssetTrendPolicy.retainedDeployments);
}

function indexedAssets(sample) {
  const assets = new Map();
  for (const groupName of ["core", "features"]) {
    for (const asset of sample.groups[groupName].assets) {
      assets.set(`${groupName}:${asset.path}`, { ...asset, group: groupName });
    }
  }
  return assets;
}

export function logicalPwaAssetPath(asset) {
  const match = asset.path.match(/^(.*)-([a-zA-Z0-9_-]{8})(\.[^./]+)$/);
  return match ? `${match[1]}${match[3]}` : null;
}

function semanticAssetIdentity(asset) {
  const logicalPath = logicalPwaAssetPath(asset);
  return logicalPath ? `${asset.group}:${logicalPath}` : null;
}

export async function hydratePwaCacheAssetDigests(sample, baseUrl, fetchImpl = fetch) {
  if (!sample || !baseUrl) return sample;
  const hydratedGroups = {};
  for (const groupName of ["core", "features"]) {
    const group = sample.groups[groupName];
    const assets = await Promise.all(group.assets.map(async (asset) => {
      if (asset.sha256 || !semanticAssetIdentity({ ...asset, group: groupName })) return asset;
      try {
        const response = await fetchImpl(new URL(asset.path.replace(/^\.\//, ""), baseUrl), { cache: "no-store" });
        if (!response.ok) return asset;
        const body = Buffer.from(await response.arrayBuffer());
        return { ...asset, sha256: createHash("sha256").update(body).digest("hex") };
      } catch {
        return asset;
      }
    }));
    hydratedGroups[groupName] = { ...group, assets };
  }
  return { ...sample, groups: hydratedGroups };
}

function groupDelta(current, previous, groupName) {
  const currentGroup = current.groups[groupName];
  const previousGroup = previous?.groups?.[groupName] || { total: 0, rawBytes: 0, transferBytes: 0 };
  return {
    total: currentGroup.total,
    totalDelta: currentGroup.total - previousGroup.total,
    rawBytes: currentGroup.rawBytes,
    rawBytesDelta: currentGroup.rawBytes - previousGroup.rawBytes,
    transferBytes: currentGroup.transferBytes,
    transferBytesDelta: currentGroup.transferBytes - previousGroup.transferBytes
  };
}

export function comparePwaCacheAssets(current, previous = null) {
  const currentAssets = indexedAssets(current);
  const previousAssets = previous ? indexedAssets(previous) : new Map();
  const added = [];
  const changed = [];
  const removed = [];
  const replaced = [];

  for (const [key, asset] of currentAssets) {
    const prior = previousAssets.get(key);
    if (!prior) {
      added.push(asset);
      continue;
    }
    const rawBytesDelta = asset.rawBytes - prior.rawBytes;
    const transferBytesDelta = asset.transferBytes - prior.transferBytes;
    if (rawBytesDelta || transferBytesDelta) changed.push({ ...asset, rawBytesDelta, transferBytesDelta });
  }
  for (const [key, asset] of previousAssets) {
    if (!currentAssets.has(key)) removed.push(asset);
  }
  const unmatchedAdded = [...added];
  const unmatchedRemoved = [...removed];
  const removedBySemanticIdentity = new Map();
  for (const asset of unmatchedRemoved) {
    const identity = semanticAssetIdentity(asset);
    if (!identity) continue;
    const candidates = removedBySemanticIdentity.get(identity) ?? [];
    candidates.push(asset);
    removedBySemanticIdentity.set(identity, candidates);
  }
  for (const asset of [...unmatchedAdded]) {
    const identity = semanticAssetIdentity(asset);
    const candidates = identity ? removedBySemanticIdentity.get(identity) : null;
    if (!candidates || candidates.length === 0) continue;
    const prior = candidates.shift();
    const rawBytesDelta = asset.rawBytes - prior.rawBytes;
    const transferBytesDelta = asset.transferBytes - prior.transferBytes;
    const contentChanged = asset.sha256 && prior.sha256 ? asset.sha256 !== prior.sha256 : null;
    replaced.push({
      ...asset,
      previousPath: prior.path,
      previousRawBytes: prior.rawBytes,
      previousTransferBytes: prior.transferBytes,
      rawBytesDelta,
      transferBytesDelta,
      contentChanged
    });
    unmatchedAdded.splice(unmatchedAdded.indexOf(asset), 1);
    unmatchedRemoved.splice(unmatchedRemoved.indexOf(prior), 1);
  }
  const byTransferImpact = (left, right) => Math.abs(right.transferBytesDelta ?? right.transferBytes)
    - Math.abs(left.transferBytesDelta ?? left.transferBytes);
  unmatchedAdded.sort(byTransferImpact);
  changed.sort(byTransferImpact);
  replaced.sort(byTransferImpact);
  unmatchedRemoved.sort(byTransferImpact);

  return {
    status: previous ? "compared" : "initial",
    currentSha: current.sha,
    baselineSha: previous?.sha || null,
    groups: {
      core: groupDelta(current, previous, "core"),
      features: groupDelta(current, previous, "features")
    },
    added: unmatchedAdded,
    changed,
    replaced,
    removed: unmatchedRemoved
  };
}

export function auditPwaLogicalChunkBudgets(current, trend, policy = pwaLogicalChunkBudgetPolicy) {
  const issues = [];
  const evaluations = [];
  const currentAssets = [...indexedAssets(current).values()]
    .flatMap((asset) => {
      const logicalPath = logicalPwaAssetPath(asset);
      if (!logicalPath || !/\.(?:css|js)$/i.test(logicalPath)) return [];
      return [{
        group: asset.group,
        logicalPath,
        path: asset.path,
        transferBytes: asset.transferBytes,
        maximumTransferBytes: policy.maximumTransferBytes[`${asset.group}:${logicalPath}`] ?? null
      }];
    });
  for (const evaluation of currentAssets) {
    const passed = evaluation.maximumTransferBytes === null
      || evaluation.transferBytes <= evaluation.maximumTransferBytes;
    evaluations.push({ ...evaluation, passed });
    if (!passed) {
      issues.push(
        `${evaluation.group}:${evaluation.logicalPath} 전송 용량 ${evaluation.transferBytes}/${evaluation.maximumTransferBytes}`
      );
    }
  }
  for (const asset of [...trend.changed, ...trend.replaced]) {
    const logicalPath = logicalPwaAssetPath(asset);
    if (!logicalPath || !/\.(?:css|js)$/i.test(logicalPath) || asset.transferBytesDelta <= 0) continue;
    const maximum = policy.maximumGrowthBytes[asset.group];
    if (asset.transferBytesDelta > maximum) {
      issues.push(`${asset.group}:${logicalPath} 배포 증가 ${asset.transferBytesDelta}/${maximum}`);
    }
  }
  for (const asset of trend.added) {
    const logicalPath = logicalPwaAssetPath(asset);
    if (!logicalPath || !/\.(?:css|js)$/i.test(logicalPath)) continue;
    if (policy.maximumTransferBytes[`${asset.group}:${logicalPath}`] !== undefined) continue;
    const maximum = policy.maximumNewChunkBytes[asset.group];
    if (asset.transferBytes > maximum) {
      issues.push(`${asset.group}:${logicalPath} 새 청크 ${asset.transferBytes}/${maximum}`);
    }
  }
  return {
    status: issues.length === 0 ? "passed" : "failed",
    policy,
    evaluations: evaluations.sort((left, right) => right.transferBytes - left.transferBytes),
    issues
  };
}

function signed(value) {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("ko-KR")}B`;
}

function groupLabel(group) {
  return group === "core" ? "핵심" : "선택 기능";
}

function assetRows(assets, value) {
  if (assets.length === 0) return "- 없음";
  return assets.slice(0, pwaCacheAssetTrendPolicy.listedAssets)
    .map((asset) => `- \`${asset.path}\` (${groupLabel(asset.group)}, ${value(asset)})`)
    .join("\n");
}

function replacementRows(assets) {
  if (assets.length === 0) return "- 없음";
  return assets.slice(0, pwaCacheAssetTrendPolicy.listedAssets)
    .map((asset) => {
      const content = asset.contentChanged === true
        ? "내용 변경"
        : asset.contentChanged === false ? "동일 내용·해시만 변경" : "내용 해시 미수집";
      return `- \`${asset.previousPath}\` → \`${asset.path}\` (${groupLabel(asset.group)}, ${content}, ${signed(asset.transferBytesDelta)} 전송)`;
    })
    .join("\n");
}

export function formatPwaCacheAssetTrendMarkdown(trend) {
  const lines = [
    "<!-- pwa-cache-asset-delta -->",
    "## PWA 오프라인 캐시 변화",
    "",
    trend.status === "initial"
      ? `비교 기준선이 없어 현재 배포 \`${trend.currentSha || "unknown"}\`의 자산 구성을 기록했습니다.`
      : `배포 \`${trend.baselineSha}\` → \`${trend.currentSha}\` 비교입니다.`,
    "",
    "| 구분 | 자산 수 | 원본 용량 | 전송 용량 |",
    "| --- | ---: | ---: | ---: |"
  ];
  for (const groupName of ["core", "features"]) {
    const group = trend.groups[groupName];
    lines.push(
      `| ${groupLabel(groupName)} | ${group.total} (${group.totalDelta >= 0 ? "+" : ""}${group.totalDelta})`
      + ` | ${group.rawBytes.toLocaleString("ko-KR")}B (${signed(group.rawBytesDelta)})`
      + ` | ${group.transferBytes.toLocaleString("ko-KR")}B (${signed(group.transferBytesDelta)}) |`
    );
  }
  lines.push(
    "",
    "### 새로 캐시에 들어온 파일",
    "",
    assetRows(trend.added, (asset) => `${asset.transferBytes.toLocaleString("ko-KR")}B 전송`),
    "",
    "### 용량이 바뀐 파일",
    "",
    assetRows(trend.changed, (asset) => `${signed(asset.transferBytesDelta)} 전송`),
    "",
    "### 해시가 교체된 번들",
    "",
    replacementRows(trend.replaced),
    "",
    "### 캐시에서 빠진 파일",
    "",
    assetRows(trend.removed, (asset) => `${asset.transferBytes.toLocaleString("ko-KR")}B 전송`),
    "",
    "### 논리 번들 변화 예산",
    "",
    `- 상태: **${trend.logicalChunkBudget?.status ?? "미측정"}**`,
    ...(trend.logicalChunkBudget?.issues?.length
      ? trend.logicalChunkBudget.issues.map((issue) => `- ${issue}`)
      : ["- 예산 초과 없음"]),
    ""
  );
  return lines.join("\n");
}

async function readHistory(historyPath) {
  try {
    const history = JSON.parse(await readFile(historyPath, "utf8"));
    return Array.isArray(history.samples) ? history.samples : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function writePwaCacheAssetTrend({
  outputDir,
  precache,
  metadata = {},
  summaryPath = null,
  baselineUrl = null
}) {
  await mkdir(outputDir, { recursive: true });
  const historyPath = path.join(outputDir, "pwa-cache-asset-trend-history.json");
  const reportPath = path.join(outputDir, "pwa-cache-asset-trend.json");
  const markdownPath = path.join(outputDir, "pwa-cache-asset-delta.md");
  const previousSamples = await readHistory(historyPath);
  const sample = pwaCacheAssetSample(precache, metadata);
  const storedPrevious = [...previousSamples].reverse()
    .find((candidate) => deploymentIdentity(candidate) !== deploymentIdentity(sample)) || null;
  const previous = await hydratePwaCacheAssetDigests(storedPrevious, baselineUrl);
  const compared = comparePwaCacheAssets(sample, previous);
  const trend = {
    ...compared,
    logicalChunkBudget: auditPwaLogicalChunkBudgets(sample, compared)
  };
  const hydratedHistory = storedPrevious && previous !== storedPrevious
    ? previousSamples.map((candidate) => deploymentIdentity(candidate) === deploymentIdentity(storedPrevious)
      ? previous : candidate)
    : previousSamples;
  const samples = mergePwaCacheAssetHistory(hydratedHistory, sample);
  const markdown = formatPwaCacheAssetTrendMarkdown(trend);
  await Promise.all([
    writeFile(historyPath, `${JSON.stringify({ version: 1, samples }, null, 2)}\n`),
    writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), trend }, null, 2)}\n`),
    writeFile(markdownPath, markdown)
  ]);
  if (summaryPath) await appendFile(summaryPath, `\n${markdown}\n`);
  return { historyPath, reportPath, markdownPath, trend, sampleCount: samples.length };
}

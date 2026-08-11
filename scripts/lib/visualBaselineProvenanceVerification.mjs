import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { visualBaselineArtifactSha256 } from "./visualBaselineProvenance.mjs";

const sha256Pattern = /^[a-f0-9]{64}$/;
const commitShaPattern = /^[a-f0-9]{40}$/;

export const visualBaselineContracts = Object.freeze([
  {
    id: "ios-safari",
    metadataPath: "scripts/visual-baselines/ios-safari-visual-regression.json",
    provenanceVersion: 3,
    baselinePath: ({ profileId, state }) => `scripts/visual-baselines/ios-safari-${profileId}-${state}.webp`
  },
  {
    id: "android-chrome",
    metadataPath: "scripts/visual-baselines/android-chrome-visual-regression.json",
    provenanceVersion: 3,
    baselinePath: ({ profileId, state }) => `scripts/visual-baselines/android-chrome-${profileId}-${state}.webp`
  },
  {
    id: "mobile-device",
    metadataPath: "scripts/visual-baselines/mobile-device-visual-regression.json",
    provenanceVersion: 5,
    baselinePath: ({ profileId, state }) => `scripts/visual-baselines/mobile-device-${profileId}-${state}.webp`
  },
  {
    id: "mobile-game",
    metadataPath: "scripts/visual-baselines/mobile-game-visual-regression.json",
    provenanceVersion: 2,
    baselinePath: () => "scripts/visual-baselines/mobile-game-visual-regression.webp",
    singleSha: true
  }
]);

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function auditVisualBaselineProvenance(metadata, provenanceVersion) {
  const issues = [];
  if (!Number.isInteger(metadata?.version)) return ["metadata version is missing"];
  if (metadata.version < provenanceVersion) return issues;
  const provenance = metadata.provenance;
  if (!provenance || typeof provenance !== "object") return ["required provenance is missing"];
  if (provenance.schemaVersion !== 1) issues.push("provenance schemaVersion must be 1");
  if (!["github-actions", "local"].includes(provenance.sourceKind)) {
    issues.push("provenance sourceKind is invalid");
  }
  if (!commitShaPattern.test(provenance.commitSha ?? "")) {
    issues.push("provenance commitSha must be a full SHA");
  }
  if (provenance.checksumAlgorithm !== "sha256") {
    issues.push("provenance checksumAlgorithm must be sha256");
  }
  const subjectKind = provenance.subjectKind ?? "capture-set";
  if (!["capture-set", "approved-baseline-set"].includes(subjectKind)) {
    issues.push("provenance subjectKind is invalid");
  }
  const expectedChecksumScope = subjectKind === "approved-baseline-set"
    ? "sorted-approved-baseline-set-manifest"
    : "sorted-capture-set-manifest";
  if (provenance.artifactChecksumScope !== expectedChecksumScope) {
    issues.push("provenance artifact checksum scope is invalid");
  }
  if (provenance.sourceKind === "github-actions") {
    if (!/^[0-9]+$/.test(provenance.runId ?? "")) {
      issues.push("GitHub provenance runId is invalid");
    }
    if (!provenance.runUrl?.includes(`/actions/runs/${provenance.runId}`)) {
      issues.push("GitHub provenance runUrl does not match runId");
    }
  }
  if (!Array.isArray(provenance.files) || provenance.files.length === 0) {
    issues.push("provenance files are missing");
    return issues;
  }
  const logicalPaths = provenance.files.map(({ logicalPath }) => logicalPath);
  if (logicalPaths.some((logicalPath) => typeof logicalPath !== "string" || logicalPath.trim() !== logicalPath || logicalPath.length === 0)) {
    issues.push("provenance logicalPath is invalid");
  }
  if (new Set(logicalPaths).size !== logicalPaths.length) {
    issues.push("provenance logicalPath values must be unique");
  }
  const sortedPaths = [...logicalPaths].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(logicalPaths) !== JSON.stringify(sortedPaths)) {
    issues.push("provenance files must be sorted by logicalPath");
  }
  for (const file of provenance.files) {
    if (!Number.isInteger(file.size) || file.size < 0) issues.push(`provenance file size is invalid: ${file.logicalPath}`);
    if (!sha256Pattern.test(file.sha256 ?? "")) issues.push(`provenance file sha256 is invalid: ${file.logicalPath}`);
  }
  if (provenance.artifactSha256 !== visualBaselineArtifactSha256(provenance.files)) {
    issues.push("provenance artifactSha256 does not match its capture manifest");
  }
  const captureRunId = metadata.capture?.runId;
  if (captureRunId != null && String(captureRunId) !== String(provenance.runId)) {
    issues.push("provenance runId does not match capture runId");
  }
  const captureSha = metadata.capture?.sha ?? metadata.capture?.commitSha;
  if (captureSha != null && captureSha !== provenance.commitSha) {
    issues.push("provenance commitSha does not match capture SHA");
  }
  return issues;
}

async function baselineHashIssues(rootDir, contract, metadata) {
  const issues = [];
  const subjects = contract.singleSha ? [{ sha256: metadata.sha256 }] : metadata.profiles;
  if (!Array.isArray(subjects) || subjects.length === 0) return ["baseline subjects are missing"];
  const paths = new Set();
  for (const subject of subjects) {
    const relativePath = contract.baselinePath(subject);
    if (paths.has(relativePath)) {
      issues.push(`duplicate baseline subject: ${relativePath}`);
      continue;
    }
    paths.add(relativePath);
    if (!sha256Pattern.test(subject.sha256 ?? "")) {
      issues.push(`baseline sha256 is invalid: ${relativePath}`);
      continue;
    }
    try {
      const actualSha = hash(await readFile(path.join(rootDir, relativePath)));
      if (actualSha !== subject.sha256) issues.push(`baseline checksum mismatch: ${relativePath}`);
    } catch (error) {
      issues.push(`baseline file unreadable: ${relativePath} (${error.code ?? error.message})`);
    }
  }
  return issues;
}

async function approvedBaselineProvenanceIssues(rootDir, contract, metadata) {
  if (metadata.provenance?.subjectKind !== "approved-baseline-set") return [];
  const subjects = contract.singleSha ? [{ sha256: metadata.sha256 }] : metadata.profiles;
  if (!Array.isArray(subjects) || subjects.length === 0) return ["approved baseline provenance subjects are missing"];
  const expectedPaths = subjects.map((subject) => contract.baselinePath(subject)).sort((left, right) => left.localeCompare(right));
  const provenanceFiles = metadata.provenance.files ?? [];
  if (JSON.stringify(provenanceFiles.map(({ logicalPath }) => logicalPath)) !== JSON.stringify(expectedPaths)) {
    return ["approved baseline provenance paths do not match baseline subjects"];
  }
  const issues = [];
  for (const file of provenanceFiles) {
    try {
      const absolutePath = path.join(rootDir, file.logicalPath);
      const [buffer, fileStat] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
      if (hash(buffer) !== file.sha256) issues.push(`approved baseline provenance checksum mismatch: ${file.logicalPath}`);
      if (fileStat.size !== file.size) issues.push(`approved baseline provenance size mismatch: ${file.logicalPath}`);
    } catch (error) {
      issues.push(`approved baseline provenance file unreadable: ${file.logicalPath} (${error.code ?? error.message})`);
    }
  }
  return issues;
}

export async function verifyVisualBaselineProvenance({ rootDir, contracts = visualBaselineContracts }) {
  const summaries = [];
  const issues = [];
  for (const contract of contracts) {
    let metadata;
    try {
      metadata = JSON.parse(await readFile(path.join(rootDir, contract.metadataPath), "utf8"));
    } catch (error) {
      issues.push(`${contract.id}: metadata unreadable (${error.code ?? error.message})`);
      continue;
    }
    const contractIssues = [
      ...await baselineHashIssues(rootDir, contract, metadata),
      ...auditVisualBaselineProvenance(metadata, contract.provenanceVersion),
      ...await approvedBaselineProvenanceIssues(rootDir, contract, metadata)
    ];
    issues.push(...contractIssues.map((issue) => `${contract.id}: ${issue}`));
    summaries.push({
      id: contract.id,
      version: metadata.version ?? null,
      status: contractIssues.length > 0
        ? "invalid" : metadata.version >= contract.provenanceVersion ? "verified" : "legacy",
      baselineCount: contract.singleSha ? 1 : Array.isArray(metadata.profiles) ? metadata.profiles.length : 0,
      issueCount: contractIssues.length
    });
  }
  return { passed: issues.length === 0, summaries, issues };
}

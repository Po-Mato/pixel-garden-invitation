import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildVisualBaselineProvenance } from "./visualBaselineProvenance.mjs";
import {
  verifyVisualBaselineProvenance,
  visualBaselineContracts
} from "./visualBaselineProvenanceVerification.mjs";

function trustedGithubEnvironment(env) {
  return env.GITHUB_ACTIONS === "true"
    && /^[0-9]+$/.test(env.GITHUB_RUN_ID ?? "")
    && /^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "")
    && /^[^/]+\/[^/]+$/.test(env.GITHUB_REPOSITORY ?? "");
}

export async function migrateVisualBaselineProvenance({
  rootDir,
  reason,
  env = process.env,
  now = new Date(),
  contracts = visualBaselineContracts
}) {
  if (!reason?.trim()) throw new Error("기준선 출처 재승인 사유가 필요합니다.");
  if (!trustedGithubEnvironment(env)) {
    throw new Error("기준선 출처 재승인은 신뢰된 GitHub Actions 실행에서만 가능합니다.");
  }
  const before = await verifyVisualBaselineProvenance({ rootDir, contracts });
  if (!before.passed) throw new Error(`기존 기준선 검증 실패:\n${before.issues.join("\n")}`);
  if (before.summaries.every(({ status }) => status === "verified")) {
    throw new Error("모든 시각 기준선 출처가 이미 현행 스키마입니다.");
  }

  const updates = [];
  for (const contract of contracts) {
    const metadataPath = path.join(rootDir, contract.metadataPath);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    const subjects = contract.singleSha ? [{}] : metadata.profiles;
    if (!Array.isArray(subjects) || subjects.length === 0) {
      throw new Error(`${contract.id} 기준선 대상이 없습니다.`);
    }
    const files = subjects.map((subject) => {
      const logicalPath = contract.baselinePath(subject);
      return { logicalPath, filePath: path.join(rootDir, logicalPath) };
    });
    const provenance = await buildVisualBaselineProvenance({
      rootDir,
      files,
      env,
      subjectKind: "approved-baseline-set"
    });
    const migrated = {
      ...metadata,
      version: Math.max(metadata.version ?? 0, contract.provenanceVersion),
      provenance,
      provenanceApproval: {
        kind: "unchanged-baseline-provenance-migration",
        approvedAt: now.toISOString(),
        reason: reason.trim(),
        previousVersion: metadata.version ?? null,
        baselinePixelsChanged: false,
        baselineCount: files.length,
        runId: String(env.GITHUB_RUN_ID),
        commitSha: env.GITHUB_SHA
      }
    };
    updates.push({ id: contract.id, metadataPath, metadata: migrated });
  }

  await Promise.all(updates.map(({ metadataPath, metadata }) => (
    writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
  )));
  const after = await verifyVisualBaselineProvenance({ rootDir, contracts });
  if (!after.passed || after.summaries.some(({ status }) => status !== "verified")) {
    throw new Error(`현행 기준선 출처 검증 실패:\n${after.issues.join("\n")}`);
  }
  return { updates, before, after };
}

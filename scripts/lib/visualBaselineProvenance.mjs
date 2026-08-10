import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function currentCommitSha(rootDir) {
  if (!rootDir) return null;
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: rootDir });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function buildVisualBaselineProvenance({ rootDir, files, captureReport = {}, env = process.env }) {
  if (!Array.isArray(files) || files.length === 0) throw new Error("시각 기준선 출처 파일이 필요합니다.");
  const sourceFiles = await Promise.all(files.map(async ({ logicalPath, filePath }) => {
    if (!logicalPath?.trim() || !filePath) throw new Error("시각 기준선 출처 파일 경로가 올바르지 않습니다.");
    const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    return {
      logicalPath: logicalPath.trim(),
      size: fileStat.size,
      sha256: sha256(buffer)
    };
  }));
  sourceFiles.sort((left, right) => left.logicalPath.localeCompare(right.logicalPath));
  const runId = captureReport.runId ?? env.GITHUB_RUN_ID ?? null;
  const runAttempt = Number(captureReport.runAttempt ?? env.GITHUB_RUN_ATTEMPT) || null;
  const commitSha = captureReport.sha ?? captureReport.commitSha ?? env.GITHUB_SHA ?? await currentCommitSha(rootDir);
  const serverUrl = env.GITHUB_SERVER_URL ?? "https://github.com";
  const repository = env.GITHUB_REPOSITORY;
  const runUrl = captureReport.runUrl ?? (runId && repository ? `${serverUrl}/${repository}/actions/runs/${runId}` : null);
  return {
    schemaVersion: 1,
    sourceKind: runId ? "github-actions" : "local",
    runId: runId ? String(runId) : null,
    runAttempt,
    commitSha,
    runUrl,
    checksumAlgorithm: "sha256",
    artifactChecksumScope: "sorted-capture-set-manifest",
    artifactSha256: sha256(JSON.stringify(sourceFiles)),
    files: sourceFiles
  };
}

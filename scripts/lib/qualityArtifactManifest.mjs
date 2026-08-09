import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const children = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(entryPath) : [entryPath];
  }));
  return children.flat();
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export function qualityArtifactRetentionClass(logicalPath) {
  if (/-diff\.png$/i.test(logicalPath)) return "failure-diff-14d";
  if (/\.(json|md|html)$/i.test(logicalPath)) return "metadata-30d";
  if (/\.(png|webp|avif|jpe?g)$/i.test(logicalPath)) return "visual-evidence-7d";
  if (/\.(log|txt)$/i.test(logicalPath)) return "diagnostic-log-7d";
  return "ephemeral-evidence-7d";
}

export function createQualityArtifactManifest(entries, generatedAt = new Date().toISOString()) {
  const canonicalByDigest = new Map();
  let totalBytes = 0;
  let uniqueBytes = 0;
  const files = [...entries].sort((left, right) => left.path.localeCompare(right.path)).map((entry) => {
    totalBytes += entry.size;
    const duplicateOf = canonicalByDigest.get(entry.sha256) ?? null;
    if (duplicateOf === null) {
      canonicalByDigest.set(entry.sha256, entry.path);
      uniqueBytes += entry.size;
    }
    return {
      path: entry.path,
      size: entry.size,
      sha256: entry.sha256,
      duplicateOf,
      retentionClass: qualityArtifactRetentionClass(entry.path)
    };
  });
  return {
    version: 1,
    generatedAt,
    totals: {
      files: files.length,
      uniqueFiles: canonicalByDigest.size,
      duplicateFiles: files.length - canonicalByDigest.size,
      totalBytes,
      uniqueBytes,
      duplicateBytes: totalBytes - uniqueBytes
    },
    files
  };
}

export async function buildQualityArtifactManifest(inputDir) {
  const filePaths = await filesBelow(inputDir);
  const entries = [];
  for (const filePath of filePaths) {
    const metadata = await stat(filePath);
    entries.push({
      path: path.relative(inputDir, filePath).split(path.sep).join("/"),
      size: metadata.size,
      sha256: await sha256File(filePath)
    });
  }
  return createQualityArtifactManifest(entries);
}

export function formatQualityArtifactManifestMarkdown(manifest) {
  const { totals } = manifest;
  return [
    "## 품질 증거 저장소 요약",
    "",
    `- 파일: ${totals.files}개 · 고유 ${totals.uniqueFiles}개 · 중복 ${totals.duplicateFiles}개`,
    `- 전체: ${totals.totalBytes} bytes · 고유: ${totals.uniqueBytes} bytes · 중복 절감 후보: ${totals.duplicateBytes} bytes`,
    "",
    "중복 파일은 `duplicateOf`의 체크섬으로 검증하며, 성공 스크린샷은 7일·실패 diff는 14일·JSON 요약은 30일 보존합니다.",
    ""
  ].join("\n");
}

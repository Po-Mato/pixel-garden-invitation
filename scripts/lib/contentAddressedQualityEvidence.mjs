import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const inlineExtensions = new Set([".json", ".md", ".html", ".log", ".txt", ".xml"]);

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const children = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(entryPath) : entry.isFile() ? [entryPath] : [];
  }));
  return children.flat();
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function logicalPathWithin(root, filePath) {
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`품질 증거 경로가 입력 폴더를 벗어났어요: ${filePath}`);
  }
  return relative.split(path.sep).join("/");
}

function resolvedLogicalPath(root, logicalPath) {
  if (!logicalPath || path.isAbsolute(logicalPath) || logicalPath.split("/").includes("..")) {
    throw new Error(`안전하지 않은 품질 증거 경로: ${logicalPath}`);
  }
  const resolved = path.resolve(root, ...logicalPath.split("/"));
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error(`품질 증거 복원 경로가 출력 폴더를 벗어났어요: ${logicalPath}`);
  }
  return resolved;
}

function assertSeparateDirectories(inputDir, outputDir) {
  const input = path.resolve(inputDir);
  const output = path.resolve(outputDir);
  const relative = path.relative(input, output);
  if (input === output || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error("콘텐츠 주소형 출력 폴더는 입력 폴더 밖에 있어야 합니다.");
  }
}

export async function packContentAddressedQualityEvidence({
  inputDir,
  outputDir,
  excludeSuffixes = [],
  generatedAt = new Date().toISOString()
}) {
  assertSeparateDirectories(inputDir, outputDir);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const objectPaths = new Map();
  const files = [];
  let totalBytes = 0;
  let storedBytes = 0;
  for (const filePath of (await filesBelow(inputDir)).sort()) {
    const logicalPath = logicalPathWithin(inputDir, filePath);
    if (excludeSuffixes.some((suffix) => logicalPath.endsWith(suffix))) continue;
    const metadata = await stat(filePath);
    const sha256 = await sha256File(filePath);
    const extension = path.extname(logicalPath).toLowerCase();
    const inline = inlineExtensions.has(extension);
    let storagePath;
    let duplicateOf = null;
    if (inline) {
      storagePath = `metadata/${logicalPath}`;
      const target = resolvedLogicalPath(outputDir, storagePath);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(filePath, target);
      storedBytes += metadata.size;
    } else {
      storagePath = objectPaths.get(sha256) ?? `objects/sha256/${sha256.slice(0, 2)}/${sha256}`;
      duplicateOf = objectPaths.has(sha256) ? storagePath : null;
      if (!objectPaths.has(sha256)) {
        objectPaths.set(sha256, storagePath);
        const target = resolvedLogicalPath(outputDir, storagePath);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(filePath, target);
        storedBytes += metadata.size;
      }
    }
    totalBytes += metadata.size;
    files.push({
      logicalPath,
      storage: inline ? "metadata" : "sha256",
      storagePath,
      size: metadata.size,
      sha256,
      duplicateOf
    });
  }
  const manifest = {
    version: 1,
    generatedAt,
    format: "content-addressed-quality-evidence",
    totals: {
      files: files.length,
      storedObjects: new Set(files.map(({ storagePath }) => storagePath)).size,
      totalBytes,
      storedBytes,
      omittedDuplicateBytes: totalBytes - storedBytes
    },
    files
  };
  await writeFile(
    path.join(outputDir, "quality-evidence-index.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  return manifest;
}

export async function materializeContentAddressedQualityEvidence({ inputDir, outputDir }) {
  assertSeparateDirectories(inputDir, outputDir);
  const manifest = JSON.parse(await readFile(path.join(inputDir, "quality-evidence-index.json"), "utf8"));
  if (manifest.format !== "content-addressed-quality-evidence" || manifest.version !== 1) {
    throw new Error("지원하지 않는 품질 증거 패키지입니다.");
  }
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  for (const entry of manifest.files) {
    const source = resolvedLogicalPath(inputDir, entry.storagePath);
    const target = resolvedLogicalPath(outputDir, entry.logicalPath);
    const metadata = await stat(source);
    const sha256 = await sha256File(source);
    if (metadata.size !== entry.size || sha256 !== entry.sha256) {
      throw new Error(`품질 증거 체크섬 불일치: ${entry.logicalPath}`);
    }
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  return manifest;
}

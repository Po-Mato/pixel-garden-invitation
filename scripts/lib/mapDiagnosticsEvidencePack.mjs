import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { verifyMapDiagnosticsProvenanceSubjects } from "./mapDiagnosticsProvenance.mjs";

const tarBlockSize = 512;
const manifestEntry = "map-diagnostics-provenance.json";
const readmeEntry = "VERIFY.md";
const checksumsEntry = "SHA256SUMS";
const subjectPrefix = "subjects/";
const maxPackBytes = 128 * 1024 * 1024;

function safeEntryPath(filePath) {
  if (typeof filePath !== "string" || filePath === "" || filePath.startsWith("/") || filePath.split(/[\\/]/).includes("..")) {
    throw new Error(`Evidence Pack 경로가 안전하지 않습니다: ${filePath}`);
  }
  return filePath.replaceAll("\\", "/");
}

function splitTarPath(filePath) {
  const source = Buffer.from(filePath);
  if (source.byteLength <= 100) return { name: filePath, prefix: "" };
  for (let index = filePath.lastIndexOf("/"); index > 0; index = filePath.lastIndexOf("/", index - 1)) {
    const prefix = filePath.slice(0, index);
    const name = filePath.slice(index + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { name, prefix };
  }
  throw new Error(`Evidence Pack 경로가 tar 한도를 넘었습니다: ${filePath}`);
}

function writeString(target, offset, length, value) {
  const source = Buffer.from(value);
  if (source.byteLength > length) throw new Error(`tar 헤더 값이 너무 깁니다: ${value}`);
  source.copy(target, offset);
}

function writeOctal(target, offset, length, value) {
  const encoded = `${Math.trunc(value).toString(8).padStart(length - 1, "0")}\0`;
  writeString(target, offset, length, encoded);
}

function tarHeader(filePath, size) {
  const header = Buffer.alloc(tarBlockSize);
  const { name, prefix } = splitTarPath(filePath);
  writeString(header, 0, 100, name);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeString(header, 257, 6, "ustar\0");
  writeString(header, 263, 2, "00");
  writeString(header, 345, 155, prefix);
  const checksum = header.reduce((total, byte) => total + byte, 0);
  writeString(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return header;
}

function parseOctal(source, label) {
  const value = source.toString("ascii").replaceAll("\0", "").trim();
  if (!/^[0-7]*$/.test(value)) throw new Error(`Evidence Pack ${label} tar 값이 올바르지 않습니다`);
  return value === "" ? 0 : Number.parseInt(value, 8);
}

export function buildMapDiagnosticsEvidencePack(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error("Evidence Pack 파일이 필요합니다");
  const seen = new Set();
  const chunks = [];
  for (const file of files) {
    const filePath = safeEntryPath(file.path);
    if (seen.has(filePath)) throw new Error(`Evidence Pack 경로가 중복되었습니다: ${filePath}`);
    seen.add(filePath);
    const source = Buffer.isBuffer(file.source) ? file.source : Buffer.from(file.source);
    if (source.byteLength > maxPackBytes) throw new Error(`Evidence Pack 파일이 너무 큽니다: ${filePath}`);
    chunks.push(tarHeader(filePath, source.byteLength), source);
    const padding = (tarBlockSize - (source.byteLength % tarBlockSize)) % tarBlockSize;
    if (padding) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(tarBlockSize * 2));
  return gzipSync(Buffer.concat(chunks), { level: 9, mtime: 0 });
}

export function readMapDiagnosticsEvidencePack(packSource) {
  const archive = gunzipSync(packSource, { maxOutputLength: maxPackBytes });
  const entries = new Map();
  let offset = 0;
  while (offset + tarBlockSize <= archive.byteLength) {
    const header = archive.subarray(offset, offset + tarBlockSize);
    if (header.every((byte) => byte === 0)) break;
    const storedChecksum = parseOctal(header.subarray(148, 156), "header checksum");
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const actualChecksum = checksumHeader.reduce((total, byte) => total + byte, 0);
    if (storedChecksum !== actualChecksum) throw new Error("Evidence Pack tar 헤더 체크섬이 올바르지 않습니다");
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const filePath = safeEntryPath(prefix ? `${prefix}/${name}` : name);
    const type = String.fromCharCode(header[156] || 0);
    if (type !== "0" && type !== "\0") throw new Error(`Evidence Pack은 일반 파일만 허용합니다: ${filePath}`);
    const size = parseOctal(header.subarray(124, 136), `${filePath} size`);
    const dataStart = offset + tarBlockSize;
    const dataEnd = dataStart + size;
    if (size > maxPackBytes || dataEnd > archive.byteLength) throw new Error(`Evidence Pack 파일이 잘렸습니다: ${filePath}`);
    if (entries.has(filePath)) throw new Error(`Evidence Pack 경로가 중복되었습니다: ${filePath}`);
    entries.set(filePath, Buffer.from(archive.subarray(dataStart, dataEnd)));
    offset = dataStart + Math.ceil(size / tarBlockSize) * tarBlockSize;
  }
  return entries;
}

export function buildMapDiagnosticsEvidenceReadme(manifest) {
  return [
    "# Map Diagnostics Evidence Pack",
    "",
    `- repository: ${manifest.source.repository}`,
    `- commit: ${manifest.source.sha}`,
    `- workflow run: ${manifest.source.runId}`,
    `- subjects: ${manifest.subjects.length}`,
    "",
    `1. 온라인 서명 검증: \`${manifest.verification.command}\``,
    `2. 오프라인 서명 검증: \`${manifest.verification.offlineCommand}\``,
    `3. 대상 압축 해제: \`tar -xzf map-diagnostics-evidence-pack.tgz\``,
    `4. 5개 대상 검증: \`shasum -a 256 -c SHA256SUMS\``,
    ""
  ].join("\n");
}

export function buildMapDiagnosticsEvidenceChecksums(manifest) {
  return `${manifest.subjects.map(({ path, sha256 }) => `${sha256}  ${subjectPrefix}${safeEntryPath(path)}`).join("\n")}\n`;
}

export function createMapDiagnosticsEvidencePack(manifestSource, subjects) {
  const manifest = JSON.parse(Buffer.from(manifestSource).toString("utf8"));
  verifyMapDiagnosticsProvenanceSubjects(manifest, subjects);
  const byPath = new Map(subjects.map((subject) => [safeEntryPath(subject.path), subject.source]));
  return buildMapDiagnosticsEvidencePack([
    { path: manifestEntry, source: manifestSource },
    { path: readmeEntry, source: buildMapDiagnosticsEvidenceReadme(manifest) },
    { path: checksumsEntry, source: buildMapDiagnosticsEvidenceChecksums(manifest) },
    ...manifest.subjects.map(({ path }) => {
      const safePath = safeEntryPath(path);
      return { path: `${subjectPrefix}${safePath}`, source: byPath.get(safePath) };
    })
  ]);
}

export function verifyMapDiagnosticsEvidencePack(packSource) {
  const entries = readMapDiagnosticsEvidencePack(packSource);
  const manifestSource = entries.get(manifestEntry);
  if (!manifestSource) throw new Error("Evidence Pack 매니페스트가 없습니다");
  const manifest = JSON.parse(manifestSource.toString("utf8"));
  const expected = new Set([manifestEntry, readmeEntry, checksumsEntry, ...manifest.subjects.map(({ path }) => `${subjectPrefix}${safeEntryPath(path)}`)]);
  const unexpected = [...entries.keys()].filter((entry) => !expected.has(entry));
  const missing = [...expected].filter((entry) => !entries.has(entry));
  if (unexpected.length || missing.length) throw new Error(`Evidence Pack 구성 불일치 · 누락 ${missing.join(",") || "없음"} · 추가 ${unexpected.join(",") || "없음"}`);
  if (entries.get(checksumsEntry).toString("utf8") !== buildMapDiagnosticsEvidenceChecksums(manifest)) {
    throw new Error("Evidence Pack SHA256SUMS가 매니페스트와 일치하지 않습니다");
  }
  const subjects = manifest.subjects.map(({ path }) => {
    const safePath = safeEntryPath(path);
    return { path: safePath, source: entries.get(`${subjectPrefix}${safePath}`) };
  });
  const result = verifyMapDiagnosticsProvenanceSubjects(manifest, subjects);
  return {
    manifest,
    verifiedCount: result.verifiedCount,
    packChecksum: createHash("sha256").update(packSource).digest("hex")
  };
}

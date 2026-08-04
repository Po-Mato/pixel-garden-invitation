import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { verifyMapDiagnosticsProvenanceSubjects } from "./lib/mapDiagnosticsProvenance.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function argumentValue(name, fallback) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; }
const manifestPath = path.resolve(rootDir, argumentValue("--manifest", ".superpowers/visual-regression/map-diagnostics-provenance.json"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
function subjectPath(relativePath) {
  const resolved = path.resolve(rootDir, relativePath);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`출처 증명 대상 경로가 안전하지 않습니다: ${relativePath}`);
  return resolved;
}
const subjects = await Promise.all(manifest.subjects.map(async ({ path: relativePath }) => ({
  path: relativePath,
  source: await readFile(subjectPath(relativePath))
})));
const result = verifyMapDiagnosticsProvenanceSubjects(manifest, subjects);
console.log(`맵 진단 출처 대상 검증 통과: ${result.verifiedCount}개`);

import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildMapDiagnosticsEvidenceReadme, createMapDiagnosticsEvidencePack } from "./lib/mapDiagnosticsEvidencePack.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function argumentValue(name, fallback) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; }
const manifestPath = path.resolve(rootDir, argumentValue("--manifest", ".superpowers/visual-regression/map-diagnostics-provenance.json"));
const outputPath = path.resolve(rootDir, argumentValue("--out", ".superpowers/visual-regression/map-diagnostics-evidence-pack.tgz"));
const readmePath = path.resolve(rootDir, argumentValue("--readme-out", ".superpowers/visual-regression/map-diagnostics-evidence-pack-VERIFY.md"));
const manifestSource = await readFile(manifestPath);
const manifest = JSON.parse(manifestSource.toString("utf8"));
function subjectPath(relativePath) {
  const resolved = path.resolve(rootDir, relativePath);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Evidence Pack 대상 경로가 안전하지 않습니다: ${relativePath}`);
  return resolved;
}
const subjects = await Promise.all(manifest.subjects.map(async ({ path: relativePath }) => ({
  path: relativePath,
  source: await readFile(subjectPath(relativePath))
})));
const pack = createMapDiagnosticsEvidencePack(manifestSource, subjects);
await Promise.all([mkdir(path.dirname(outputPath), { recursive: true }), mkdir(path.dirname(readmePath), { recursive: true })]);
await Promise.all([writeFile(outputPath, pack), writeFile(readmePath, buildMapDiagnosticsEvidenceReadme(manifest))]);
console.log(`맵 진단 Evidence Pack 생성: ${manifest.subjects.length}개 · ${(pack.byteLength / 1024).toFixed(1)} KiB`);
console.log(outputPath);

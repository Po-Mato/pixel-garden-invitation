import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildMapDiagnosticsProvenance } from "./lib/mapDiagnosticsProvenance.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function argumentValue(name, fallback) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; }
const subjectPaths = [
  ".superpowers/visual-regression/map-diagnostics-browser/map-diagnostics-browser-report.json",
  ".superpowers/visual-regression/world-geometry-policy-report.json",
  ".superpowers/visual-regression/world-geometry-policy-tuning.json",
  ".superpowers/visual-regression/world-geometry-policy-governance.json",
  ".superpowers/visual-regression/map-foreground-suggestions.patch.json"
];
const subjects = [];
for (const relativePath of subjectPaths) {
  try { subjects.push({ path: relativePath, source: await readFile(path.join(rootDir, relativePath)) }); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
}
const manifest = buildMapDiagnosticsProvenance(subjects, {
  sha: argumentValue("--sha", process.env.GITHUB_SHA ?? "0".repeat(40)),
  runId: argumentValue("--run-id", process.env.GITHUB_RUN_ID ?? "local"),
  repository: argumentValue("--repository", process.env.GITHUB_REPOSITORY ?? "Po-Mato/pixel-garden-invitation"),
  generatedAt: argumentValue("--generated-at", new Date().toISOString())
});
const outputPath = path.resolve(rootDir, argumentValue("--out", ".superpowers/visual-regression/map-diagnostics-provenance.json"));
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`맵 진단 출처 매니페스트: ${manifest.subjects.length}개 · ${manifest.source.sha.slice(0, 12)}`);
console.log(outputPath);

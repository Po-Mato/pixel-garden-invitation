import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildMapDiagnosticsProvenanceSummary } from "./lib/mapDiagnosticsProvenance.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function argumentValue(name, fallback) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; }
const manifestPath = path.resolve(rootDir, argumentValue("--manifest", ".superpowers/visual-regression/map-diagnostics-provenance.json"));
const outputPath = path.resolve(rootDir, argumentValue("--out", ".superpowers/visual-regression/map-diagnostics-provenance.md"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const markdown = buildMapDiagnosticsProvenanceSummary(manifest, {
  attestationUrl: argumentValue("--attestation-url", ""),
  runUrl: argumentValue("--run-url", "")
});
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, markdown);
console.log(`맵 진단 출처 요약: ${manifest.subjects.length}개 · ${argumentValue("--attestation-url", "") ? "signed" : "awaiting-signature"}`);
console.log(outputPath);

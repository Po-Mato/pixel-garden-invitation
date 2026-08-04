import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { verifyMapDiagnosticsEvidencePack } from "./lib/mapDiagnosticsEvidencePack.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function argumentValue(name, fallback) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; }
const packPath = path.resolve(rootDir, argumentValue("--pack", ".superpowers/visual-regression/map-diagnostics-evidence-pack.tgz"));
const result = verifyMapDiagnosticsEvidencePack(await readFile(packPath));
console.log(`맵 진단 Evidence Pack 검증 통과: ${result.verifiedCount}개 · ${result.packChecksum.slice(0, 12)}`);

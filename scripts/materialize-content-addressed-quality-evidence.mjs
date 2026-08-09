import path from "node:path";
import { fileURLToPath } from "node:url";
import { materializeContentAddressedQualityEvidence } from "./lib/contentAddressedQualityEvidence.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const inputDir = path.resolve(option("--input-dir", path.join(rootDir, ".superpowers/quality-evidence-package")));
const outputDir = path.resolve(option("--output-dir", path.join(rootDir, ".superpowers/quality-evidence-restored")));
const manifest = await materializeContentAddressedQualityEvidence({ inputDir, outputDir });
console.log(`품질 증거 복원 및 체크섬 검증: ${manifest.totals.files}개`);

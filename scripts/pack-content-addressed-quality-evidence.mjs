import path from "node:path";
import { fileURLToPath } from "node:url";
import { packContentAddressedQualityEvidence } from "./lib/contentAddressedQualityEvidence.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const options = (name) => process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : []);
const inputDir = path.resolve(option("--input-dir", path.join(rootDir, ".superpowers/visual-regression")));
const outputDir = path.resolve(option("--output-dir", path.join(rootDir, ".superpowers/quality-evidence-package")));
const manifest = await packContentAddressedQualityEvidence({
  inputDir,
  outputDir,
  excludeSuffixes: options("--exclude-suffix")
});
console.log(
  `콘텐츠 주소형 품질 증거: ${manifest.totals.files}개 · 실제 저장 ${manifest.totals.storedObjects}개`
  + ` · 중복 ${manifest.totals.omittedDuplicateBytes} bytes 제외`
);

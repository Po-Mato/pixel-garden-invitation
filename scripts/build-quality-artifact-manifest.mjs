import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildQualityArtifactManifest,
  formatQualityArtifactManifestMarkdown
} from "./lib/qualityArtifactManifest.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const inputDir = path.resolve(option("--input-dir", path.join(rootDir, ".superpowers/visual-regression")));
const outputDir = path.resolve(option("--output-dir", path.join(rootDir, ".superpowers/visual-regression/release-quality-summary")));
const manifest = await buildQualityArtifactManifest(inputDir);
const markdown = formatQualityArtifactManifestMarkdown(manifest);
await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, "quality-artifact-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(path.join(outputDir, "quality-artifact-manifest.md"), markdown)
]);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}\n`);
console.log(`품질 증거 체크섬: ${manifest.totals.files}개 · 중복 ${manifest.totals.duplicateFiles}개/${manifest.totals.duplicateBytes} bytes`);

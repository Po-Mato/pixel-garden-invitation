import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedReleaseQualityHistory } from "./lib/releaseQualityTrend.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const inputDir = path.resolve(option("--input-dir", path.join(rootDir, ".superpowers/visual-regression/release-quality-seed")));
const historyPath = path.resolve(option(
  "--history",
  path.join(rootDir, ".superpowers/visual-regression/release-quality-summary/release-quality-history.json")
));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const children = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(entryPath) : [entryPath];
  }));
  return children.flat();
}

const files = await filesBelow(inputDir);
const summaryPaths = files.filter((filePath) => path.basename(filePath) === "release-quality-summary.json");
const summaries = await Promise.all(summaryPaths.map((filePath) => readFile(filePath, "utf8").then(JSON.parse)));
const currentHistory = await readFile(historyPath, "utf8").then(JSON.parse, () => ({ version: 1, snapshots: [] }));
const seeded = seedReleaseQualityHistory(currentHistory, summaries);
await mkdir(path.dirname(historyPath), { recursive: true });
await writeFile(historyPath, `${JSON.stringify(seeded, null, 2)}\n`);
console.log(`릴리스 품질 이력 시드: ${seeded.snapshots.length}개`);

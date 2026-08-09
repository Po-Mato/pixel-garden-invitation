import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  mergeProductionNetworkPwaTrendRuns,
  productionNetworkPwaTrendSample
} from "./lib/productionNetworkPwaCanary.mjs";

const run = promisify(execFile);
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const outputDir = option(
  "--output",
  path.join(rootDir, ".superpowers/visual-regression/production-network-pwa-canary")
);
const historyPath = path.join(outputDir, "production-network-pwa-trend-history.json");

async function repositoryName() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const result = await run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  return result.stdout.trim();
}

async function existingRuns() {
  try {
    const history = JSON.parse(await readFile(historyPath, "utf8"));
    return Array.isArray(history.runs) ? history.runs : [];
  } catch {
    return [];
  }
}

async function reportPathIn(directory) {
  const entries = await readdir(directory, { recursive: true });
  const relativePath = entries.find((entry) => path.basename(entry) === "production-network-pwa-canary-report.json");
  return relativePath ? path.join(directory, relativePath) : null;
}

const repository = await repositoryName();
const listed = await run("gh", [
  "run", "list", "--repo", repository, "--workflow", "pages.yml", "--status", "success",
  "--limit", "8", "--json", "databaseId"
]);
const runs = JSON.parse(listed.stdout);
const downloaded = [];
for (const { databaseId } of runs) {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "wedding-pwa-trend-"));
  try {
    await run("gh", [
      "run", "download", String(databaseId), "--repo", repository,
      "--name", "production-network-pwa-canary", "--dir", temporaryDirectory
    ]);
    const reportPath = await reportPathIn(temporaryDirectory);
    if (!reportPath) continue;
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    const sample = productionNetworkPwaTrendSample(report, databaseId);
    if (sample) downloaded.push(sample);
  } catch {
    // Older successful deployments may predate this artifact and are skipped.
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

const merged = mergeProductionNetworkPwaTrendRuns(await existingRuns(), downloaded);
await mkdir(outputDir, { recursive: true });
await writeFile(historyPath, `${JSON.stringify({ version: 1, runs: merged }, null, 2)}\n`);
console.log(`공개 PWA 배포 추세 초기화: 유효한 이전 배포 ${merged.filter(({ status }) => status === "passed").length}건`);
console.log(`이력: ${historyPath}`);

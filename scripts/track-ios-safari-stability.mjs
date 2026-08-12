import { execFile } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  buildIosSafariStabilityTrend,
  formatIosSafariStabilityMarkdown,
  iosSafariStabilityPolicy,
  markApprovedIosSafariVisualFailures,
  mergeIosSafariStabilityHistory
} from "./lib/iosSafariStabilityTrend.mjs";

const execFileAsync = promisify(execFile);

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const outputDir = path.resolve(option(
  "--output-dir",
  path.join(rootDir, ".superpowers/visual-regression/ios-safari-stability")
));
const historyPath = path.join(outputDir, "ios-safari-stability-trend-history.json");
const reportPath = path.join(outputDir, "ios-safari-stability-trend.json");
const markdownPath = path.join(outputDir, "ios-safari-stability-trend.md");

async function readHistory() {
  try {
    const parsed = JSON.parse(await readFile(historyPath, "utf8"));
    return Array.isArray(parsed.samples) ? parsed.samples : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function githubRunSamples() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  if (!repository || !token) return [];
  const endpoint = `https://api.github.com/repos/${repository}/actions/workflows/ios-safari-visual.yml/runs?status=completed&per_page=30`;
  const response = await fetch(endpoint, {
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28" }
  });
  if (!response.ok) throw new Error(`GitHub iOS workflow history ${response.status}`);
  const body = await response.json();
  return (body.workflow_runs ?? []).map((run) => ({
    runId: String(run.id),
    runAttempt: Number(run.run_attempt) || 1,
    sha: run.head_sha,
    outcome: run.conclusion === "success" ? "success" : run.conclusion === "cancelled" ? "cancelled" : "failure",
    durationMs: Math.max(0, Date.parse(run.updated_at) - Date.parse(run.created_at)),
    generatedAt: run.created_at,
    policyRevision: 0,
    url: run.html_url
  }));
}

async function currentGithubRun() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  const runId = option("--run-id", process.env.GITHUB_RUN_ID);
  if (!repository || !token || !runId) return null;
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${runId}`, {
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28" }
  });
  if (!response.ok) return null;
  const run = await response.json();
  const startedAt = run.run_started_at || run.created_at;
  const createdAt = run.created_at || startedAt;
  return {
    generatedAt: startedAt,
    durationMs: Math.max(0, Date.now() - Date.parse(createdAt)),
    queueDurationMs: Math.max(0, Date.parse(startedAt) - Date.parse(createdAt)),
    url: run.html_url
  };
}

async function approvedVisualBaselineCommitSha() {
  try {
    const metadata = JSON.parse(await readFile(
      path.join(rootDir, "scripts/visual-baselines/ios-safari-visual-regression.json"),
      "utf8"
    ));
    const commitSha = metadata.provenance?.commitSha;
    return metadata.provenance?.sourceKind === "github-actions" && /^[a-f0-9]{40}$/.test(commitSha ?? "")
      ? commitSha : null;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function isApprovedCommitAncestor(ancestor, descendant) {
  if (ancestor === descendant) return true;
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  if (repository && token) {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/compare/${ancestor}...${descendant}`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": "2022-11-28"
        }
      }
    );
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`GitHub approved baseline ancestry ${response.status}`);
    const comparison = await response.json();
    return comparison.status === "ahead" || comparison.status === "identical";
  }
  try {
    await execFileAsync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: rootDir });
    return true;
  } catch (error) {
    if (error?.code === 1) return false;
    throw error;
  }
}

await mkdir(outputDir, { recursive: true });
let samples = mergeIosSafariStabilityHistory(await readHistory(), await githubRunSamples());
const requestedOutcome = option("--outcome");
const currentOutcome = ["success", "failure", "cancelled"].includes(requestedOutcome)
  ? requestedOutcome : null;
if (currentOutcome) {
  const currentRun = await currentGithubRun();
  samples = mergeIosSafariStabilityHistory(samples, [{
    runId: option("--run-id", process.env.GITHUB_RUN_ID),
    runAttempt: option("--run-attempt", process.env.GITHUB_RUN_ATTEMPT),
    sha: option("--sha", process.env.GITHUB_SHA),
    outcome: currentOutcome,
    durationMs: currentRun?.durationMs ?? Number(option("--duration-ms", 0)),
    queueDurationMs: currentRun?.queueDurationMs ?? Number(option("--queue-duration-ms", 0)),
    setupDurationMs: Number(option("--setup-duration-ms", 0)),
    captureDurationMs: Number(option("--capture-duration-ms", 0)),
    capturePhaseDurationsMs: option("--capture-phase-timings-json", "{}"),
    capturePhaseSchemaVersion: iosSafariStabilityPolicy.capturePhaseSchemaVersion,
    bridgeInstallDurationMs: Number(option("--bridge-install-duration-ms", 0)),
    appiumCacheHit: option("--appium-cache-hit", "false") === "true",
    compositorRecoveryCount: Number(option("--compositor-recovery-count", 0)),
    compositorRecoveryDurationMs: Number(option("--compositor-recovery-duration-ms", 0)),
    compositorFaultInjected: option("--compositor-fault-injected", "false") === "true",
    compositorFaultRecovered: option("--compositor-fault-recovered", "false") === "true",
    compositorRecoveryStrategy: option("--compositor-recovery-strategy"),
    failureCategory: option("--failure-category"),
    failureKind: option("--failure-kind"),
    retryAttempted: option("--retry-attempted", "false") === "true",
    retryRecovered: option("--retry-recovered", "false") === "true",
    retryFailureCategory: option("--retry-failure-category"),
    retryFailureKind: option("--retry-failure-kind"),
    wdaMode: option("--wda-mode", "source-build"),
    generatedAt: currentRun?.generatedAt ?? option("--generated-at", new Date().toISOString()),
    policyRevision: iosSafariStabilityPolicy.policyRevision,
    url: currentRun?.url ?? option("--run-url")
  }]);
}
samples = await markApprovedIosSafariVisualFailures({
  samples,
  approvedCommitSha: await approvedVisualBaselineCommitSha(),
  isAncestor: isApprovedCommitAncestor
});
const trend = buildIosSafariStabilityTrend(samples);
const markdown = formatIosSafariStabilityMarkdown(trend);
await Promise.all([
  writeFile(historyPath, `${JSON.stringify({ version: 1, samples }, null, 2)}\n`),
  writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), trend }, null, 2)}\n`),
  writeFile(markdownPath, markdown)
]);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}\n`);
console.log(`iOS Safari CI 안정성: 최근 10회 ${trend.observed.status} · 강화 후 ${trend.acceptance.status}`);
for (const issue of [...trend.observed.issues, ...trend.acceptance.issues]) console.log(`- ${issue}`);
console.log(`보고서: ${reportPath}`);
if (trend.acceptance.status === "failed") process.exitCode = 1;

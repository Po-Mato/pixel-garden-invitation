import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const workflow = option("--workflow", "unknown");
const runId = option("--run-id");
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
if (!runId || !repository || !token) throw new Error("GitHub 실행 시간 조회에 run id, repository, token이 필요합니다.");
const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${runId}/jobs?per_page=100`, {
  headers: {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28"
  }
});
if (!response.ok) throw new Error(`GitHub Actions job timing ${response.status}`);
const jobs = (await response.json()).jobs ?? [];
const completedJobs = jobs.filter(({ started_at: startedAt, completed_at: completedAt }) => startedAt && completedAt);
const durations = completedJobs.map(({ started_at: startedAt, completed_at: completedAt }) => (
  Math.max(0, Date.parse(completedAt) - Date.parse(startedAt))
));
const report = {
  version: 1,
  workflow,
  runId: String(runId),
  runnerOs: option("--runner-os", workflow === "ios" ? "macos" : "linux"),
  runDurationMs: durations.reduce((total, duration) => total + duration, 0),
  billedMinutes: durations.reduce((total, duration) => total + Math.ceil(duration / 60_000), 0),
  jobCount: completedJobs.length,
  generatedAt: completedJobs.map(({ started_at: value }) => value).sort()[0] ?? new Date().toISOString()
};
const outputDir = path.resolve(option("--output-dir", path.join(rootDir, "quality-inputs/ci/timings")));
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, `quality-ci-run-timing-${workflow}-${runId}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(`품질 CI 실행 시간: ${workflow} · ${Math.round(report.runDurationMs / 1000)}초 · ${report.billedMinutes}분`);

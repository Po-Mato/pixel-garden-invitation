import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateReleaseWorkflowReadiness,
  releaseSummaryArtifactExists,
  requiredReleaseWorkflows
} from "./lib/releaseWorkflowGate.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const repository = option("--repository", process.env.GITHUB_REPOSITORY);
const targetSha = option("--target-sha", process.env.GITHUB_SHA);
const currentRunId = String(option("--current-run-id", process.env.GITHUB_RUN_ID ?? ""));
const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
const outputDir = path.resolve(option(
  "--output-dir",
  path.join(rootDir, ".superpowers/visual-regression/release-quality-summary")
));
if (!repository || !targetSha || !token) {
  throw new Error("릴리스 워크플로 준비 확인에 repository, target SHA, GitHub token이 필요합니다.");
}

async function github(pathname) {
  const response = await fetch(`https://api.github.com/repos/${repository}${pathname}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28"
    }
  });
  if (!response.ok) throw new Error(`GitHub Actions 준비 확인 ${response.status}: ${pathname}`);
  return response.json();
}

const runsByWorkflow = Object.fromEntries(await Promise.all(requiredReleaseWorkflows.map(async ({ id, file }) => {
  const data = await github(`/actions/workflows/${encodeURIComponent(file)}/runs?head_sha=${encodeURIComponent(targetSha)}&per_page=100`);
  return [id, data.workflow_runs ?? []];
})));
const readiness = evaluateReleaseWorkflowReadiness(runsByWorkflow);

const priorSummaryRuns = (await github(
  `/actions/workflows/${encodeURIComponent("release-quality-summary.yml")}/runs?head_sha=${encodeURIComponent(targetSha)}&per_page=100`
)).workflow_runs?.filter(({ id, status }) => String(id) !== currentRunId && status === "completed") ?? [];
const summariesWithArtifacts = await Promise.all(priorSummaryRuns.map(async (run) => ({
  id: run.id,
  artifacts: (await github(`/actions/runs/${run.id}/artifacts?per_page=100`)).artifacts ?? []
})));
const alreadySummarized = releaseSummaryArtifactExists(summariesWithArtifacts);
const shouldSummarize = readiness.ready && !alreadySummarized;
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  repository,
  targetSha,
  currentRunId: currentRunId || null,
  ready: readiness.ready,
  alreadySummarized,
  shouldSummarize,
  workflows: readiness.workflows,
  pending: readiness.pending
};
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "release-workflow-readiness.json"), `${JSON.stringify(report, null, 2)}\n`);

if (process.env.GITHUB_OUTPUT) {
  const outputs = [
    `ready=${readiness.ready}`,
    `already_summarized=${alreadySummarized}`,
    `should_summarize=${shouldSummarize}`,
    ...readiness.workflows.map(({ id, runId }) => `${id}_run_id=${runId ?? ""}`)
  ];
  await appendFile(process.env.GITHUB_OUTPUT, `${outputs.join("\n")}\n`);
}
console.log(
  `릴리스 품질 워크플로: ${readiness.workflows.filter(({ status }) => status === "completed").length}`
  + `/${requiredReleaseWorkflows.length} 완료 · 기존 요약 ${alreadySummarized ? "있음" : "없음"}`
  + ` · 생성 ${shouldSummarize ? "진행" : "대기/생략"}`
);

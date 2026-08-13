export const requiredReleaseWorkflows = Object.freeze([
  Object.freeze({ id: "pages", file: "pages.yml", name: "Deploy client to GitHub Pages" }),
  Object.freeze({
    id: "mobile",
    file: "visual-regression.yml",
    name: "Mobile visual regression",
    allowedEvents: Object.freeze(["push", "workflow_dispatch"]),
    workflowDispatchTitle: "Mobile visual regression · full"
  }),
  Object.freeze({ id: "android", file: "android-chrome-visual.yml", name: "Real Android Chrome visual regression" }),
  Object.freeze({ id: "ios", file: "ios-safari-visual.yml", name: "Real iOS Safari visual regression" })
]);

function newestRun(runs = [], { allowedEvents = null, workflowDispatchTitle = null } = {}) {
  return runs.filter((run) => (
    (!allowedEvents?.length || allowedEvents.includes(run.event))
    && (
      run.event !== "workflow_dispatch"
      || !workflowDispatchTitle
      || run.display_title === workflowDispatchTitle
    )
  )).sort((left, right) => (
    Number(right.id ?? 0) - Number(left.id ?? 0)
    || Number(right.run_attempt ?? 0) - Number(left.run_attempt ?? 0)
  ))[0] ?? null;
}

export function evaluateReleaseWorkflowReadiness(runsByWorkflow = {}) {
  const workflows = requiredReleaseWorkflows.map((workflow) => {
    const run = newestRun(runsByWorkflow[workflow.id], workflow);
    return {
      ...workflow,
      runId: run?.id ? String(run.id) : null,
      status: run?.status ?? "missing",
      conclusion: run?.conclusion ?? null,
      runAttempt: Number(run?.run_attempt ?? 0) || null,
      event: run?.event ?? null,
      url: run?.html_url ?? null
    };
  });
  const pending = workflows.filter(({ status }) => status !== "completed");
  return {
    ready: pending.length === 0,
    workflows,
    pending: pending.map(({ id, status }) => ({ id, status }))
  };
}

export function releaseSummaryArtifactExists(runs = []) {
  return runs.some(({ id, artifacts = [] }) => (
    id
    && artifacts.some(({ name, expired }) => !expired && String(name).startsWith("release-quality-summary-"))
  ));
}

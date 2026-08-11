import path from "node:path";
import { verifyVisualBaselineProvenance } from "./lib/visualBaselineProvenanceVerification.mjs";

const rootDir = process.cwd();
const result = await verifyVisualBaselineProvenance({ rootDir });
const requireCurrent = process.argv.includes("--require-current");
for (const summary of result.summaries) {
  console.log(`${summary.id}: ${summary.status}, ${summary.baselineCount} baseline(s), ${summary.issueCount} issue(s)`);
}
const legacy = result.summaries.filter(({ status }) => status === "legacy");
if (!result.passed || (requireCurrent && legacy.length > 0)) {
  console.error(result.issues.join("\n"));
  if (requireCurrent && legacy.length > 0) {
    console.error(`Legacy visual baseline provenance remains: ${legacy.map(({ id }) => id).join(", ")}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Visual baseline provenance verified in ${path.relative(rootDir, path.join(rootDir, "scripts/visual-baselines"))}.`);
}

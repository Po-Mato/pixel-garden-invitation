import path from "node:path";
import { verifyVisualBaselineProvenance } from "./lib/visualBaselineProvenanceVerification.mjs";

const rootDir = process.cwd();
const result = await verifyVisualBaselineProvenance({ rootDir });
for (const summary of result.summaries) {
  console.log(`${summary.id}: ${summary.status}, ${summary.baselineCount} baseline(s), ${summary.issueCount} issue(s)`);
}
if (!result.passed) {
  console.error(result.issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Visual baseline provenance verified in ${path.relative(rootDir, path.join(rootDir, "scripts/visual-baselines"))}.`);
}

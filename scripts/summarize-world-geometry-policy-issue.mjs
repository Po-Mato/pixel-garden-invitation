import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildWorldGeometryPolicyIssue } from "./lib/worldGeometryPolicyIssue.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function argumentValue(name, fallback) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; }
const inputPath = path.resolve(rootDir, argumentValue("--input", ".superpowers/visual-regression/world-geometry-policy-governance.json"));
const outputPath = path.resolve(rootDir, argumentValue("--out", ".superpowers/visual-regression/world-geometry-policy-issue.json"));
const markdownPath = path.resolve(rootDir, argumentValue("--markdown", ".superpowers/visual-regression/world-geometry-policy-issue.md"));
const governance = JSON.parse(await readFile(inputPath, "utf8"));
const request = buildWorldGeometryPolicyIssue(governance, {
  runUrl: argumentValue("--run-url", ""),
  label: argumentValue("--label", "world-geometry-policy"),
  generatedAt: argumentValue("--generated-at", new Date().toISOString())
});
await mkdir(path.dirname(outputPath), { recursive: true });
await Promise.all([
  writeFile(outputPath, `${JSON.stringify(request, null, 2)}\n`),
  writeFile(markdownPath, request.issue.body)
]);
console.log(`월드 정책 만료 이슈 요청: ${request.action} · ${request.expiredCount}개`);
console.log(outputPath);

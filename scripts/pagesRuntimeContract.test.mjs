import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  auditPagesRuntimeContract,
  buildPagesRuntimeContractSnapshot,
  extractHtmlRuntimeReferences,
  formatPagesRuntimeContractMarkdown
} from "./lib/pagesRuntimeContract.mjs";

const workerSource = `const VERSION = "abcdef123456";
const PRECACHE_URLS = ["./", "./index.html", "./assets/app.js"];
const FEATURE_URLS = ["./assets/game.js"];
function scopedUrl(path) { return new URL(path, self.registration.scope).href; }`;

function healthySnapshot() {
  return buildPagesRuntimeContractSnapshot({
    baseUrl: "https://example.test/pixel-garden-invitation/",
    expectedBasePath: "/pixel-garden-invitation/",
    expectedSha: "abcdef1234567890",
    entryStatus: 200,
    indexHtml: '<link rel="manifest" href="./manifest.webmanifest"><script src="./assets/app.js"></script>',
    manifestStatus: 200,
    manifest: { id: "./", start_url: "./", scope: "./" },
    workerStatus: 200,
    workerSource,
    probes: Array.from({ length: 7 }, (_, index) => ({ path: String(index), status: 200, withinBase: true }))
  });
}

test("Pages contract keeps manifest, worker scope, and runtime assets inside the repository base path", () => {
  const snapshot = healthySnapshot();
  assert.deepEqual(auditPagesRuntimeContract(snapshot), []);
  const report = { ...snapshot, status: "passed", issues: [] };
  assert.match(formatPagesRuntimeContractMarkdown(report), /운영 자산: 7\/7/);
});

test("Pages contract rejects root escapes, stale workers, and missing runtime resources", () => {
  const snapshot = healthySnapshot();
  snapshot.deployedVersion = "stale1234567";
  snapshot.manifest.resolvedScope = "https://example.test/";
  snapshot.htmlReferences.push({ reference: "/asset.js", resolvedUrl: "https://example.test/asset.js", withinBase: false });
  snapshot.assets.probes[0].status = 404;
  const issues = auditPagesRuntimeContract(snapshot);
  assert.ok(issues.some((issue) => issue.includes("SHA 불일치")));
  assert.ok(issues.some((issue) => issue.includes("manifest resolvedScope")));
  assert.ok(issues.some((issue) => issue.includes("HTML base path 이탈")));
  assert.ok(issues.some((issue) => issue.includes("운영 자산 요청 실패")));
});

test("Pages contract extracts only fetchable script and link references", () => {
  assert.deepEqual(extractHtmlRuntimeReferences(`
    <link rel="stylesheet" href="./app.css">
    <script src="./app.js"></script>
    <link rel="icon" href="data:image/png;base64,x">
  `), ["./app.css", "./app.js"]);
});

test("Pages deploy verifies the runtime contract after deployment", async () => {
  const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  const deployAt = workflow.indexOf("id: deployment");
  const contractAt = workflow.indexOf("quality:pages-runtime-contract");
  assert.ok(contractAt > deployAt);
  assert.match(workflow.slice(contractAt), /--expected-base-path \/pixel-garden-invitation\//);
});

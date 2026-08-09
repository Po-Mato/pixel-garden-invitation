import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildPublicCanaryUrl,
  parsePublicCanaryArguments
} from "./check-production-large-text-canary.mjs";

test("production canary adds a SHA cache-buster to an HTTPS Pages URL", () => {
  assert.equal(
    buildPublicCanaryUrl("https://example.com/invitation/", "abc123"),
    "https://example.com/invitation/?canary=abc123"
  );
  assert.throws(() => buildPublicCanaryUrl("http://example.com/"), /HTTPS/);
});

test("production canary accepts deployment URL, SHA, and artifact directory", () => {
  assert.deepEqual(parsePublicCanaryArguments([
    "--url", "https://example.com/app/",
    "--expected-sha", "deadbeef",
    "--output", "/tmp/canary"
  ]), {
    url: "https://example.com/app/",
    expectedSha: "deadbeef",
    outputDir: "/tmp/canary"
  });
});

test("Pages deploy runs the public portrait and landscape 200% canary after deployment", () => {
  const workflow = readFileSync(".github/workflows/pages.yml", "utf8");
  const deployAt = workflow.indexOf("id: deployment");
  const canaryAt = workflow.indexOf("quality:production-large-text");
  assert.ok(deployAt >= 0);
  assert.ok(canaryAt > deployAt);
  assert.match(workflow.slice(canaryAt), /steps\.deployment\.outputs\.page_url/);
  assert.match(workflow.slice(canaryAt), /GITHUB_SHA/);
});

test("public large-text canary waits for the exact deployment version before opening a browser", () => {
  const source = readFileSync("scripts/check-production-large-text-canary.mjs", "utf8");
  const deploymentWaitAt = source.indexOf("waitForServiceWorkerVersion(url, expectedSha.slice(0, 12))");
  const browserAuditAt = source.indexOf("await runLargeTextAccessibilityAudit");
  assert.ok(deploymentWaitAt >= 0);
  assert.ok(browserAuditAt > deploymentWaitAt);
});

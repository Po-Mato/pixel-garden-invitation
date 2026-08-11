import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("approved patch workflow isolates untrusted PR code and limits the write scope", async () => {
  const workflow = await readFile(path.join(rootDir, ".github/workflows/apply-approved-map-patch.yml"), "utf8");
  assert.match(workflow, /pull_request_target/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /run-name: "Apply approved map patch #\$\{\{ inputs\.source_pr \|\| github\.event\.pull_request\.number \}\}"/);
  assert.match(workflow, /map-foreground-patch-approved/);
  assert.match(workflow, /head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /Checkout trusted automation tools/);
  assert.match(workflow, /Checkout pull request head without executing it/);
  assert.match(workflow, /trusted-tools\/scripts\/apply-approved-map-patch-bot\.mjs/);
  assert.match(workflow, /source PR does not carry map-foreground-patch-approved/);
  assert.match(workflow, /\.path == "\.github\/workflows\/visual-regression\.yml"/);
  assert.match(workflow, /\.head_sha == \$sha/);
  const script = await readFile(path.join(rootDir, "scripts/apply-approved-map-patch-bot.mjs"), "utf8");
  assert.match(script, /lstat/);
  assert.match(script, /targetRelativePath\.startsWith\("\.\."\)/);
  assert.match(workflow, /status --short \| wc -l/);
  assert.match(workflow, /client\/src\/game\/worldForegroundPlacements\.json/);
  assert.match(workflow, /ls-remote --exit-code --heads origin/);
  assert.match(workflow, /existing=true/);
  assert.doesNotMatch(workflow, /pnpm (?:install|run|exec)/);
});

test("sandbox E2E exercises the real approval label and cleans every temporary ref", async () => {
  const workflow = await readFile(path.join(rootDir, ".github/workflows/map-patch-automation-e2e.yml"), "utf8");
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /actions: write/);
  assert.match(workflow, /gh pr create --draft/);
  assert.match(workflow, /--add-label map-foreground-patch-approved/);
  assert.match(workflow, /gh label create map-foreground-patch-approved/);
  assert.match(workflow, /apply-approved-map-patch\.yml/);
  assert.match(workflow, /Classify empty map patch as a healthy no-op/);
  assert.match(workflow, /operation_count/);
  assert.match(workflow, /steps\.patch\.outputs\.no_op != 'true'/);
  assert.match(workflow, /-f source_pr="\$SOURCE_PR" -f evidence_run="\$EVIDENCE_RUN"/);
  assert.match(workflow, /--event workflow_dispatch/);
  assert.match(workflow, /gh workflow run visual-regression\.yml --ref "\$E2E_BRANCH" -f scope=map-evidence/);
  assert.match(workflow, /Build commit-matched E2E quality workspace/);
  assert.match(workflow, /gh workflow run quality-build\.yml --ref "\$E2E_BRANCH"/);
  assert.match(workflow, /gh run list --workflow quality-build\.yml --commit "\$HEAD_SHA" --event workflow_dispatch/);
  assert.match(workflow, /test "\$conclusion" = "success"/);
  assert.ok(
    workflow.indexOf("Build commit-matched E2E quality workspace")
      < workflow.indexOf("Wait for successful visual evidence")
  );
  assert.match(workflow, /client\/src\/game\/worldForegroundPlacements\.json/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /gh pr close "\$APPLICATION_PR" --delete-branch/);
  assert.match(workflow, /gh pr close "\$SOURCE_PR" --delete-branch/);
  assert.match(workflow, /automation\/e2e-map-patch-/);
});

test("map approval evidence skips unrelated HUD and soak work without weakening full runs", async () => {
  const workflow = await readFile(path.join(rootDir, ".github/workflows/visual-regression.yml"), "utf8");
  assert.match(workflow, /scope:\s+[\s\S]*- full\s+- map-evidence/);
  assert.match(workflow, /MAP_EVIDENCE_ONLY:.*inputs\.scope == 'map-evidence'/);
  assert.match(workflow, /name: Run map approval contract tests\s+if: env\.MAP_EVIDENCE_ONLY == 'true'\s+run: pnpm maps:audit && pnpm maps:test && pnpm visual:world-layout/);
  assert.match(workflow, /name: Audit map diagnostic screenshots\s+run: pnpm visual:map-diagnostics/);
  for (const step of [
    "Run the full visual contract suite",
    "Audit live mobile HUD screenshots",
    "Audit real two-client movement and UI collisions",
    "Audit Android and iOS long-session stability"
  ]) {
    const position = workflow.indexOf(`name: ${step}`);
    assert.ok(position >= 0, `${step} is missing`);
    assert.match(workflow.slice(position, position + 220), /if: env\.MAP_EVIDENCE_ONLY != 'true'/);
  }
  assert.match(workflow, /name: Package targeted map browser evidence/);
  assert.match(workflow, /name: Upload map foreground diagnostics\s+if: always\(\)/);
});

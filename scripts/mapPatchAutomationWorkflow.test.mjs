import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("approved patch workflow isolates untrusted PR code and limits the write scope", async () => {
  const workflow = await readFile(path.join(rootDir, ".github/workflows/apply-approved-map-patch.yml"), "utf8");
  assert.match(workflow, /pull_request_target/);
  assert.match(workflow, /map-foreground-patch-approved/);
  assert.match(workflow, /head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /Checkout trusted automation tools/);
  assert.match(workflow, /Checkout pull request head without executing it/);
  assert.match(workflow, /trusted-tools\/scripts\/apply-approved-map-patch-bot\.mjs/);
  const script = await readFile(path.join(rootDir, "scripts/apply-approved-map-patch-bot.mjs"), "utf8");
  assert.match(script, /lstat/);
  assert.match(script, /targetRelativePath\.startsWith\("\.\."\)/);
  assert.match(workflow, /status --short \| wc -l/);
  assert.match(workflow, /client\/src\/game\/worldForegroundPlacements\.json/);
  assert.match(workflow, /ls-remote --exit-code --heads origin/);
  assert.match(workflow, /existing=true/);
  assert.doesNotMatch(workflow, /pnpm (?:install|run|exec)/);
});

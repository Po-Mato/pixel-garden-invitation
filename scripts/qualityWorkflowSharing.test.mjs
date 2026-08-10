import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = (name) => readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");

test("four release workflows restore the same commit-matched quality build", async () => {
  const sources = await Promise.all([
    workflow("pages.yml"),
    workflow("visual-regression.yml"),
    workflow("android-chrome-visual.yml"),
    workflow("ios-safari-visual.yml")
  ]);
  for (const source of sources) {
    assert.match(source, /\.\/\.github\/actions\/setup-quality-dependencies/);
    assert.match(source, /\.\/\.github\/actions\/restore-quality-build/);
    assert.match(source, /steps\.quality-build\.outputs\.restored != 'true'/);
  }
  assert.match(sources[0], /variant: production/);
  assert.match(sources[1], /variant: production/);
  assert.match(sources[2], /variant: device/);
  assert.match(sources[3], /variant: device/);
});

test("shared quality build produces isolated production and device variants", async () => {
  const source = await workflow("quality-build.yml");
  assert.match(source, /quality-build-\$\{\{ github\.sha \}\}/);
  assert.match(source, /\.quality-build\/production/);
  assert.match(source, /\.quality-build\/device/);
  assert.match(source, /\.quality-build\/generated-characters/);
  assert.match(source, /VITE_TURNSTILE_SITE_KEY/);
  assert.match(source, /path: \.quality-build\s+include-hidden-files: true/);
  assert.match(source, /retention-days: 7/);
  const action = await readFile(new URL("../.github/actions/restore-quality-build/action.yml", import.meta.url), "utf8");
  assert.match(action, /client\/public\/characters\/generated/);
});

test("release summary has one artifact-producing gate for all mandatory workflows", async () => {
  const source = await workflow("release-quality-summary.yml");
  assert.match(source, /workflows: \[Mobile visual regression\]/);
  assert.doesNotMatch(source, /workflows:[\s\S]*Deploy client to GitHub Pages[\s\S]*types:/);
  assert.match(source, /should_summarize/);
  assert.match(source, /cancel-in-progress: true/);
  const gate = await readFile(new URL("./check-release-workflow-readiness.mjs", import.meta.url), "utf8");
  assert.match(gate, /already_summarized/);
  assert.match(gate, /setTimeout/);
  assert.match(gate, /pollCount/);
  assert.match(gate, /single-mobile-completion-trigger/);
});

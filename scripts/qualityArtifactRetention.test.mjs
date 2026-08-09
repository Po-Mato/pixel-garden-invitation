import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("successful visual evidence excludes diff images and uses short retention", async () => {
  const [android, ios, mobile] = await Promise.all([
    readFile(new URL("../.github/workflows/android-chrome-visual.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/ios-safari-visual.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/visual-regression.yml", import.meta.url), "utf8")
  ]);

  assert.match(android, /android-chrome[\s\S]*--exclude-suffix=-diff\.png/);
  assert.match(ios, /ios-safari[\s\S]*--exclude-suffix=-diff\.png/);
  assert.match(mobile, /mobile-hud-browser[\s\S]*--exclude-suffix=-diff\.png/);
  assert.match(android, /path: \|[\s\S]*\.quality-artifacts\/android-chrome/);
  assert.match(ios, /path: \|[\s\S]*\.quality-artifacts\/ios-safari/);
  assert.match(android, /android-chrome-diff-[\s\S]*retention-days: 14/);
  assert.match(ios, /ios-safari-diff-[\s\S]*retention-days: 14/);
});

test("large trace archives are split into a three-day artifact", async () => {
  const workflow = await readFile(new URL("../.github/workflows/visual-regression.yml", import.meta.url), "utf8");
  assert.match(workflow, /mobile-device-soak[\s\S]*--exclude-suffix=-trace\.zip/);
  assert.match(workflow, /mobile-device-traces-[\s\S]*compression-level: 0[\s\S]*retention-days: 3/);
});

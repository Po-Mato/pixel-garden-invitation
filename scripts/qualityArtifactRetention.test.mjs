import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("successful visual evidence excludes diff images and uses short retention", async () => {
  const [android, ios, mobile] = await Promise.all([
    readFile(new URL("../.github/workflows/android-chrome-visual.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/ios-safari-visual.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/visual-regression.yml", import.meta.url), "utf8")
  ]);

  assert.match(android, /!\.superpowers\/visual-regression\/android-chrome\/\*\*\/\*-diff\.png/);
  assert.match(ios, /!\.superpowers\/visual-regression\/ios-safari\/\*\*\/\*-diff\.png/);
  assert.match(mobile, /mobile-hud-browser[\s\S]*!\.superpowers\/visual-regression\/mobile-hud-browser\/\*\*\/\*-diff\.png/);
  assert.match(android, /android-chrome-diff-[\s\S]*retention-days: 14/);
  assert.match(ios, /ios-safari-diff-[\s\S]*retention-days: 14/);
});

test("large trace archives are split into a three-day artifact", async () => {
  const workflow = await readFile(new URL("../.github/workflows/visual-regression.yml", import.meta.url), "utf8");
  assert.match(workflow, /!\.superpowers\/visual-regression\/mobile-device-soak\/\*-trace\.zip/);
  assert.match(workflow, /mobile-device-traces-[\s\S]*compression-level: 0[\s\S]*retention-days: 3/);
});

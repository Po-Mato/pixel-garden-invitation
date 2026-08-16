import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { auditGuestSelectionPreviewAssets } from "./build-guest-selection-preview-assets.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8")
);

test("선택 화면의 12명 144프레임은 2배 해상도와 동일한 3등신 기준을 지킨다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  assert.deepEqual(report.policy.source, { width: 192, height: 288 });
  assert.equal(report.summary.presetCount, 12);
  assert.equal(report.summary.frameCount, 144);
  assert.equal(report.summary.exactBodyToHeadRatio, true);
  assert.ok(report.summary.maximumHeadWidthDelta <= 2);
  assert.equal(report.summary.passed, true);
});

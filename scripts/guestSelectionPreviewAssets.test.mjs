import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { auditGuestSelectionPreviewAssets } from "./build-guest-selection-preview-assets.mjs";
import { alphaDifference } from "./lib/characterAssetAudit.mjs";

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

test("승인된 평면 원화 12종은 선택 화면과 게임의 실제 보행 포즈로 이어진다", async () => {
  const policy = catalog.frame.selectionPreview;
  const sourceRoot = join(root, "character-assets/reference/guest-flat-walk-sources/v1");
  const previewRoot = join(root, "character-assets/source/guests-preview");

  for (const preset of catalog.presets) {
    const guest = preset.reference.walkSourceGuest;
    await access(join(sourceRoot, `${guest}-walk-sheet.png`));
    const walkPath = join(previewRoot, `${preset.id}__walk.png`);
    for (let row = 0; row < 4; row += 1) {
      const frames = [];
      for (let column = 0; column < 3; column += 1) {
        const { data } = await sharp(walkPath)
          .extract({
            left: column * policy.source.width,
            top: row * policy.source.height,
            width: policy.source.width,
            height: policy.source.height
          })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        frames.push(data);
      }
      assert.ok(
        alphaDifference(frames[0], frames[1]) >= 0.001,
        `${guest} ${catalog.frame.walk.rows[row]} 왼발 포즈가 중립 포즈와 구분되어야 합니다.`
      );
      assert.ok(
        alphaDifference(frames[1], frames[2]) >= 0.001,
        `${guest} ${catalog.frame.walk.rows[row]} 오른발 포즈가 중립 포즈와 구분되어야 합니다.`
      );
    }
  }
});

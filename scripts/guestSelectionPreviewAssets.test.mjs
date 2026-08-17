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

  assert.equal(report.version, 2);
  assert.deepEqual(report.policy.source, { width: 192, height: 288 });
  assert.equal(report.summary.presetCount, 12);
  assert.equal(report.summary.frameCount, 144);
  assert.equal(report.summary.rigBodyToHeadRatio, 2);
  assert.equal(report.summary.measuredHeadHeightWithinTolerance, true);
  assert.ok(report.summary.minimumMeasuredHeadHeight >= report.policy.headHeight - 1);
  assert.ok(report.summary.maximumMeasuredHeadHeight <= report.policy.headHeight + 1);
  assert.ok(report.summary.maximumHeadHeightDelta <= 1);
  assert.ok(report.summary.maximumDirectionHeadHeightSpread <= 1);
  assert.ok(report.summary.maximumHeadWidthDelta <= 2);
  assert.equal(report.summary.landmarkFrameCount, 108);
  assert.equal(report.summary.consensusFrameCount, 36);
  assert.equal(report.summary.rigHashesMatch, true);
  assert.equal(report.summary.passed, true);
});

test("각 캐릭터의 상하좌우 보행 3컷은 같은 머리 높이 범위에 고정된다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    const frames = Object.values(preset.directions).flat();
    const headHeights = frames.map((frame) => frame.measuredHeadHeight);
    assert.ok(
      Math.max(...headHeights) - Math.min(...headHeights) <= 1,
      `${preset.guest}의 방향별 실제 머리 높이 차이는 1px 이하여야 합니다.`
    );
    assert.equal(
      preset.directions.up.every(
        (frame) => frame.sourceDetectionMethod === "cross-direction-consensus"
      ),
      true,
      `${preset.guest} 후면 컷은 세 방향의 실제 턱선 합의값을 사용해야 합니다.`
    );
    for (const direction of ["down", "left", "right"]) {
      assert.equal(
        preset.directions[direction].every(
          (frame) => frame.sourceDetectionMethod === "face-landmark"
        ),
        true,
        `${preset.guest} ${direction} 컷은 실제 턱선을 측정해야 합니다.`
      );
    }
  }
});

test("1·6·7·8번은 방향 비율을 다시 맞춘 optical-rig 원화를 사용한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });
  const correctedGuests = new Set(["guest-01", "guest-06", "guest-07", "guest-08"]);

  for (const preset of report.presets) {
    assert.equal(
      preset.sourceSet,
      correctedGuests.has(preset.guest) ? "v2-optical-rig" : "v1-flat-three-head",
      `${preset.guest} 원화 버전이 검수된 소스와 일치해야 합니다.`
    );
  }

  const correctedSourceRoot = join(
    root,
    "character-assets/reference/guest-flat-walk-sources/v2"
  );
  await Promise.all([...correctedGuests].map((guest) =>
    access(join(correctedSourceRoot, `${guest}-walk-sheet.png`))
  ));
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

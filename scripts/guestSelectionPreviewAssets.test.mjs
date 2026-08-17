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

  assert.equal(report.version, 3);
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
  assert.ok(
    report.summary.maximumMeasuredFrontToProfileFaceWidthRatio
      <= report.policy.maximumFrontToProfileFaceWidthRatio
  );
  assert.ok(
    report.summary.maximumMeasuredLeftRightFaceWidthDifferenceRatio
      <= report.policy.maximumLeftRightFaceWidthDifferenceRatio
  );
  assert.equal(report.summary.opticalFaceWidthWithinTolerance, true);
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

test("얼굴 폭 보정 대상은 v3, 기존 체형 보정 대상은 v2 원화를 사용한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });
  const faceCorrectedGuests = new Set([
    "guest-01",
    "guest-02",
    "guest-03",
    "guest-05",
    "guest-06",
    "guest-07",
    "guest-12"
  ]);
  const opticalRigGuests = new Set(["guest-08"]);

  for (const preset of report.presets) {
    const expectedSourceSet = faceCorrectedGuests.has(preset.guest)
      ? "v3-optical-face-rig"
      : opticalRigGuests.has(preset.guest)
        ? "v2-optical-rig"
        : "v1-flat-three-head";
    assert.equal(
      preset.sourceSet,
      expectedSourceSet,
      `${preset.guest} 원화 버전이 검수된 소스와 일치해야 합니다.`
    );
  }

  const faceCorrectedSourceRoot = join(
    root,
    "character-assets/reference/guest-flat-walk-sources/v3"
  );
  await Promise.all([...faceCorrectedGuests].map((guest) =>
    access(join(faceCorrectedSourceRoot, `${guest}-walk-sheet.png`))
  ));
});

test("정면과 측면의 실제 얼굴 폭은 캐릭터별 광학 허용 범위 안에 있다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    assert.ok(
      preset.opticalFace.frontToProfileFaceWidthRatio
        <= report.policy.maximumFrontToProfileFaceWidthRatio,
      `${preset.guest} 정면 얼굴 폭이 측면 평균보다 과도하게 커서는 안 됩니다.`
    );
    assert.ok(
      preset.opticalFace.leftRightFaceWidthDifferenceRatio
        <= report.policy.maximumLeftRightFaceWidthDifferenceRatio,
      `${preset.guest} 좌우 얼굴 폭 차이가 광학 허용 범위를 넘으면 안 됩니다.`
    );
  }
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

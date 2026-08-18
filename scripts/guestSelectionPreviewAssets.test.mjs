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

  assert.equal(report.version, 4);
  assert.deepEqual(report.policy.source, { width: 192, height: 288 });
  assert.equal(report.summary.presetCount, 12);
  assert.equal(report.summary.frameCount, 144);
  assert.equal(report.summary.rigBodyToHeadRatio, 2);
  assert.equal(report.summary.measuredHeadHeightWithinTolerance, true);
  assert.ok(report.summary.minimumMeasuredHeadHeight >= report.policy.headHeight - 1);
  assert.ok(report.summary.maximumMeasuredHeadHeight <= report.policy.headHeight + 1);
  assert.ok(report.summary.maximumHeadHeightDelta <= 1);
  assert.ok(
    report.summary.maximumDirectionHeadHeightSpread
      <= report.policy.maximumDirectionHeadHeightSpread
  );
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
  assert.ok(
    report.summary.maximumMeasuredFacialLandmarkCenterYSpreadRatio
      <= report.policy.maximumFacialLandmarkVerticalSpreadRatio
  );
  assert.ok(
    report.summary.maximumMeasuredFacialLandmarkBottomYSpreadRatio
      <= report.policy.maximumFacialLandmarkVerticalSpreadRatio
  );
  assert.equal(report.summary.opticalLandmarksWithinTolerance, true);
  assert.ok(
    report.summary.maximumMeasuredStrideSilhouetteSymmetryRatio
      <= report.policy.maximumStrideSilhouetteSymmetryRatio
  );
  assert.ok(
    report.summary.maximumMeasuredLeftRightStrideExpansionDifferenceRatio
      <= report.policy.maximumLeftRightStrideExpansionDifferenceRatio
  );
  assert.ok(
    report.summary.maximumMeasuredStrideCenterDrift
      <= report.policy.maximumStrideCenterDrift
  );
  assert.ok(
    report.summary.maximumMeasuredStepBaselineSpread
      <= report.policy.maximumStepBaselineSpread
  );
  assert.equal(report.summary.motionWithinTolerance, true);
  assert.equal(report.summary.passed, true);
});

test("각 캐릭터의 상하좌우 보행 3컷은 같은 머리 높이 허용 범위에 고정된다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    const frames = Object.values(preset.directions).flat();
    const headHeights = frames.map((frame) => frame.measuredHeadHeight);
    assert.ok(
      Math.max(...headHeights) - Math.min(...headHeights)
        <= report.policy.maximumDirectionHeadHeightSpread,
      `${preset.guest}의 방향별 실제 머리 높이 차이는 허용 범위 이하여야 합니다.`
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

test("1번은 정면 얼굴을 보정한 v5, 나머지는 검수된 v4 원화를 사용한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    assert.equal(
      preset.sourceSet,
      preset.guest === "guest-01"
        ? "v5-front-face-balance"
        : "v4-direction-motion-polish",
      `${preset.guest} 원화 버전이 검수된 소스와 일치해야 합니다.`
    );
  }

  const polishedSourceRoot = join(
    root,
    "character-assets/reference/guest-flat-walk-sources/v4"
  );
  await Promise.all(catalog.presets.map((preset) =>
    access(join(polishedSourceRoot, `${preset.reference.walkSourceGuest}-walk-sheet.png`))
  ));
  await access(join(
    root,
    "character-assets/reference/guest-flat-walk-sources/v5/guest-01-walk-sheet.png"
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

test("1번 캐릭터 정면 얼굴은 측면 평균과 거의 같은 광학 폭을 유지한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });
  const guest01 = report.presets.find((preset) => preset.guest === "guest-01");

  assert.ok(guest01, "guest-01 감사 결과가 필요합니다.");
  assert.ok(
    guest01.opticalFace.frontToProfileFaceWidthRatio <= 1.08,
    `guest-01 정면/측면 얼굴 폭 비율 ${guest01.opticalFace.frontToProfileFaceWidthRatio}은 1.08 이하여야 합니다.`
  );
  assert.ok(
    Math.abs(
      guest01.opticalFace.downMedianFaceWidth
        - guest01.opticalFace.profileMedianFaceWidth
    ) <= 2,
    "guest-01 정면 얼굴 폭은 측면 평균과 2px 이상 벌어지면 안 됩니다."
  );
});

test("얼굴 기준선과 좌우 보행 리듬은 방향 전환 시 허용 범위 안에 있다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    assert.ok(
      preset.opticalLandmarks.centerYSpreadRatio
        <= report.policy.maximumFacialLandmarkVerticalSpreadRatio,
      `${preset.guest} 얼굴 중심선이 방향별 허용 범위를 넘으면 안 됩니다.`
    );
    assert.ok(
      preset.motion.maximumStrideSilhouetteSymmetryRatio
        <= report.policy.maximumStrideSilhouetteSymmetryRatio,
      `${preset.guest} 왼발·오른발 보폭 실루엣이 비대칭이면 안 됩니다.`
    );
    assert.ok(
      preset.motion.leftRightStrideExpansionDifferenceRatio
        <= report.policy.maximumLeftRightStrideExpansionDifferenceRatio,
      `${preset.guest} 좌우 방향의 보폭 크기가 달라 보이면 안 됩니다.`
    );
    assert.ok(
      preset.motion.maximumStepBaselineSpread <= report.policy.maximumStepBaselineSpread,
      `${preset.guest} 보행 중 발 기준선이 흔들리면 안 됩니다.`
    );
  }
});

test("승인된 평면 원화 12종은 선택 화면과 게임의 실제 보행 포즈로 이어진다", async () => {
  const policy = catalog.frame.selectionPreview;
  const sourceRoot = join(root, "character-assets/reference/guest-flat-walk-sources/v4");
  const frontFaceSourceRoot = join(root, "character-assets/reference/guest-flat-walk-sources/v5");
  const previewRoot = join(root, "character-assets/source/guests-preview");

  for (const preset of catalog.presets) {
    const guest = preset.reference.walkSourceGuest;
    await access(join(
      guest === "guest-01" ? frontFaceSourceRoot : sourceRoot,
      `${guest}-walk-sheet.png`
    ));
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

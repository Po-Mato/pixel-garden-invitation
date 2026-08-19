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

  assert.equal(report.version, 8);
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
  assert.ok(
    report.summary.maximumHeadWidthDelta <= report.policy.maximumHeadWidthDelta
  );
  assert.equal(report.summary.landmarkFrameCount, 108);
  assert.equal(report.summary.consensusFrameCount, 36);
  assert.equal(report.summary.rigHashesMatch, true);
  assert.ok(
    report.summary.maximumMeasuredFrontToProfileFaceWidthRatio
      <= report.policy.maximumMasterFrontToProfileFaceWidthRatio
  );
  assert.ok(
    report.summary.minimumMeasuredFrontToProfileFaceWidthRatio
      >= report.policy.minimumFrontToProfileFaceWidthRatio
  );
  assert.ok(
    report.summary.maximumMeasuredFrontToProfileFaceAreaRatio
      <= report.policy.maximumMasterFrontToProfileFaceAreaRatio
  );
  assert.ok(
    report.summary.maximumMeasuredLeftRightFaceWidthDifferenceRatio
      <= report.policy.maximumMasterLeftRightFaceWidthDifferenceRatio
  );
  assert.equal(report.summary.opticalFaceWidthWithinTolerance, true);
  assert.equal(report.summary.opticalLandmarksWithinTolerance, true);
  assert.ok(
    report.summary.maximumMeasuredStrideCenterDrift
      <= report.policy.maximumStrideCenterDrift
  );
  assert.ok(
    report.summary.maximumMeasuredStepBaselineSpread
      <= report.policy.maximumStepBaselineSpread
  );
  assert.equal(report.summary.motionWithinTolerance, true);
  assert.ok(
    report.summary.maximumRuntimeCoreCenterDriftDisplayPx
      <= report.runtimeMotion.policy.maximumCoreCenterDriftDisplayPx
  );
  assert.equal(report.summary.runtimeMotionWithinTolerance, true);
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

test("12명 모두 신랑·신부 수준의 고해상도 입체 원화를 사용한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    assert.equal(
      preset.sourceSet,
      "v8-couple-depth-master",
      `${preset.guest} 원화는 고해상도 입체 마스터에서 생성돼야 합니다.`
    );
  }

  const depthSourceRoot = join(
    root,
    "character-assets/reference/guest-3d-master-sources/v1"
  );
  await Promise.all(catalog.presets.flatMap((preset) =>
    catalog.frame.walk.rows.flatMap((direction) =>
      [1, 2, 3].map((step) => access(join(
        depthSourceRoot,
        preset.reference.walkSourceGuest,
        "pilot",
        "sources",
        direction,
        `step-${String(step).padStart(2, "0")}-source.png`
      )))
    )
  ));
});

test("정면과 측면의 실제 얼굴 폭은 캐릭터별 광학 허용 범위 안에 있다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    const maximumWidthRatio = preset.sourceSet === "v8-couple-depth-master"
      ? report.policy.maximumMasterFrontToProfileFaceWidthRatio
      : report.policy.maximumFrontToProfileFaceWidthRatio;
    const maximumAreaRatio = report.policy.maximumFrontToProfileFaceAreaRatioByGuest[preset.guest]
      ?? (preset.sourceSet === "v8-couple-depth-master"
        ? report.policy.maximumMasterFrontToProfileFaceAreaRatio
        : report.policy.maximumFrontToProfileFaceAreaRatio);
    const maximumProfileDifference = preset.sourceSet === "v8-couple-depth-master"
      ? report.policy.maximumMasterLeftRightFaceWidthDifferenceRatio
      : report.policy.maximumLeftRightFaceWidthDifferenceRatio;
    assert.ok(
      preset.opticalFace.frontToProfileFaceWidthRatio <= maximumWidthRatio,
      `${preset.guest} 정면 얼굴 폭이 측면 평균보다 과도하게 커서는 안 됩니다.`
    );
    assert.ok(
      preset.opticalFace.frontToProfileFaceWidthRatio
        >= report.policy.minimumFrontToProfileFaceWidthRatio,
      `${preset.guest} 정면 얼굴 폭이 측면 평균보다 과도하게 작아서는 안 됩니다.`
    );
    assert.ok(
      preset.opticalFace.frontToProfileFaceAreaRatio <= maximumAreaRatio,
      `${preset.guest} 정면 얼굴 면적이 측면 평균보다 과도하게 커서는 안 됩니다.`
    );
    assert.ok(
      preset.opticalFace.leftRightFaceWidthDifferenceRatio <= maximumProfileDifference,
      `${preset.guest} 좌우 얼굴 폭 차이가 광학 허용 범위를 넘으면 안 됩니다.`
    );
  }
});

test("입체 마스터는 방향별 머리 실루엣을 유지하고 1번은 정면 광학 크기를 별도 보정한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    const headWidths = Object.values(preset.directions)
      .flat()
      .map((frame) => frame.headWidth);
    const headWidthRatio = Math.max(...headWidths) / Math.min(...headWidths);
    if (preset.guest === "guest-01") {
      assert.ok(preset.opticalFace.frontToProfileFaceWidthRatio <= 1.05);
      assert.ok(preset.opticalFace.frontToProfileFaceAreaRatio <= 1.25);
      assert.ok(headWidthRatio <= 1.17);
    } else {
      assert.ok(
        headWidthRatio <= 1.03,
        `${preset.guest} 방향별 머리 실루엣 편차는 3% 이하여야 합니다.`
      );
    }
  }
});

test("1번 캐릭터 정면 얼굴은 측면과 2px 이내이며 광학 면적은 1.25 이하를 유지한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });
  const guest01 = report.presets.find((preset) => preset.guest === "guest-01");

  assert.ok(guest01, "guest-01 감사 결과가 필요합니다.");
  assert.equal(report.policy.maximumFrontToProfileFaceAreaRatioByGuest["guest-01"], 1.25);
  assert.ok(
    Math.abs(
      guest01.opticalFace.downMedianFaceWidth
        - guest01.opticalFace.profileMedianFaceWidth
    ) <= 2,
    "guest-01 정면 얼굴 폭은 측면 평균과 2px 이상 벌어지면 안 됩니다."
  );
  assert.ok(
    guest01.opticalFace.frontToProfileFaceAreaRatio <= 1.25,
    "guest-01 정면 얼굴 면적은 측면 평균의 1.25배 이하여야 합니다."
  );
});

test("입체 마스터 보행 리듬과 최종 프레임 중심·발 기준선은 안정적이다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    const masterAudit = JSON.parse(await readFile(join(
      root,
      "character-assets/reference/guest-3d-master-sources/v1",
      preset.guest,
      "pilot/audit.json"
    ), "utf8"));
    assert.equal(masterAudit.acceptance.gaitCycle.passed, true);
    assert.equal(masterAudit.acceptance.headSizeConsistency.passed, true);
    assert.ok(masterAudit.acceptance.headSizeConsistency.maximumDirectionRatio <= 1.1);
    assert.ok(preset.motion.maximumCenterDrift <= report.policy.maximumStrideCenterDrift);
    assert.ok(
      preset.motion.maximumStepBaselineSpread <= report.policy.maximumStepBaselineSpread,
      `${preset.guest} 보행 중 발 기준선이 흔들리면 안 됩니다.`
    );
  }
});

test("실제 48×72 표시 크기에서도 보행 상체 중심은 1px 안에서 안정된다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  assert.equal(report.runtimeMotion.presets.length, 12);
  for (const preset of report.runtimeMotion.presets) {
    assert.ok(
      preset.maximumCoreCenterDriftDisplayPx
        <= report.runtimeMotion.policy.maximumCoreCenterDriftDisplayPx,
      `${preset.guest} 보행 상체가 실제 표시 크기에서 좌우로 흔들리면 안 됩니다.`
    );
  }
});

test("고해상도 입체 마스터 12종은 선택 화면과 게임의 실제 보행 포즈로 이어진다", async () => {
  const policy = catalog.frame.selectionPreview;
  const sourceRoot = join(root, "character-assets/reference/guest-3d-master-sources/v1");
  const previewRoot = join(root, "character-assets/source/guests-preview");

  for (const preset of catalog.presets) {
    const guest = preset.reference.walkSourceGuest;
    await access(join(sourceRoot, guest, "pilot", "sources", "down", "step-02-source.png"));
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

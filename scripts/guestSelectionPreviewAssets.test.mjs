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

  assert.equal(report.version, 9);
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
  assert.ok(
    report.summary.maximumMeasuredFrontToProfileHeadWidthRatio
      <= report.policy.maximumFrontToProfileHeadWidthRatio
  );
  assert.ok(
    report.summary.minimumMeasuredFrontToProfileHeadWidthRatio
      >= report.policy.minimumFrontToProfileHeadWidthRatio
  );
  assert.equal(report.summary.opticalHeadWidthWithinTolerance, true);
  assert.equal(report.summary.landmarkFrameCount, 0);
  assert.equal(report.summary.consensusFrameCount, 0);
  assert.equal(report.summary.fixedUnifiedRigFrameCount, 144);
  assert.equal(report.summary.rigHashesMatch, true);
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

test("각 캐릭터의 상하좌우 보행 3컷은 하나의 고정 리그에 고정된다", async () => {
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
      frames.every((frame) => frame.sourceDetectionMethod === "fixed-unified-rig"),
      true,
      `${preset.guest} 12컷은 모두 동일한 고정 광학 리그를 사용해야 합니다.`
    );
  }
});

test("12명 모두 공통 3등신·2.5D 원화 시트를 사용한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    assert.equal(
      preset.sourceSet,
      "v9-unified-optical-rig",
      `${preset.guest} 원화는 통일 광학 리그에서 생성돼야 합니다.`
    );
  }

  const unifiedSourceRoot = join(
    root,
    "character-assets/reference/guest-unified-rig-sources/v9"
  );
  await Promise.all(catalog.presets.map((preset) => access(join(
    unifiedSourceRoot,
    `${preset.reference.walkSourceGuest}-walk-sheet.png`
  ))));
});

test("통일 리그의 정면과 측면 머리 부피는 광학 허용 범위 안에 있다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    assert.ok(
      preset.opticalHead.frontToProfileHeadWidthRatio
        <= report.policy.maximumFrontToProfileHeadWidthRatio,
      `${preset.guest} 정면 머리 부피가 측면 평균보다 과도하게 커서는 안 됩니다.`
    );
    assert.ok(
      preset.opticalHead.frontToProfileHeadWidthRatio
        >= report.policy.minimumFrontToProfileHeadWidthRatio,
      `${preset.guest} 정면 머리 부피가 측면 평균보다 과도하게 작아서는 안 됩니다.`
    );
    assert.ok(
      preset.opticalHead.leftRightHeadWidthDifferenceRatio <= 0.03,
      `${preset.guest} 좌우 머리 부피 차이가 광학 허용 범위를 넘으면 안 됩니다.`
    );
  }
});

test("통일 광학 리그는 모든 방향과 캐릭터의 머리 실루엣을 2px 안에 고정한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    const headWidths = Object.values(preset.directions)
      .flat()
      .map((frame) => frame.headWidth);
    assert.ok(
      Math.max(...headWidths) - Math.min(...headWidths) <= 2,
      `${preset.guest} 방향별 머리 실루엣 편차는 2px 이하여야 합니다.`
    );
  }
});

test("1번 캐릭터 정면 머리 부피는 측면과 2px 이내를 유지한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });
  const guest01 = report.presets.find((preset) => preset.guest === "guest-01");

  assert.ok(guest01, "guest-01 감사 결과가 필요합니다.");
  assert.ok(
    Math.abs(
      guest01.opticalHead.downMedianHeadWidth
        - guest01.opticalHead.profileMedianHeadWidth
    ) <= 2,
    "guest-01 정면 머리 실루엣은 측면 평균과 2px 이상 벌어지면 안 됩니다."
  );
  assert.ok(
    guest01.opticalHead.frontToProfileHeadWidthRatio
      <= report.policy.maximumFrontToProfileHeadWidthRatio,
    "guest-01 정면/측면 머리 부피 비율은 공통 광학 리그 안에 있어야 합니다."
  );
});

test("통일 광학 리그 보행 리듬과 최종 프레임 중심·발 기준선은 안정적이다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
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

test("통일 광학 리그 12종은 선택 화면과 게임의 실제 보행 포즈로 이어진다", async () => {
  const policy = catalog.frame.selectionPreview;
  const sourceRoot = join(root, "character-assets/reference/guest-unified-rig-sources/v9");
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

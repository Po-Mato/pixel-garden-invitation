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

function opaqueSpanInRows(data, info, firstRow) {
  let left = info.width;
  let right = -1;
  for (let y = firstRow; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= 12) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return right >= left ? right - left + 1 : 0;
}

test("선택 화면의 12명 192프레임은 2배 해상도와 동일한 3등신 기준을 지킨다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  assert.equal(report.version, 14);
  assert.deepEqual(report.policy.source, { width: 192, height: 288 });
  assert.equal(report.summary.presetCount, 12);
  assert.equal(report.summary.frameCount, 192);
  assert.equal(report.summary.rigBodyToHeadRatio, 2);
  assert.equal(report.summary.measuredHeadHeightWithinTolerance, true);
  assert.ok(report.summary.minimumMeasuredHeadHeight >= report.policy.headHeight - 1);
  assert.ok(report.summary.maximumMeasuredHeadHeight <= report.policy.headHeight + 1);
  assert.ok(report.summary.maximumHeadHeightDelta <= 1);
  assert.ok(
    report.summary.maximumDirectionHeadHeightSpread
      <= report.policy.maximumDirectionHeadHeightSpread
  );
  assert.equal(report.summary.minimumMeasuredHeadHeight, report.policy.headHeight);
  assert.equal(report.summary.maximumMeasuredHeadHeight, report.policy.headHeight);
  assert.equal(report.summary.opticalHeadWidthWithinTolerance, true);
  assert.equal(report.summary.landmarkFrameCount, 0);
  assert.equal(report.summary.consensusFrameCount, 0);
  assert.equal(report.summary.faceSafeRigFrameCount, 192);
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
  assert.equal(report.summary.fourStepGaitPassed, true);
  assert.equal(report.summary.directionConsistencyPassed, true);
  assert.equal(report.summary.maximumCanonicalDirectionAlphaDifference, 0);
  assert.equal(report.summary.maximumCanonicalDirectionRgbaDifference, 0);
  assert.ok(
    report.summary.maximumRuntimeCoreCenterDriftDisplayPx
      <= report.runtimeMotion.policy.maximumCoreCenterDriftDisplayPx
  );
  assert.equal(report.summary.runtimeMotionWithinTolerance, true);
  assert.equal(report.summary.passed, true);
});

test("각 캐릭터의 상하좌우 보행 4컷은 하나의 고정 리그에 고정된다", async () => {
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
      frames.every((frame) => frame.sourceDetectionMethod === "face-safe-three-head-rig"),
      true,
      `${preset.guest} 16컷은 모두 동일한 고정 광학 리그를 사용해야 합니다.`
    );
  }
});

test("12명 모두 공통 3등신·2.5D 리그의 중립 분리 보행을 사용한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    assert.equal(preset.sourceSet, "v10-alpha-safe-unified-rig");
  }

  const unifiedSourceRoot = join(
    root,
    "character-assets/reference/guest-unified-rig-sources/v10"
  );
  await Promise.all(catalog.presets.map((preset) => access(join(
    unifiedSourceRoot,
    `${preset.reference.walkSourceGuest}-walk-sheet.png`
  ))));
});

test("얼굴 보존 리그의 정면·측면 머리와 좌우 얼굴은 안전 허용 범위 안에 있다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    assert.ok(
      preset.opticalHead.frontToProfileHeadWidthRatio
        <= report.policy.maximumSafeFrontToProfileHeadWidthRatio,
      `${preset.guest} 정면 머리 부피가 측면 평균보다 과도하게 커서는 안 됩니다.`
    );
    assert.ok(
      preset.opticalHead.frontToProfileHeadWidthRatio
        >= report.policy.minimumSafeFrontToProfileHeadWidthRatio,
      `${preset.guest} 정면 머리 부피가 측면 평균보다 과도하게 작아서는 안 됩니다.`
    );
    assert.ok(
      preset.opticalHead.leftRightHeadWidthDifferenceRatio
        <= report.policy.maximumSafeLeftRightHeadWidthDifferenceRatio,
      `${preset.guest} 좌우 머리 부피 차이가 광학 허용 범위를 넘으면 안 됩니다.`
    );
    assert.ok(
      preset.opticalFace.leftRightFaceWidthDifferenceRatio
        <= report.policy.maximumSafeLeftRightFaceWidthDifferenceRatio,
      `${preset.guest} 좌우 얼굴 폭은 같은 비율이어야 합니다.`
    );
  }
});

test("2번부터 12번까지 최종 좌·우 4컷은 픽셀 단위의 정확한 반전이다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets.filter((item) => item.guest !== "guest-01")) {
    assert.equal(preset.directionConsistency.required, true);
    assert.equal(preset.directionConsistency.passed, true, `${preset.guest} 좌우 방향 일치`);
    assert.equal(preset.directionConsistency.stepDifferences.length, 4);
    assert.equal(preset.directionConsistency.maximumAlphaDifference, 0);
    assert.equal(preset.directionConsistency.maximumRgbaDifference, 0);
  }
});

test("1번 캐릭터 정면 얼굴은 측면 대비 별도 강화 기준을 지킨다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });
  const guest01 = report.presets.find((preset) => preset.guest === "guest-01");

  assert.ok(guest01, "guest-01 감사 결과가 필요합니다.");
  assert.ok(
    guest01.opticalFace.frontToProfileFaceWidthRatio
      <= report.policy.maximumSafeFrontToProfileFaceWidthRatioByGuest["guest-01"],
    "guest-01 정면 얼굴 폭은 측면 대비 강화 기준을 넘으면 안 됩니다."
  );
  assert.ok(
    guest01.opticalFace.frontToProfileFaceAreaRatio
      <= report.policy.maximumSafeFrontToProfileFaceAreaRatioByGuest["guest-01"],
    "guest-01 정면 얼굴 면적은 측면 대비 강화 기준을 넘으면 안 됩니다."
  );
});

test("1번 캐릭터는 광학 3등신·고정 가방과 꺾이지 않는 측면 발 리그를 유지한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });
  const guest01 = report.presets.find((preset) => preset.guest === "guest-01");

  assert.ok(guest01, "guest-01 감사 결과가 필요합니다.");
  assert.equal(report.policy.guest01OpticalHeadCompensation, 20);
  assert.equal(report.summary.guest01AccessoryStable, true);
  assert.equal(guest01.accessoryStability.passed, true);
  assert.deepEqual(guest01.accessoryStability.anchorSteps, {
    down: 1,
    left: 1,
    right: 1,
    up: 0
  });
  assert.deepEqual(report.policy.guest01LowerBodyStrideOffsets, {
    down: [0, 0, 0, 0],
    left: [0, 0, 0, 0],
    right: [0, 0, 0, 0],
    up: [0, 0, 0, 0]
  });
  assert.deepEqual(report.policy.guest01StableSideFootReferenceStep, {
    left: 0,
    right: 0
  });
  for (const direction of ["left", "right"]) {
    const motion = guest01.motion.directions[direction];
    assert.equal(motion.sideFootGeometryStable, true, `guest-01 ${direction} 발 실루엣 고정`);
    assert.equal(motion.neutralPairSameSilhouette, true, `guest-01 ${direction} 2·4컷 중립 발 고정`);
    assert.ok(
      motion.oppositeFootDifference.alpha
        <= report.policy.maximumGuest01SideOppositeFootAlphaDifference,
      `guest-01 ${direction} 1·3컷에서 발목 형태가 꺾이면 안 됩니다.`
    );
    assert.ok(
      motion.oppositeFootDifference.rgba
        >= report.policy.minimumGuest01OppositeFootRgbaDifference,
      `guest-01 ${direction} 1·3컷은 앞·뒤 다리 명암이 교대돼야 합니다.`
    );
  }
  assert.ok(
    guest01.motion.maximumCenterDrift <= report.policy.maximumStrideCenterDrift,
    "guest-01의 확대된 3등신 리그에서도 보행 중심이 안정돼야 합니다."
  );

  const frames = Object.values(guest01.directions).flat();
  assert.equal(
    frames.every((frame) => frame.opticalHeadCompensation === 20),
    true,
    "guest-01의 16컷은 같은 광학 머리 보정량을 사용해야 합니다."
  );
  assert.equal(
    frames.every((frame) => (
      frame.estimatedOpticalHeadHeight >= report.policy.contentHeight * 0.4
    )),
    true,
    "guest-01 머리 실루엣은 긴 원피스의 4등신 착시를 상쇄하도록 충분히 확대돼야 합니다."
  );
  for (const direction of Object.values(guest01.accessoryStability.directions)) {
    assert.equal(direction.stable, true);
    assert.equal(new Set(direction.hashes).size, 1);
  }
});

test("3번 캐릭터는 수트의 긴 세로선을 상쇄하는 광학 3등신을 유지한다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });
  const guest03 = report.presets.find((preset) => preset.guest === "guest-03");

  assert.ok(guest03, "guest-03 감사 결과가 필요합니다.");
  assert.equal(report.policy.guest03OpticalHeadCompensation, 10);
  assert.equal(report.policy.guest03MaximumHeadWidthDelta, 1);
  assert.deepEqual(report.policy.guest03HeadWidthsByDirection, {
    down: 96,
    left: 105,
    right: 105,
    up: 96
  });
  assert.ok(
    guest03.opticalHead.frontToProfileHeadWidthRatio >= 0.9
      && guest03.opticalHead.frontToProfileHeadWidthRatio <= 1.1,
    "guest-03 정면과 측면의 전체 머리 부피가 같은 크기로 읽혀야 합니다."
  );
  assert.ok(
    guest03.opticalFace.frontToProfileFaceWidthRatio
      <= report.policy.maximumSafeFrontToProfileFaceWidthRatioByGuest["guest-03"],
    "guest-03 정면 얼굴 폭은 측면 대비 강화 기준을 넘으면 안 됩니다."
  );
  assert.ok(
    guest03.opticalFace.frontToProfileFaceAreaRatio
      <= report.policy.maximumSafeFrontToProfileFaceAreaRatioByGuest["guest-03"],
    "guest-03 정면 얼굴 면적은 측면 대비 강화 기준을 넘으면 안 됩니다."
  );
  assert.ok(
    guest03.motion.maximumCenterDrift <= report.policy.maximumStrideCenterDrift,
    "guest-03의 확대된 머리 리그에서도 보행 중심이 안정돼야 합니다."
  );

  const frames = Object.values(guest03.directions).flat();
  assert.deepEqual(
    guest03.opticalHead.headWidthsByDirection,
    {
      down: [96, 96, 96, 96],
      left: [105, 105, 105, 105],
      right: [105, 105, 105, 105],
      up: [96, 96, 96, 96]
    },
    "guest-03의 방향·보행 프레임이 바뀌어도 머리 폭은 같아야 합니다."
  );
  assert.equal(guest03.opticalHead.maximumStepHeadWidthSpreadRatio, 0);
  assert.ok(
    guest03.opticalHead.maximumAllFrameHeadWidthSpreadRatio <= 0.094,
    "정면·후면과 측면의 자연스러운 모량 차이만 허용합니다."
  );
  assert.equal(
    frames.every((frame) => (
      frame.measuredHeadHeight === report.policy.headHeight
      && frame.measuredBodyHeight === report.policy.bodyHeight
      && frame.characterHeight === report.policy.contentHeight
      && frame.bottom === report.policy.footBaseline
    )),
    true,
    "guest-03의 16컷은 머리·몸·전체 높이와 발 기준선이 모두 같아야 합니다."
  );
  assert.equal(guest03.proportionStability.passed, true);
  assert.equal(guest03.proportionStability.bandBottom, 110);
  for (const direction of Object.values(guest03.proportionStability.directions)) {
    assert.equal(direction.stable, true);
    assert.equal(new Set(direction.hashes).size, 1);
  }
  for (const direction of ["down", "left", "right"]) {
    const directionFrames = guest03.directions[direction];
    assert.equal(new Set(directionFrames.map((frame) => frame.visibleFaceWidth)).size, 1);
    assert.equal(new Set(directionFrames.map((frame) => frame.visibleFaceHeight)).size, 1);
    assert.equal(new Set(directionFrames.map((frame) => frame.visibleFaceArea)).size, 1);
    assert.equal(new Set(directionFrames.map((frame) => frame.visibleFaceCenterYRatio)).size, 1);
  }
  const runtimeGuest03 = report.runtimeMotion.presets.find(
    (preset) => preset.guest === "guest-03"
  );
  assert.ok(runtimeGuest03);
  assert.equal(report.runtimeMotion.summary.guest03ProportionStable, true);
  assert.equal(runtimeGuest03.proportionStable, true);
  for (const direction of Object.values(runtimeGuest03.directions)) {
    assert.equal(direction.proportionStable, true);
    assert.equal(new Set(direction.proportionHashes).size, 1);
  }
  assert.equal(
    frames.every((frame) => frame.opticalHeadCompensation === 10),
    true,
    "guest-03의 16컷은 같은 광학 머리 보정량을 사용해야 합니다."
  );
  assert.equal(
    frames.every((frame) => (
      frame.estimatedOpticalHeadHeight >= report.policy.contentHeight * 0.37
    )),
    true,
    "guest-03 머리 실루엣은 수트의 4등신 착시를 상쇄하도록 충분히 확대돼야 합니다."
  );
});

test("v10 원화는 실제 투명 배경과 정확한 좌우 반전 방향을 보장한다", async () => {
  const sourceRoot = join(root, "character-assets/reference/guest-unified-rig-sources/v10");
  const integrity = JSON.parse(await readFile(
    join(sourceRoot, "source-integrity-audit.json"),
    "utf8"
  ));

  assert.equal(integrity.version, 10);
  assert.equal(integrity.summary.presetCount, 12);
  assert.equal(integrity.summary.appliedAlphaMaskSourceCount, 9);
  assert.equal(integrity.summary.preservedAlphaSourceCount, 3);
  assert.equal(integrity.summary.maximumBorderOpaquePercentage, 0);
  assert.equal(integrity.summary.maximumLeftRightMirroredDifference, 0);
  assert.equal(integrity.summary.passed, true);

  const cellWidth = 1086 / 3;
  const cellHeight = 1448 / 4;
  for (const preset of catalog.presets) {
    const guest = preset.reference.walkSourceGuest;
    const source = join(sourceRoot, `${guest}-walk-sheet.png`);
    const { data, info } = await sharp(source)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let transparentPixels = 0;
    let borderOpaquePixels = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const alpha = data[(y * info.width + x) * 4 + 3];
        if (alpha <= 8) transparentPixels += 1;
        if (
          alpha > 8
          && (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1)
        ) borderOpaquePixels += 1;
      }
    }
    assert.ok(
      transparentPixels / (info.width * info.height) >= 0.6,
      `${guest} 원화에는 실제 투명 알파가 있어야 합니다.`
    );
    assert.equal(borderOpaquePixels, 0, `${guest} 시트 외곽에는 배경 잔여물이 없어야 합니다.`);

    for (let column = 0; column < 3; column += 1) {
      const left = await sharp(source).extract({
        left: column * cellWidth,
        top: cellHeight,
        width: cellWidth,
        height: cellHeight
      }).flop().ensureAlpha().raw().toBuffer();
      const right = await sharp(source).extract({
        left: column * cellWidth,
        top: cellHeight * 2,
        width: cellWidth,
        height: cellHeight
      }).ensureAlpha().raw().toBuffer();
      assert.equal(
        Buffer.compare(left, right),
        0,
        `${guest} 좌우 ${column + 1}번 보행 컷은 정확한 반전이어야 합니다.`
      );
    }
  }
});

test("흰색·크림색 복장은 투명 배경 분리 후에도 충분한 면적으로 보존된다", async () => {
  const minimumBrightGarmentPixels = {
    "guest-06": 30_000,
    "guest-07": 60_000,
    "guest-09": 10_000,
    "guest-11": 20_000,
    "guest-12": 30_000
  };
  const sourceRoot = join(root, "character-assets/reference/guest-unified-rig-sources/v10");

  for (const [guest, minimumPixels] of Object.entries(minimumBrightGarmentPixels)) {
    const { data } = await sharp(join(sourceRoot, `${guest}-walk-sheet.png`))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let brightPixels = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2]);
      const maximum = Math.max(data[offset], data[offset + 1], data[offset + 2]);
      if (data[offset + 3] > 220 && minimum >= 205 && maximum - minimum <= 45) {
        brightPixels += 1;
      }
    }
    assert.ok(
      brightPixels >= minimumPixels,
      `${guest} 흰색·크림색 복장 픽셀이 배경과 함께 삭제되면 안 됩니다.`
    );
  }
});

test("통일 광학 리그 보행 리듬과 최종 프레임 중심·발 기준선은 안정적이다", async () => {
  const report = await auditGuestSelectionPreviewAssets({ catalog });

  for (const preset of report.presets) {
    assert.ok(preset.motion.maximumCenterDrift <= report.policy.maximumStrideCenterDrift);
    assert.ok(
      preset.motion.maximumStepBaselineSpread <= report.policy.maximumStepBaselineSpread,
      `${preset.guest} 보행 중 발 기준선이 흔들리면 안 됩니다.`
    );
    assert.equal(preset.motion.fourStepGaitPassed, true);
    for (const [directionName, direction] of Object.entries(preset.motion.directions)) {
      assert.equal(direction.neutralPairPassed, true);
      assert.equal(
        direction.neutralPairSameSilhouette,
        true,
        `${preset.guest} ${directionName} 2·4컷 전체 실루엣 고정`
      );
      assert.equal(
        direction.neutralUpperBodyStable,
        true,
        `${preset.guest} ${directionName} 2·4컷 상체·의상 고정`
      );
      if (preset.guest === "guest-01" || preset.guest === "guest-03") {
        assert.equal(
          direction.neutralPairDistinct,
          true,
          `${preset.guest} ${directionName} 특수 중립 하중 교대`
        );
      } else {
        assert.equal(
          direction.neutralPairExact,
          true,
          `${preset.guest} ${directionName} 2·4컷 완전 동일 중립 자세`
        );
      }
      assert.equal(direction.oppositeFootPassed, true);
    }
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

test("통일 광학 리그 12종은 반대 발 착지 사이에 2·4번 중립 포즈를 둔다", async () => {
  const policy = catalog.frame.selectionPreview;
  const sourceRoot = join(root, "character-assets/reference/guest-unified-rig-sources/v10");
  const previewRoot = join(root, "character-assets/source/guests-preview");

  for (const preset of catalog.presets) {
    const guest = preset.reference.walkSourceGuest;
    await access(join(sourceRoot, `${guest}-walk-sheet.png`));
    const walkPath = join(previewRoot, `${preset.id}__walk.png`);
    for (let row = 0; row < 4; row += 1) {
      const frames = [];
      for (let column = 0; column < 4; column += 1) {
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

test("3번 캐릭터의 네 방향 2·4컷은 무릎을 들지 않는 중립 자세다", async () => {
  const policy = catalog.frame.selectionPreview;
  const report = await auditGuestSelectionPreviewAssets({ catalog });
  const guest03 = report.presets.find((preset) => preset.guest === "guest-03");
  const walkPath = join(
    root,
    "character-assets/source/guests-preview/masculine-navy-suit__walk.png"
  );
  const footBandTop = Math.floor(policy.source.height * 0.82);

  assert.ok(guest03);
  for (const [direction, motion] of Object.entries(guest03.motion.directions)) {
    assert.equal(motion.neutralPairPassed, true, `guest-03 ${direction} 2·4컷 중립`);
    assert.equal(motion.neutralPairDistinct, true, `guest-03 ${direction} 2·4컷 발 하중 교대`);
    assert.ok(
      motion.oppositeFootDifference.alpha
        >= report.policy.minimumGuest03OppositeFootAlphaDifference,
      `guest-03 ${direction} 1·3컷은 실제 반대 발 실루엣 차이가 있어야 합니다.`
    );
    assert.ok(
      motion.oppositeFootDifference.rgba
        >= report.policy.minimumGuest03OppositeFootRgbaDifference,
      `guest-03 ${direction} 1·3컷은 앞·뒤 다리 명암이 반대로 보여야 합니다.`
    );
  }

  for (let row = 0; row < 4; row += 1) {
    const spans = [];
    for (let column = 0; column < 4; column += 1) {
      const { data, info } = await sharp(walkPath)
        .extract({
          left: column * policy.source.width,
          top: row * policy.source.height,
          width: policy.source.width,
          height: policy.source.height
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      spans.push(opaqueSpanInRows(data, info, footBandTop));
    }

    assert.equal(spans[1], spans[3], `guest-03 ${catalog.frame.walk.rows[row]} 중립 발 폭`);
    if (row === 1 || row === 2) {
      assert.ok(
        spans[1] <= Math.min(spans[0], spans[2]) * 0.6,
        `guest-03 ${catalog.frame.walk.rows[row]} 2·4컷은 옆모습 발을 모아야 합니다: ${spans.join(", ")}`
      );
    } else {
      assert.ok(
        spans[1] >= Math.max(spans[0], spans[2]),
        `guest-03 ${catalog.frame.walk.rows[row]} 2·4컷은 두 발이 바닥에 보여야 합니다: ${spans.join(", ")}`
      );
    }
  }
});

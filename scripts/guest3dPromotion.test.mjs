import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { assertAcceptedAudit, promoteGuest3dPilots } from "./promote-guest-3d-pilots.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "character-assets/guest-character-presets.json");
const pilotRoot = path.join(root, "character-assets/reference/guest-3d-master-sources/v1");

test("검증된 12명 3D 시트를 게임 원본 규격으로 승격한다", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "guest-3d-promotion-"));
  const comparisonDir = await mkdtemp(path.join(tmpdir(), "guest-3d-promotion-repeat-"));

  try {
    const promoted = await promoteGuest3dPilots({ catalogPath, pilotRoot, outputDir });
    const repeated = await promoteGuest3dPilots({ catalogPath, pilotRoot, outputDir: comparisonDir });
    assert.equal(promoted.length, 24);
    assert.equal(new Set(promoted.map((item) => item.guestId)).size, 12);

    for (const item of promoted) {
      const metadata = await sharp(item.destination).metadata();
      const expected = item.kind === "walk" ? { width: 384, height: 576 } : { width: 192, height: 144 };
      assert.equal(metadata.width, expected.width, item.destination);
      assert.equal(metadata.height, expected.height, item.destination);
      assert.equal(metadata.hasAlpha, true, item.destination);
    }

    const first = promoted[0];
    const source = path.join(pilotRoot, first.guestId, "pilot", `${first.guestId}__walk-soft-pilot.png`);
    assert.notDeepEqual(await readFile(first.destination), await readFile(source));
    assert.deepEqual(await readFile(first.destination), await readFile(repeated[0].destination));

    const sourceRaw = await sharp(source).ensureAlpha().raw().toBuffer();
    const promotedRaw = await sharp(first.destination).ensureAlpha().raw().toBuffer();
    let changedColorChannels = 0;
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        for (let y = 0; y < 144; y += 1) {
          for (let x = 0; x < 96; x += 1) {
            const sourceOffset = ((row * 144 + y) * 288 + column * 96 + x) * 4;
            const promotedOffset = ((row * 144 + y) * 384 + column * 96 + x) * 4;
            assert.equal(promotedRaw[promotedOffset + 3], sourceRaw[sourceOffset + 3]);
            if (promotedRaw[promotedOffset + 3] === 0) {
              assert.deepEqual([...promotedRaw.subarray(promotedOffset, promotedOffset + 3)], [0, 0, 0]);
            }
            for (let channel = 0; channel < 3; channel += 1) {
              if (promotedRaw[promotedOffset + channel] !== sourceRaw[sourceOffset + channel]) {
                changedColorChannels += 1;
              }
            }
          }
        }
      }
    }
    assert.ok(changedColorChannels > 10_000, "공통 입체 명암이 충분한 픽셀에 적용돼야 합니다.");

    for (let row = 0; row < 4; row += 1) {
      const second = await sharp(first.destination)
        .extract({ left: 96, top: row * 144 + 101, width: 96, height: 43 })
        .ensureAlpha()
        .raw()
        .toBuffer();
      const fourth = await sharp(first.destination)
        .extract({ left: 288, top: row * 144 + 101, width: 96, height: 43 })
        .ensureAlpha()
        .raw()
        .toBuffer();
      assert.notDeepEqual(fourth, second, `row ${row} 네 번째 컷은 반대발이어야 합니다.`);
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true });
    await rm(comparisonDir, { recursive: true, force: true });
  }
});

test("필수 감사 실패는 원본 승격 전에 차단한다", () => {
  assert.throws(
    () =>
      assertAcceptedAudit(
        {
          guest: "guest-01",
          acceptance: {
            frameCount: 12,
            allFrameSizesMatch: true,
            greenFringePixels: 1,
            headSizeConsistency: { passed: true },
            rearHairConsistency: { passed: true }
          }
        },
        "guest-01"
      ),
    /필수 품질 감사/
  );
});

test("12명 모두 상하좌우와 보행 3컷의 머리 크기를 일정하게 유지한다", async () => {
  for (let index = 1; index <= 12; index += 1) {
    const guestId = `guest-${String(index).padStart(2, "0")}`;
    const audit = JSON.parse(
      await readFile(path.join(pilotRoot, guestId, "pilot", "audit.json"), "utf8")
    );
    const consistency = audit.acceptance?.headSizeConsistency;
    const gait = audit.acceptance?.gaitCycle;

    assert.equal(consistency?.passed, true, `${guestId} 머리 크기 감사`);
    assert.ok(
      consistency.maximumDirectionRatio <= 1.1,
      `${guestId} 방향별 머리 폭 편차: ${consistency.maximumDirectionRatio}`
    );
    assert.ok(
      consistency.maximumStepDelta <= 2,
      `${guestId} 보행 프레임 머리 폭 편차: ${consistency.maximumStepDelta}`
    );
    assert.equal(gait?.passed, true, `${guestId} 보행 동작 감사`);
    for (const direction of ["left", "right"]) {
      assert.ok(gait.directions[direction].neutralSpanRatio <= 0.75);
      assert.ok(gait.directions[direction].alternation.alpha >= 0.04);
      assert.ok(gait.directions[direction].alternation.rgba >= 0.04);
    }
    for (const direction of ["down", "up"]) {
      assert.ok(gait.directions[direction].mirroredAlternation.alpha <= 0.01);
      assert.ok(gait.directions[direction].mirroredAlternation.rgba <= 0.01);
      assert.ok(gait.directions[direction].directAlternation.rgba >= 0.07);
      assert.ok(gait.directions[direction].neutralDifference.rgba >= 0.065);
    }
    const proportion = audit.acceptance?.threeHeadProportion;
    assert.equal(proportion?.passed, true, `${guestId} 실제 턱선 3등신 비율`);
    assert.match(audit.verticalRatioNormalization?.sourceRenderDigest ?? "", /^[a-f0-9]{64}$/);
    assert.ok(proportion.maximumRatioErrorPixels <= 1);
    for (const direction of Object.values(proportion.directions)) {
      assert.ok(Math.abs(direction.bodyHeight - direction.headHeight * 2) <= 1);
      assert.equal(direction.boundaryY, 48);
    }
    if (guestId === "guest-12") {
      const shape = audit.acceptance?.headShapeConsistency;
      assert.equal(shape?.passed, true, "guest-12 머리 형태 일관성");
      assert.ok(shape.maximumDirectionRatio <= 1.03);
      for (const ratio of Object.values(shape.aspectRatios)) {
        assert.ok(ratio >= 0.97 && ratio <= 1.03);
      }
    }
  }
});

test("실제 턱선 3등신 감사 누락은 모든 하객 승격 전에 차단한다", () => {
  assert.throws(
    () =>
      assertAcceptedAudit(
        {
          guest: "guest-01",
          acceptance: {
            frameCount: 12,
            allFrameSizesMatch: true,
            greenFringePixels: 0,
            headSizeConsistency: { passed: true },
            rearHairConsistency: { passed: true }
          }
        },
        "guest-01"
      ),
    /필수 품질 감사/
  );
});

test("보행 동작 감사 실패도 원본 승격 전에 차단한다", () => {
  assert.throws(
    () =>
      assertAcceptedAudit(
        {
          guest: "guest-01",
          acceptance: {
            frameCount: 12,
            allFrameSizesMatch: true,
            greenFringePixels: 0,
            headSizeConsistency: { passed: true },
            gaitCycle: { passed: false },
            threeHeadProportion: { passed: true },
            rearHairConsistency: { passed: true }
          }
        },
        "guest-01"
      ),
    /필수 품질 감사/
  );
});

test("방향별 머리 크기 감사 실패도 원본 승격 전에 차단한다", () => {
  assert.throws(
    () =>
      assertAcceptedAudit(
        {
          guest: "guest-12",
          acceptance: {
            frameCount: 12,
            allFrameSizesMatch: true,
            greenFringePixels: 0,
            headSizeConsistency: { passed: false },
            rearHairConsistency: { passed: true }
          }
        },
        "guest-12"
      ),
    /필수 품질 감사/
  );
});

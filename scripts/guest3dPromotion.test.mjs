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
      const expected = item.kind === "walk" ? { width: 288, height: 576 } : { width: 192, height: 144 };
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
    for (let offset = 0; offset < sourceRaw.length; offset += 4) {
      assert.equal(promotedRaw[offset + 3], sourceRaw[offset + 3], `alpha offset ${offset}`);
      if (promotedRaw[offset + 3] === 0) {
        assert.deepEqual([...promotedRaw.subarray(offset, offset + 3)], [0, 0, 0]);
      }
      for (let channel = 0; channel < 3; channel += 1) {
        if (promotedRaw[offset + channel] !== sourceRaw[offset + channel]) changedColorChannels += 1;
      }
    }
    assert.ok(changedColorChannels > 10_000, "공통 입체 명암이 충분한 픽셀에 적용돼야 합니다.");
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

    assert.equal(consistency?.passed, true, `${guestId} 머리 크기 감사`);
    assert.ok(
      consistency.maximumDirectionRatio <= 1.1,
      `${guestId} 방향별 머리 폭 편차: ${consistency.maximumDirectionRatio}`
    );
    assert.ok(
      consistency.maximumStepDelta <= 2,
      `${guestId} 보행 프레임 머리 폭 편차: ${consistency.maximumStepDelta}`
    );
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

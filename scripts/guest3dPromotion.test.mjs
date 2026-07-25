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
            rearHairConsistency: { passed: true }
          }
        },
        "guest-01"
      ),
    /필수 품질 감사/
  );
});

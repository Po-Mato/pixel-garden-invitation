import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pilotRoot = join(root, "character-assets/reference/guest-selection-pilots/v4-flat");

const guests = Array.from({ length: 12 }, (_, index) => `guest-${String(index + 1).padStart(2, "0")}`);

for (const guest of guests) {
  test(`${guest} flat pilot keeps the exact shared three-head rig`, async () => {
    const pilotPath = join(pilotRoot, `${guest}-turnaround-pilot.png`);
    const audit = JSON.parse(await readFile(join(pilotRoot, `${guest}-audit.json`), "utf8"));
    const metadata = await sharp(pilotPath).metadata();
    const { data, info } = await sharp(pilotPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    assert.equal(metadata.width, 1536);
    assert.equal(metadata.height, 576);
    assert.equal(metadata.hasAlpha, true);
    assert.equal(metadata.isPalette, true);
    assert.deepEqual(audit.exactThreeHeadRig, {
      headBoundary: "crown-to-neck-junction; the shared proxy for the hidden rear-view chin",
      crownY: 24,
      chinY: 192,
      footY: 528,
      headHeight: 168,
      bodyBelowChinHeight: 336,
      totalCharacterHeight: 504,
      targetRatio: "1:2",
    });
    assert.equal(
      audit.segmentation,
      "four foreground groups detected from transparent column gaps; no fixed-quarter clipping",
    );
    assert.equal(audit.reviewStatus, "passed");
    assert.deepEqual(audit.acceptance, {
      ratio: true,
      fourDirectionLandmarks: true,
      flatness: true,
      transparentBackground: true,
    });
    assert.equal(audit.directions.length, 4);

    const opaqueColors = new Set();
    for (let index = 0; index < data.length; index += info.channels) {
      if (data[index + 3] < 16) continue;
      opaqueColors.add(`${data[index]},${data[index + 1]},${data[index + 2]}`);
    }
    assert.ok(opaqueColors.size <= 40, `${guest} uses ${opaqueColors.size} opaque colors; maximum is 40`);

    for (let lane = 0; lane < 4; lane += 1) {
      let top = info.height;
      let bottom = -1;
      for (let y = 0; y < info.height; y += 1) {
        for (let x = lane * 384; x < (lane + 1) * 384; x += 1) {
          if (data[(y * info.width + x) * info.channels + 3] < 16) continue;
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
      assert.equal(top, 24, `${guest} lane ${lane + 1} crown`);
      assert.equal(bottom, 527, `${guest} lane ${lane + 1} foot pixel`);
    }
  });
}

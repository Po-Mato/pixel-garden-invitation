import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { buildAllCouplePuppetAssets, couplePuppetLayout } from "./build-couple-puppet-assets.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");

test("신랑·신부 퍼펫을 같은 3등신 캔버스에 생성한다", async () => {
  await buildAllCouplePuppetAssets();

  assert.equal(couplePuppetLayout.character.bodyVisibleHeight, couplePuppetLayout.character.headHeight * 2);

  for (const characterId of ["bride", "groom"]) {
    const outputDir = path.join(rootDir, "client/public/characters/puppets", characterId);
    for (const fileName of ["body.webp", "head-open.webp", "head-blink.webp", "preview.webp", "rig.json"]) {
      await access(path.join(outputDir, fileName));
    }
    const metadata = await sharp(path.join(outputDir, "preview.webp")).metadata();
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 768);
    assert.equal(metadata.hasAlpha, true);
  }
});

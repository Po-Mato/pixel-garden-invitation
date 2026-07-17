import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { splitJoystickDesignSheet } from "./split-joystick-design-sheet.mjs";

test("splits the two largest joystick components into normalized transparent assets", async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), "joystick-asset-"));
  const input = join(fixtureDir, "sheet.png");
  const baseOutput = join(fixtureDir, "base.png");
  const thumbOutput = join(fixtureDir, "thumb.png");

  try {
    const sheet = Buffer.alloc(320 * 180 * 4);

    for (let y = 20; y < 160; y += 1) {
      for (let x = 20; x < 160; x += 1) {
        const offset = (y * 320 + x) * 4;
        sheet.set([245, 234, 218, 255], offset);
      }
    }

    for (let y = 60; y < 120; y += 1) {
      for (let x = 230; x < 290; x += 1) {
        const offset = (y * 320 + x) * 4;
        sheet.set([190, 92, 112, 255], offset);
      }
    }

    await sharp(sheet, { raw: { width: 320, height: 180, channels: 4 } }).png().toFile(input);

    const result = await splitJoystickDesignSheet({ input, baseOutput, thumbOutput });

    assert.deepEqual(result, {
      base: { width: 180, height: 180 },
      thumb: { width: 68, height: 68 }
    });

    const baseMetadata = await sharp(baseOutput).metadata();
    const thumbMetadata = await sharp(thumbOutput).metadata();
    assert.equal(baseMetadata.channels, 4);
    assert.equal(thumbMetadata.channels, 4);

    const baseCorner = await sharp(baseOutput).ensureAlpha().raw().toBuffer();
    const thumbCorner = await sharp(thumbOutput).ensureAlpha().raw().toBuffer();
    assert.equal(baseCorner[3], 0);
    assert.equal(thumbCorner[3], 0);
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

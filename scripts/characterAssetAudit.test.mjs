import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  alphaDifference,
  inspectSheet,
  silhouetteHash
} from "./lib/characterAssetAudit.mjs";

async function withTemporaryPng(width, height, data, callback) {
  const directory = await mkdtemp(join(tmpdir(), "character-asset-audit-"));
  const file = join(directory, "sheet.png");

  try {
    await sharp(data, {
      raw: { width, height, channels: 4 }
    }).png().toFile(file);
    return await callback(file);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("inspectSheet reports frame occupancy, colors, transitions, and bounds", async () => {
  const pixels = Buffer.alloc(4 * 4 * 4);
  const paint = (x, y, color) => {
    const offset = (y * 4 + x) * 4;
    pixels.set(color, offset);
  };
  const red = [255, 0, 0, 255];
  const blue = [0, 0, 255, 255];

  paint(0, 0, red);
  paint(1, 0, red);
  paint(0, 1, blue);
  paint(1, 1, blue);
  paint(2, 2, red);
  paint(3, 3, blue);

  await withTemporaryPng(4, 4, pixels, async (file) => {
    const result = await inspectSheet(file, { frameWidth: 4, frameHeight: 4 });

    assert.equal(result.frames.length, 1);
    assert.equal(result.frames[0].opaquePixels, 6);
    assert.equal(result.frames[0].uniqueOpaqueColors, 2);
    assert.ok(result.frames[0].colorTransitions > 0);
    assert.equal(result.frames[0].bounds.bottom, 3);
    assert.equal(result.uniqueOpaqueColors, 2);
  });
});

test("silhouetteHash ignores recoloring but detects changed alpha occupancy", () => {
  const first = Buffer.from([
    255, 0, 0, 255,
    0, 0, 0, 0
  ]);
  const recolored = Buffer.from([
    0, 255, 255, 255,
    255, 255, 255, 0
  ]);
  const changedAlpha = Buffer.from([
    255, 0, 0, 255,
    255, 255, 255, 255
  ]);

  assert.equal(silhouetteHash(first), silhouetteHash(recolored));
  assert.notEqual(silhouetteHash(first), silhouetteHash(changedAlpha));
});

test("alphaDifference returns the ratio of toggled alpha occupancy", () => {
  const first = Buffer.from([
    255, 0, 0, 255,
    0, 0, 0, 0
  ]);
  const second = Buffer.from([
    255, 0, 0, 0,
    0, 0, 0, 255
  ]);

  assert.equal(alphaDifference(first, second), 1);
});

test("alphaDifference rejects RGBA buffers with unequal lengths", () => {
  assert.throws(
    () => alphaDifference(Buffer.alloc(4), Buffer.alloc(8)),
    /equal RGBA lengths/
  );
});

test("inspectSheet rejects dimensions not divisible by the frame size", async () => {
  const pixels = Buffer.alloc(5 * 4 * 4);

  await withTemporaryPng(5, 4, pixels, async (file) => {
    await assert.rejects(
      () => inspectSheet(file, { frameWidth: 4, frameHeight: 4 }),
      /divisible by 4x4/
    );
  });
});

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  alphaDifference,
  collectStyleComparisonFailures,
  combinedAlpha,
  inspectSheet,
  rawRgba,
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

test("inspectSheet ignores hidden transparent RGB but counts occupancy and opaque color changes", async () => {
  const pixels = Buffer.from([
    255, 0, 0, 0,
    0, 255, 0, 0,
    0, 0, 255, 255,
    255, 0, 0, 255
  ]);

  await withTemporaryPng(4, 1, pixels, async (file) => {
    const result = await inspectSheet(file, { frameWidth: 4, frameHeight: 1 });

    assert.equal(result.frames[0].colorTransitions, 2);
  });
});

test("inspectSheet extracts multiple frames in row-major order with local bounds", async () => {
  const pixels = Buffer.alloc(4 * 2 * 4);
  const paint = (x, y) => {
    pixels.set([255, 0, 0, 255], (y * 4 + x) * 4);
  };

  paint(0, 0);
  paint(3, 0);
  paint(0, 1);
  paint(1, 1);

  await withTemporaryPng(4, 2, pixels, async (file) => {
    const result = await inspectSheet(file, { frameWidth: 2, frameHeight: 1 });

    assert.deepEqual(
      result.frames.map(({ column, row, opaquePixels, bounds }) => ({
        column,
        row,
        opaquePixels,
        bounds
      })),
      [
        {
          column: 0,
          row: 0,
          opaquePixels: 1,
          bounds: { left: 0, top: 0, right: 0, bottom: 0, width: 1, height: 1 }
        },
        {
          column: 1,
          row: 0,
          opaquePixels: 1,
          bounds: { left: 1, top: 0, right: 1, bottom: 0, width: 1, height: 1 }
        },
        {
          column: 0,
          row: 1,
          opaquePixels: 2,
          bounds: { left: 0, top: 0, right: 1, bottom: 0, width: 2, height: 1 }
        },
        { column: 1, row: 1, opaquePixels: 0, bounds: null }
      ]
    );
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

test("rawRgba preserves decoded image dimensions", async () => {
  const pixels = Buffer.alloc(2 * 3 * 4);

  await withTemporaryPng(2, 3, pixels, async (file) => {
    const image = await rawRgba(file);

    assert.equal(image.width, 2);
    assert.equal(image.height, 3);
    assert.equal(image.data.length, 24);
    assert.ok(Buffer.isBuffer(image.data));
  });
});

test("combinedAlpha rejects equal-length layers with different dimensions", () => {
  assert.throws(
    () =>
      combinedAlpha([
        { width: 2, height: 1, data: Buffer.alloc(8) },
        { width: 1, height: 2, data: Buffer.alloc(8) }
      ]),
    /identical dimensions.*2x1.*1x2/
  );
});

test("style comparison collects dimension errors and continues with valid pairs", () => {
  const occupied = Buffer.from([
    0, 0, 0, 255,
    0, 0, 0, 0
  ]);
  const styles = [
    {
      id: "wide",
      family: "feminine",
      files: ["wide.png"],
      image: { width: 2, height: 1, data: occupied }
    },
    {
      id: "tall",
      family: "feminine",
      files: ["tall.png"],
      image: { width: 1, height: 2, data: Buffer.from(occupied) }
    },
    {
      id: "wide-copy",
      family: "feminine",
      files: ["wide-copy.png"],
      image: { width: 2, height: 1, data: Buffer.from(occupied) }
    }
  ];

  const failures = collectStyleComparisonFailures(styles, 0.01);

  assert.equal(failures.length, 4);
  assert.match(failures[0].message, /wide and tall.*identical dimensions/);
  assert.match(failures[1].message, /duplicates the silhouette/);
  assert.match(failures[2].message, /alpha difference 0\.0000/);
  assert.match(failures[3].message, /tall and wide-copy.*identical dimensions/);
});

test("style comparison collects malformed RGBA errors without skipping later pairs", () => {
  const valid = { width: 1, height: 1, data: Buffer.from([0, 0, 0, 255]) };
  const styles = [
    {
      id: "malformed",
      family: "masculine",
      files: ["malformed.png"],
      image: { width: 1, height: 1, data: Buffer.alloc(8) }
    },
    {
      id: "valid",
      family: "masculine",
      files: ["valid.png"],
      image: valid
    },
    {
      id: "valid-copy",
      family: "masculine",
      files: ["valid-copy.png"],
      image: { ...valid, data: Buffer.from(valid.data) }
    }
  ];

  const failures = collectStyleComparisonFailures(styles, 0.01);

  assert.equal(failures.length, 4);
  assert.match(failures[0].message, /malformed and valid.*data length 8/);
  assert.match(failures[1].message, /malformed and valid-copy.*data length 8/);
  assert.match(failures[2].message, /duplicates the silhouette/);
  assert.match(failures[3].message, /alpha difference 0\.0000/);
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

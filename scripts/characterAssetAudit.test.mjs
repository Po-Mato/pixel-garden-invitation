import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import {
  alphaDifference,
  collectStyleComparisonFailures,
  collectFrameRuleFailures,
  collectRegionColorRuleFailures,
  collectRegionRuleFailures,
  combinedAlpha,
  inspectSheet,
  rawRgba,
  silhouetteHash
} from "./lib/characterAssetAudit.mjs";

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const guestPresetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));

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

async function writeBlankSheet(file, dimensions) {
  await mkdir(dirname(file), { recursive: true });
  await sharp({
    create: {
      width: dimensions.width,
      height: dimensions.height,
      channels: 4,
      background: "#00000000"
    }
  }).png().toFile(file);
}

test("audit CLI rejects invalid guest preset source sheets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "character-asset-audit-cli-"));
  const sourceRoot = join(directory, "source");

  try {
    await cp(join(root, "character-assets/source"), sourceRoot, { recursive: true });
    await writeBlankSheet(join(sourceRoot, "guests", "feminine-long-wave-dress__walk.png"), { width: 144, height: 288 });

    await assert.rejects(
      () =>
        execFileAsync(
          process.execPath,
          [join(root, "scripts/audit-character-assets.mjs"), "--scope=guest-presets"],
          {
            cwd: root,
            env: { ...process.env, CHARACTER_ASSET_SOURCE_ROOT: sourceRoot }
          }
        ),
      (error) => {
        assert.match(
          error.stderr,
          /guests\/feminine-long-wave-dress__walk\.png: .*(must be 288x576|divisible by 96x144)/
        );
        return true;
      }
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("audit CLI validates finished guest preset source sheets", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [join(root, "scripts/audit-character-assets.mjs"), "--scope=guest-presets"],
    { cwd: root }
  );

  assert.match(stdout, /guest-presets/);
  assert.match(stdout, /Character asset audit passed/);
  assert.equal(guestPresetCatalog.presets.length, 12);
});

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

test("frame rule failures reject small centered sprites in high-density guest frames", async () => {
  const pixels = Buffer.alloc(96 * 144 * 4);
  const colors = [
    [37, 24, 18, 255],
    [255, 0, 0, 255],
    [204, 0, 0, 255],
    [153, 0, 0, 255],
    [102, 0, 0, 255],
    [255, 244, 220, 255],
    [183, 93, 101, 255],
    [212, 119, 119, 255]
  ];

  for (let y = 60; y <= 126; y += 1) {
    for (let x = 35; x <= 60; x += 1) {
      const offset = (y * 96 + x) * 4;
      pixels.set(colors[(x + y) % colors.length], offset);
    }
  }

  await withTemporaryPng(96, 144, pixels, async (file) => {
    const inspection = await inspectSheet(file, { frameWidth: 96, frameHeight: 144 });
    const failures = collectFrameRuleFailures(inspection, {
      minimumBoundsHeight: 120,
      minimumBoundsWidth: 40,
      maximumBoundsTop: 22,
      maximumBoundsBottom: 140
    });

    assert.deepEqual(
      failures.map((failure) => failure.message),
      [
        "frame 1 bounds height 67 is below 120",
        "frame 1 bounds width 26 is below 40",
        "frame 1 bounds top 60 exceeds 22"
      ]
    );
  });
});

test("frame rule failures accept full high-density guest frame occupancy", async () => {
  const pixels = Buffer.alloc(96 * 144 * 4);

  for (let y = 10; y <= 139; y += 1) {
    const inset = y < 30 ? Math.floor((30 - y) / 3) : y > 120 ? Math.floor((y - 120) / 4) : 0;
    for (let x = 24 + inset; x <= 72 - inset; x += 1) {
      const offset = (y * 96 + x) * 4;
      pixels.set([255, 0, 0, 255], offset);
    }
  }

  await withTemporaryPng(96, 144, pixels, async (file) => {
    const inspection = await inspectSheet(file, { frameWidth: 96, frameHeight: 144 });
    const failures = collectFrameRuleFailures(inspection, {
      minimumBoundsHeight: 120,
      minimumBoundsWidth: 40,
      maximumBoundsTop: 22,
      maximumBoundsBottom: 140
    });

    assert.deepEqual(failures, []);
  });
});

test("region rule failures reject front hair covering the face guard", async () => {
  const pixels = Buffer.alloc(96 * 144 * 4);
  for (let y = 31; y <= 45; y += 1) {
    for (let x = 37; x <= 58; x += 1) {
      pixels.set([37, 24, 18, 255], (y * 96 + x) * 4);
    }
  }

  await withTemporaryPng(96, 144, pixels, async (file) => {
    const inspection = await inspectSheet(file, { frameWidth: 96, frameHeight: 144 });
    const failures = collectRegionRuleFailures(inspection, [{
      name: "front-face-guard",
      x: 37,
      y: 31,
      width: 22,
      height: 15,
      maximumOpaquePixels: 16
    }]);

    assert.deepEqual(failures.map((failure) => failure.message), [
      "front-face-guard frame 1 has 330 opaque pixels; maximum is 16"
    ]);
  });
});

test("region rule failures accept forehead hair above the face guard", async () => {
  const pixels = Buffer.alloc(96 * 144 * 4);
  for (let y = 24; y <= 30; y += 1) {
    for (let x = 34; x <= 62; x += 1) {
      pixels.set([37, 24, 18, 255], (y * 96 + x) * 4);
    }
  }

  await withTemporaryPng(96, 144, pixels, async (file) => {
    const inspection = await inspectSheet(file, { frameWidth: 96, frameHeight: 144 });
    const failures = collectRegionRuleFailures(inspection, [{
      name: "front-face-guard",
      x: 37,
      y: 31,
      width: 22,
      height: 15,
      maximumOpaquePixels: 16
    }]);

    assert.deepEqual(failures, []);
  });
});

test("front hair quality rule protects eyes and mouth while allowing the forehead band", async () => {
  const rules = JSON.parse(
    await readFile(join(root, "character-assets/quality-rules.json"), "utf8")
  );

  assert.deepEqual(rules.frontHair.regionRules, [{
    name: "front-face-guard",
    x: 37,
    y: 31,
    width: 22,
    height: 15,
    maximumOpaquePixels: 16
  }]);
});

test("base quality rules require a rounded lower front face", async () => {
  const rules = JSON.parse(
    await readFile(join(root, "character-assets/quality-rules.json"), "utf8")
  );

  assert.ok(rules.base.regionColorRules.some((rule) =>
    rule.name === "base-front-lower-face-skin" &&
    rule.x === 39 &&
    rule.y === 39 &&
    rule.width === 19 &&
    rule.height === 10 &&
    rule.minimumPixels === 165
  ));
});

test("region color rule failures reject a face region without enough skin pixels", async () => {
  const pixels = Buffer.alloc(96 * 144 * 4);
  for (let y = 28; y < 50; y += 1) {
    for (let x = 35; x < 62; x += 1) {
      pixels.set([37, 24, 18, 255], (y * 96 + x) * 4);
    }
  }

  await withTemporaryPng(96, 144, pixels, async (file) => {
    const inspection = await inspectSheet(file, { frameWidth: 96, frameHeight: 144 });
    const failures = collectRegionColorRuleFailures(inspection, [{
      name: "base-front-face-skin",
      frames: [0],
      x: 35,
      y: 28,
      width: 27,
      height: 22,
      colors: ["#ff0000", "#cc0000", "#990000", "#660000"],
      minimumPixels: 250
    }]);

    assert.deepEqual(failures.map((failure) => failure.message), [
      "base-front-face-skin frame 1 has 0 matching pixels; minimum is 250"
    ]);
  });
});

test("region color rule failures accept a readable skin-heavy face region", async () => {
  const pixels = Buffer.alloc(96 * 144 * 4);
  for (let y = 28; y < 50; y += 1) {
    for (let x = 35; x < 62; x += 1) {
      pixels.set([255, 0, 0, 255], (y * 96 + x) * 4);
    }
  }
  for (const [x, y] of [[40, 34], [55, 34], [48, 39], [47, 44], [48, 44], [49, 44]]) {
    pixels.set([37, 24, 18, 255], (y * 96 + x) * 4);
  }

  await withTemporaryPng(96, 144, pixels, async (file) => {
    const inspection = await inspectSheet(file, { frameWidth: 96, frameHeight: 144 });
    const failures = collectRegionColorRuleFailures(inspection, [{
      name: "base-front-face-skin",
      frames: [0],
      x: 35,
      y: 28,
      width: 27,
      height: 22,
      colors: ["#ff0000", "#cc0000", "#990000", "#660000"],
      minimumPixels: 250
    }, {
      name: "base-front-face-dark-control",
      frames: [0],
      x: 35,
      y: 28,
      width: 27,
      height: 19,
      colors: ["#251812"],
      maximumPixels: 42
    }]);

    assert.deepEqual(failures, []);
  });
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

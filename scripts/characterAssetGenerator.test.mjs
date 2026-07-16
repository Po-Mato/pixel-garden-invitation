import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import { generateVariant, validateDimensions } from "./lib/characterAssetGenerator.mjs";

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const guestPresetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));
const guestDirections = ["down", "left", "right", "up"];

async function writeBlankPng(file, dimensions) {
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

async function writeSolidPng(file, color, dimensions = { width: 128, height: 220 }) {
  await mkdir(dirname(file), { recursive: true });
  await sharp({
    create: {
      width: dimensions.width,
      height: dimensions.height,
      channels: 4,
      background: { r: color[0], g: color[1], b: color[2], alpha: 1 }
    }
  }).png().toFile(file);
}

async function writeSkinOnWhitePng(file, dimensions = { width: 128, height: 220 }) {
  await mkdir(dirname(file), { recursive: true });
  await sharp({
    create: {
      width: dimensions.width,
      height: dimensions.height,
      channels: 4,
      background: "#ffffff"
    }
  })
    .composite([
      {
        input: {
          create: {
            width: 36,
            height: 64,
            channels: 4,
            background: { r: 246, g: 214, b: 190, alpha: 1 }
          }
        },
        left: 0,
        top: 28
      }
    ])
    .png()
    .toFile(file);
}

async function writeHairHoleOnWhitePng(file, dimensions = { width: 128, height: 220 }) {
  await mkdir(dirname(file), { recursive: true });
  const data = Buffer.alloc(dimensions.width * dimensions.height * 4, 255);
  const fill = (left, top, width, height, color) => {
    for (let y = top; y < top + height; y += 1) {
      for (let x = left; x < left + width; x += 1) {
        const offset = (y * dimensions.width + x) * 4;
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = 255;
      }
    }
  };

  fill(20, 10, 88, 82, [58, 38, 30]);
  fill(38, 28, 52, 48, [246, 214, 190]);
  fill(30, 80, 68, 110, [44, 51, 63]);
  fill(42, 100, 44, 50, [255, 255, 255]);
  fill(19, 30, 1, 1, [198, 196, 194]);
  fill(20, 20, 1, 1, [224, 224, 224]);
  fill(23, 45, 5, 8, [224, 224, 224]);
  fill(24, 46, 3, 6, [255, 255, 255]);
  fill(23, 44, 14, 16, [224, 224, 224]);
  fill(25, 46, 10, 12, [255, 255, 255]);

  await sharp(data, {
    raw: { width: dimensions.width, height: dimensions.height, channels: 4 }
  })
    .png()
    .toFile(file);
}

async function extractRawFrame(sheet, column, row, dimensions) {
  return sharp(sheet)
    .extract({
      left: column * dimensions.width,
      top: row * dimensions.height,
      width: dimensions.width,
      height: dimensions.height
    })
    .raw()
    .toBuffer();
}

function countOpaqueColor(raw, color) {
  let count = 0;
  for (let offset = 0; offset < raw.length; offset += 4) {
    if (
      raw[offset + 3] !== 0 &&
      raw[offset] === color[0] &&
      raw[offset + 1] === color[1] &&
      raw[offset + 2] === color[2]
    ) {
      count += 1;
    }
  }
  return count;
}

function alphaAt(raw, dimensions, x, y) {
  return raw[(y * dimensions.width + x) * 4 + 3];
}

test("guest direction source authoring emits four source images per preset", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guest-direction-sources-"));
  try {
    const { authorGuestDirectionSources } = await import("./author-guest-direction-sources.mjs");
    const count = await authorGuestDirectionSources({
      outputRoot: join(dir, "character-assets/reference/guest-directions")
    });

    assert.equal(count, guestPresetCatalog.presets.length * guestDirections.length);
    for (const preset of guestPresetCatalog.presets) {
      for (const direction of guestDirections) {
        await assert.doesNotReject(() =>
          validateDimensions(
            join(dir, `character-assets/reference/guest-directions/${preset.id}/${direction}.png`),
            { width: 192, height: 288 }
          )
        );
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("guest preset authoring emits finished walk and idle sources", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guest-preset-authoring-"));
  try {
    const { authorGuestPresetSources } = await import("./author-guest-preset-sources.mjs");
    const count = await authorGuestPresetSources({ sourceRoot: join(dir, "source") });

    assert.equal(count, guestPresetCatalog.presets.length * 2);
    for (const preset of guestPresetCatalog.presets) {
      const walk = join(dir, "source", preset.source.walk.replace(/^character-assets\/source\//, ""));
      const idle = join(dir, "source", preset.source.idle.replace(/^character-assets\/source\//, ""));
      await assert.doesNotReject(() => validateDimensions(walk, guestPresetCatalog.frame.walk.sheet));
      await assert.doesNotReject(() => validateDimensions(idle, guestPresetCatalog.frame.idle.sheet));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("guest preset authoring emits distinct directional walk frames", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guest-preset-directions-"));
  try {
    const { authorGuestPresetSources } = await import("./author-guest-preset-sources.mjs");
    await authorGuestPresetSources({ sourceRoot: join(dir, "source") });

    for (const preset of guestPresetCatalog.presets) {
      const walk = join(dir, "source", preset.source.walk.replace(/^character-assets\/source\//, ""));
      const down = await extractRawFrame(walk, 1, 0, guestPresetCatalog.frame.source);
      const left = await extractRawFrame(walk, 1, 1, guestPresetCatalog.frame.source);
      const right = await extractRawFrame(walk, 1, 2, guestPresetCatalog.frame.source);
      const up = await extractRawFrame(walk, 1, 3, guestPresetCatalog.frame.source);

      assert.notDeepEqual(left, down, `${preset.id} left frame must not reuse the front-facing down frame`);
      assert.notDeepEqual(right, down, `${preset.id} right frame must not reuse the front-facing down frame`);
      assert.notDeepEqual(up, down, `${preset.id} up frame must not reuse the front-facing down frame`);
      assert.notDeepEqual(right, left, `${preset.id} right frame must not reuse the left frame without mirroring`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("guest preset authoring builds walk rows from explicit directional source images", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guest-preset-explicit-directions-"));
  const colors = {
    down: [240, 48, 64],
    left: [48, 192, 88],
    right: [48, 104, 232],
    up: [224, 176, 48]
  };
  const directions = Object.fromEntries(
    Object.keys(colors).map((direction) => [
      direction,
      `character-assets/reference/guest-directions/test-preset/${direction}.png`
    ])
  );

  try {
    for (const [direction, color] of Object.entries(colors)) {
      await writeSolidPng(join(dir, directions[direction]), color);
    }

    const catalog = {
      ...guestPresetCatalog,
      presets: [
        {
          id: "test-preset",
          family: "feminine",
          label: "방향 테스트",
          description: "방향별 원본 PNG 테스트",
          reference: {
            image: "unused.png",
            crop: { left: 0, top: 0, width: 1, height: 1 },
            directions
          },
          source: {
            walk: "character-assets/source/guests/test-preset__walk.png",
            idle: "character-assets/source/guests/test-preset__idle.png"
          },
          generated: {
            walk: "guests/test-preset__walk.png",
            idle: "guests/test-preset__idle.png"
          }
        }
      ]
    };
    const sourceRoot = join(dir, "character-assets/source");
    const { authorGuestPresetSources } = await import("./author-guest-preset-sources.mjs");
    await authorGuestPresetSources({ catalog, projectRoot: dir, sourceRoot });

    const walk = join(sourceRoot, "guests/test-preset__walk.png");
    for (let row = 0; row < guestDirections.length; row += 1) {
      const raw = await extractRawFrame(walk, 1, row, guestPresetCatalog.frame.source);
      assert.ok(
        countOpaqueColor(raw, colors[guestDirections[row]]) > 1000,
        `${guestDirections[row]} row must be built from its explicit source image`
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("guest preset authoring preserves pale skin connected to a white background", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guest-preset-skin-background-"));
  const directions = Object.fromEntries(
    guestDirections.map((direction) => [
      direction,
      `character-assets/reference/guest-directions/test-preset/${direction}.png`
    ])
  );

  try {
    for (const file of Object.values(directions)) {
      await writeSkinOnWhitePng(join(dir, file));
    }

    const catalog = {
      ...guestPresetCatalog,
      presets: [
        {
          id: "test-preset",
          family: "masculine",
          label: "피부 배경 테스트",
          description: "밝은 피부색 보존 테스트",
          reference: {
            image: "unused.png",
            crop: { left: 0, top: 0, width: 1, height: 1 },
            directions
          },
          source: {
            walk: "character-assets/source/guests/test-preset__walk.png",
            idle: "character-assets/source/guests/test-preset__idle.png"
          },
          generated: {
            walk: "guests/test-preset__walk.png",
            idle: "guests/test-preset__idle.png"
          }
        }
      ]
    };
    const sourceRoot = join(dir, "character-assets/source");
    const { authorGuestPresetSources } = await import("./author-guest-preset-sources.mjs");
    await authorGuestPresetSources({ catalog, projectRoot: dir, sourceRoot });

    const walk = join(sourceRoot, "guests/test-preset__walk.png");
    const frame = await extractRawFrame(walk, 1, 1, guestPresetCatalog.frame.source);
    assert.ok(
      countOpaqueColor(frame, [246, 214, 190]) > 0,
      "pale skin pixels must survive white-background removal"
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("guest preset authoring clears enclosed white hair gaps without erasing white clothes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guest-preset-hair-gap-"));
  const directions = Object.fromEntries(
    guestDirections.map((direction) => [
      direction,
      `character-assets/reference/guest-directions/test-preset/${direction}.png`
    ])
  );

  try {
    for (const file of Object.values(directions)) {
      await writeHairHoleOnWhitePng(join(dir, file));
    }

    const catalog = {
      ...guestPresetCatalog,
      presets: [
        {
          id: "test-preset",
          family: "feminine",
          label: "머리 틈 배경 테스트",
          description: "폐쇄된 흰 배경 제거 테스트",
          reference: {
            image: "unused.png",
            crop: { left: 0, top: 0, width: 1, height: 1 },
            directions
          },
          source: {
            walk: "character-assets/source/guests/test-preset__walk.png",
            idle: "character-assets/source/guests/test-preset__idle.png"
          },
          generated: {
            walk: "guests/test-preset__walk.png",
            idle: "guests/test-preset__idle.png"
          }
        }
      ]
    };
    const sourceRoot = join(dir, "character-assets/source");
    const { authorGuestPresetSources } = await import("./author-guest-preset-sources.mjs");
    await authorGuestPresetSources({ catalog, projectRoot: dir, sourceRoot });

    const walk = join(sourceRoot, "guests/test-preset__walk.png");
    const authoredFrame = await extractRawFrame(walk, 1, 0, guestPresetCatalog.frame.source);
    assert.equal(alphaAt(authoredFrame, guestPresetCatalog.frame.source, 17, 12), 0);
    assert.equal(countOpaqueColor(authoredFrame, [198, 196, 194]), 0);
    assert.equal(alphaAt(authoredFrame, guestPresetCatalog.frame.source, 21, 33), 0);
    assert.equal(alphaAt(authoredFrame, guestPresetCatalog.frame.source, 25, 35), 0);
    assert.equal(alphaAt(authoredFrame, guestPresetCatalog.frame.source, 48, 86), 255);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("guest preset authoring uses explicit walk step source images when present", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guest-preset-explicit-walk-steps-"));
  const directions = Object.fromEntries(
    guestDirections.map((direction) => [
      direction,
      `character-assets/reference/guest-directions/test-preset/${direction}.png`
    ])
  );
  const fallbackColors = {
    down: [240, 48, 64],
    left: [48, 192, 88],
    right: [48, 104, 232],
    up: [224, 176, 48]
  };
  const stepColors = {
    down: [
      [240, 30, 30],
      [200, 40, 40],
      [160, 50, 50]
    ],
    left: [
      [30, 180, 50],
      [40, 160, 70],
      [50, 140, 90]
    ],
    right: [
      [30, 80, 230],
      [40, 100, 210],
      [50, 120, 190]
    ],
    up: [
      [120, 40, 210],
      [140, 50, 190],
      [160, 60, 170]
    ]
  };

  try {
    for (const [direction, color] of Object.entries(fallbackColors)) {
      await writeSolidPng(join(dir, directions[direction]), color);
    }

    const walkSourceRoot = join(dir, "character-assets/reference/guest-walk-direction-sources/v1");
    for (const direction of guestDirections) {
      for (let step = 0; step < 3; step += 1) {
        await writeSolidPng(
          join(
            walkSourceRoot,
            "guest-custom",
            direction,
            `step-${String(step + 1).padStart(2, "0")}-source.png`
          ),
          stepColors[direction][step],
          { width: 640, height: 1024 }
        );
      }
    }

    const catalog = {
      ...guestPresetCatalog,
      presets: [
        {
          id: "test-preset",
          family: "feminine",
          label: "보행 테스트",
          description: "방향별 보행 원본 PNG 테스트",
          reference: {
            image: "unused.png",
            crop: { left: 0, top: 0, width: 1, height: 1 },
            walkSourceGuest: "guest-custom",
            directions
          },
          source: {
            walk: "character-assets/source/guests/test-preset__walk.png",
            idle: "character-assets/source/guests/test-preset__idle.png"
          },
          generated: {
            walk: "guests/test-preset__walk.png",
            idle: "guests/test-preset__idle.png"
          }
        }
      ]
    };
    const sourceRoot = join(dir, "character-assets/source");
    const { authorGuestPresetSources } = await import("./author-guest-preset-sources.mjs");
    await authorGuestPresetSources({ catalog, projectRoot: dir, sourceRoot, walkSourceRoot });

    const walk = join(sourceRoot, "guests/test-preset__walk.png");
    for (let row = 0; row < guestDirections.length; row += 1) {
      const direction = guestDirections[row];
      for (let column = 0; column < 3; column += 1) {
        const raw = await extractRawFrame(walk, column, row, guestPresetCatalog.frame.source);
        assert.ok(
          countOpaqueColor(raw, stepColors[direction][column]) > 1000,
          `${direction} column ${column + 1} must be built from its explicit walk step source`
        );
      }
    }

    const idle = join(sourceRoot, "guests/test-preset__idle.png");
    const idleRaw = await extractRawFrame(idle, 0, 0, guestPresetCatalog.frame.source);
    assert.ok(
      countOpaqueColor(idleRaw, stepColors.down[1]) > 1000,
      "idle frame must use the neutral down walk step when present"
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("npc source contract includes idle and four-direction walk sheets", async () => {
  await assert.doesNotReject(() =>
    validateDimensions("character-assets/source/npc/groom-idle.png", { width: 192, height: 144 })
  );
  await assert.doesNotReject(() =>
    validateDimensions("character-assets/source/npc/groom-walk.png", { width: 288, height: 576 })
  );
  await assert.doesNotReject(() =>
    validateDimensions("character-assets/source/npc/bride-idle.png", { width: 192, height: 144 })
  );
  await assert.doesNotReject(() =>
    validateDimensions("character-assets/source/npc/bride-walk.png", { width: 288, height: 576 })
  );
});

test("generator emits idle and four-direction walk sheets for every npc", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [join(root, "scripts/generate-character-assets.mjs")],
    { cwd: root }
  );

  for (const id of ["groom", "bride"]) {
    await assert.doesNotReject(() =>
      validateDimensions(
        join(root, `client/public/characters/generated/npc/${id}__idle.png`),
        { width: 192, height: 144 }
      )
    );
    await assert.doesNotReject(() =>
      validateDimensions(
        join(root, `client/public/characters/generated/npc/${id}__walk.png`),
        { width: 288, height: 576 }
      )
    );
  }
  assert.match(stdout, /Generated 52 character assets/);
});

test("generator emits 48x72 high-density world sheets for every guest preset", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-world-assets-"));
  try {
    const { generateCharacterAssets } = await import("./generate-character-assets.mjs");
    const outputRoot = join(dir, "generated");
    const count = await generateCharacterAssets({ outputRoot });

    assert.equal(count, 52);
    for (const preset of guestPresetCatalog.presets) {
      await assert.doesNotReject(() =>
        validateDimensions(
          join(outputRoot, `guests/world/${preset.id}__walk.png`),
          { width: 144, height: 288 }
        )
      );
      await assert.doesNotReject(() =>
        validateDimensions(
          join(outputRoot, `guests/world/${preset.id}__idle.png`),
          { width: 96, height: 72 }
        )
      );
    }

    const preset = guestPresetCatalog.presets[0];
    const expectedFrame = await sharp(join(outputRoot, preset.generated.walk))
      .extract({ left: 96, top: 288, width: 96, height: 144 })
      .resize(48, 72, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const actualFrame = await sharp(
      join(outputRoot, `guests/world/${preset.id}__walk.png`)
    )
      .extract({ left: 48, top: 144, width: 48, height: 72 })
      .ensureAlpha()
      .raw()
      .toBuffer();

    assert.deepEqual(actualFrame, expectedFrame);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generator clears neutral wave-hair edge matte without mutating source sheets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-wave-hair-cleanup-"));
  const sourceRoot = join(dir, "source");
  const source = join(
    sourceRoot,
    "guests/feminine-lavender-jacket-dress__walk.png"
  );

  try {
    await cp(join(root, "character-assets/source"), sourceRoot, { recursive: true });
    const { data, info } = await sharp(source)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data.set([198, 196, 194, 255], (41 * info.width + 73) * 4);
    await sharp(data, { raw: info }).png().toFile(source);

    const sourceBefore = await extractRawFrame(source, 0, 0, guestPresetCatalog.frame.source);
    assert.equal(alphaAt(sourceBefore, guestPresetCatalog.frame.source, 73, 41), 255);

    const { generateCharacterAssets } = await import("./generate-character-assets.mjs");
    const outputRoot = join(dir, "generated");
    await generateCharacterAssets({ sourceRoot, outputRoot });

    const generated = await extractRawFrame(
      join(outputRoot, "guests/feminine-lavender-jacket-dress__walk.png"),
      0,
      0,
      guestPresetCatalog.frame.source
    );
    assert.equal(alphaAt(generated, guestPresetCatalog.frame.source, 73, 41), 0);
    assert.equal(alphaAt(generated, guestPresetCatalog.frame.source, 50, 30), 255);

    const sourceAfter = await extractRawFrame(source, 0, 0, guestPresetCatalog.frame.source);
    assert.deepEqual(sourceAfter, sourceBefore);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generator validates a late npc walk source before replacing existing output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-preflight-"));
  const sourceRoot = join(dir, "source");
  const outputRoot = join(dir, "generated");
  const marker = join(outputRoot, "existing.txt");
  try {
    await cp(join(root, "character-assets/source"), sourceRoot, { recursive: true });
    await sharp({
      create: { width: 1, height: 1, channels: 4, background: "#00000000" }
    }).png().toFile(join(sourceRoot, "npc/bride-walk.png"));
    await mkdir(outputRoot, { recursive: true });
    await writeFile(marker, "keep existing output");

    const { generateCharacterAssets } = await import("./generate-character-assets.mjs");
    await assert.rejects(
      () => generateCharacterAssets({ sourceRoot, outputRoot }),
      /bride-walk\.png must be 288x576; received 1x1/
    );
    assert.equal(await readFile(marker, "utf8"), "keep existing output");
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("generator rejects invalid guest preset sources before replacing existing output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-preflight-"));
  const sourceRoot = join(dir, "source");
  const outputRoot = join(dir, "generated");
  const marker = join(outputRoot, "existing.txt");
  try {
    await cp(join(root, "character-assets/source"), sourceRoot, { recursive: true });
    await writeBlankPng(join(sourceRoot, "guests/feminine-long-wave-dress__walk.png"), { width: 144, height: 288 });
    await mkdir(outputRoot, { recursive: true });
    await writeFile(marker, "keep existing output");

    const { generateCharacterAssets } = await import("./generate-character-assets.mjs");
    await assert.rejects(
      () => generateCharacterAssets({ sourceRoot, outputRoot }),
      /feminine-long-wave-dress__walk\.png must be 288x576; received 144x288/
    );
    assert.equal(await readFile(marker, "utf8"), "keep existing output");
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("generator accepts finished guest preset sources and emits generated preset sheets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-guest-presets-"));
  const sourceRoot = join(dir, "source");
  const outputRoot = join(dir, "generated");
  try {
    await cp(join(root, "character-assets/source"), sourceRoot, { recursive: true });
    const { authorGuestPresetSources } = await import("./author-guest-preset-sources.mjs");
    await authorGuestPresetSources({ sourceRoot });

    const { generateCharacterAssets } = await import("./generate-character-assets.mjs");
    const outputCount = await generateCharacterAssets({ sourceRoot, outputRoot });

    assert.equal(outputCount, 52);
    for (const preset of guestPresetCatalog.presets) {
      await assert.doesNotReject(() =>
        validateDimensions(join(outputRoot, preset.generated.walk), guestPresetCatalog.frame.walk.sheet)
      );
      await assert.doesNotReject(() =>
        validateDimensions(join(outputRoot, preset.generated.idle), guestPresetCatalog.frame.idle.sheet)
      );
    }
    await assert.doesNotReject(() =>
      validateDimensions(join(outputRoot, "npc/groom__walk.png"), { width: 288, height: 576 })
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("contact-sheet frame extracts a 96x144 npc cell at the requested column and row", async () => {
  const { frame } = await import("./render-character-contact-sheet.mjs");
  const relative = "npc/groom__walk.png";
  const actual = await sharp(await frame(relative, 2, 3, { width: 96, height: 144 })).raw().toBuffer();
  const expected = await sharp(join(root, "client/public/characters/generated", relative))
    .extract({ left: 192, top: 432, width: 96, height: 144 })
    .raw()
    .toBuffer();

  assert.deepEqual(actual, expected);
});

test("contact-sheet frame extracts a 96x144 guest cell by default", async () => {
  const { frame } = await import("./render-character-contact-sheet.mjs");
  const relative = "guests/feminine-long-wave-dress__walk.png";
  const actual = await sharp(await frame(relative, 1, 0)).raw().toBuffer();
  const expected = await sharp(join(root, "client/public/characters/generated", relative))
    .extract({ left: 96, top: 0, width: 96, height: 144 })
    .raw()
    .toBuffer();

  assert.deepEqual(actual, expected);
});

test("contact-sheet labels escape XML-sensitive characters", async () => {
  const { label } = await import("./render-character-contact-sheet.mjs");
  const svg = (await label("groom & bride <forever>", 320)).toString();

  assert.match(svg, /groom &amp; bride &lt;forever&gt;/);
  assert.doesNotMatch(svg, /groom & bride <forever>/);
});

test("contact-sheet parser accepts equals, spaced, and legacy positional forms", async () => {
  const { parseArguments } = await import("./render-character-contact-sheet.mjs");

  assert.deepEqual(
    parseArguments(["--mode=couple", "--output=review=one.png"]),
    { mode: "couple", output: "review=one.png" }
  );
  assert.deepEqual(
    parseArguments(["--mode", "couple", "--output", "review two.png"]),
    { mode: "couple", output: "review two.png" }
  );
  assert.deepEqual(
    parseArguments(["legacy=review.png"]),
    { mode: "guest-presets", output: "legacy=review.png" }
  );
  assert.deepEqual(
    parseArguments(["--mode=guest-presets", "--output=presets.png"]),
    { mode: "guest-presets", output: "presets.png" }
  );
  assert.deepEqual(
    parseArguments(["--", "--mode", "couple", "--output", "pnpm-review.png"]),
    { mode: "couple", output: "pnpm-review.png" }
  );
});

test("contact-sheet parser rejects unknown arguments", async () => {
  const { parseArguments } = await import("./render-character-contact-sheet.mjs");

  assert.throws(
    () => parseArguments(["--format=webp"]),
    /Unknown argument: --format=webp/
  );
  assert.throws(
    () => parseArguments(["one.png", "two.png"]),
    /Unexpected positional argument: two.png/
  );
});

test("contact-sheet parser rejects removed catalog mode", async () => {
  const { parseArguments } = await import("./render-character-contact-sheet.mjs");

  assert.throws(
    () => parseArguments(["--mode=catalog"]),
    /Unknown contact-sheet mode: catalog/
  );
});

test("contact-sheet parser rejects duplicate arguments", async () => {
  const { parseArguments } = await import("./render-character-contact-sheet.mjs");

  assert.throws(
    () => parseArguments(["--mode=couple", "--mode", "catalog"]),
    /Duplicate argument: --mode/
  );
  assert.throws(
    () => parseArguments(["--output=one.png", "two.png"]),
    /Duplicate output argument/
  );
});

test("contact-sheet parser rejects missing values", async () => {
  const { parseArguments } = await import("./render-character-contact-sheet.mjs");

  assert.throws(() => parseArguments(["--mode"]), /Missing value for --mode/);
  assert.throws(() => parseArguments(["--output="]), /Missing value for --output/);
  assert.throws(
    () => parseArguments(["--mode", "--output=review.png"]),
    /Missing value for --mode/
  );
});

test("couple samples include idle and every walk frame in all four directions", async () => {
  const { coupleSamples } = await import("./render-character-contact-sheet.mjs");
  const samples = await coupleSamples();

  assert.deepEqual(
    samples.map((sample) => [sample.label, sample.frames.length]),
    [
      ["groom / idle", 2],
      ["groom / down", 3],
      ["groom / left", 3],
      ["groom / right", 3],
      ["groom / up", 3],
      ["bride / idle", 2],
      ["bride / down", 3],
      ["bride / left", 3],
      ["bride / right", 3],
      ["bride / up", 3]
    ]
  );
  for (const sample of samples) {
    for (const image of sample.frames) {
      const metadata = await sharp(image).metadata();
      assert.deepEqual(
        { width: metadata.width, height: metadata.height },
        { width: 96, height: 144 }
      );
    }
  }
});

test("guest preset samples include every preset in four directions", async () => {
  const { guestPresetSamples } = await import("./render-character-contact-sheet.mjs");
  const samples = await guestPresetSamples();

  assert.equal(samples.length, 12);
  for (const sample of samples) {
    assert.deepEqual(
      sample.frames.map((entry) => entry.direction),
      ["down", "left", "right", "up"]
    );
  }
});

test("guest preset samples defer frame decoding instead of retaining image buffers", async () => {
  const { guestPresetSamples } = await import("./render-character-contact-sheet.mjs");
  const samples = await guestPresetSamples();

  for (const sample of samples) {
    for (const sampleFrame of sample.frames) {
      assert.equal(Buffer.isBuffer(sampleFrame.image), false);
      assert.ok(sampleFrame.relative);
    }
  }
});

test("high-density guest review includes all 144 walk frames", async () => {
  const { guestPresetWalkSamples } = await import("./render-character-contact-sheet.mjs");
  const samples = await guestPresetWalkSamples();

  assert.equal(samples.length, 48);
  assert.equal(samples.reduce((total, sample) => total + sample.frames.length, 0), 144);
  assert.deepEqual(
    samples.flatMap((sample) => sample.frames.map((frame) => ({
      presetId: sample.presetId,
      direction: sample.direction,
      relative: frame.relative,
      column: frame.column,
      row: frame.row,
      step: frame.step
    }))),
    guestPresetCatalog.presets.flatMap((preset) =>
      guestDirections.flatMap((direction, row) =>
        [0, 1, 2].map((column) => ({
          presetId: preset.id,
          direction,
          relative: preset.generated.walk,
          column,
          row,
          step: `step-${String(column + 1).padStart(2, "0")}`
        }))
      )
    )
  );
});

test("contact-sheet parser accepts high-density guest review mode", async () => {
  const { parseArguments } = await import("./render-character-contact-sheet.mjs");
  assert.deepEqual(parseArguments(["--mode=guest-walk-review", "--output=review.png"]), {
    mode: "guest-walk-review",
    output: "review.png"
  });
});

test("contact-sheet CLI rejects an unknown mode", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-contact-sheet-"));
  try {
    await assert.rejects(
      () =>
        execFileAsync(
          process.execPath,
          [join(root, "scripts/render-character-contact-sheet.mjs"), "--mode=portraits"],
          { cwd: dir }
        ),
      (error) => {
        assert.match(error.stderr, /Unknown contact-sheet mode: portraits/);
        return true;
      }
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("couple mode renders every labeled row with enlarged and actual-size room", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-contact-sheet-"));
  const output = join(dir, "couple.png");
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        join(root, "scripts/render-character-contact-sheet.mjs"),
        "--mode=couple",
        `--output=${output}`
      ],
      { cwd: dir }
    );
    const metadata = await sharp(output).metadata();

    assert.match(stdout, /Rendered 10 couple samples/);
    assert.deepEqual(
      { width: metadata.width, height: metadata.height },
      { width: 832, height: 3444 }
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("couple actual-size crop preserves rendered source pixels, checker transparency, and edge padding", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-contact-sheet-"));
  const output = join(dir, "couple.png");
  try {
    await execFileAsync(
      process.execPath,
      [
        join(root, "scripts/render-character-contact-sheet.mjs"),
        "--mode",
        "couple",
        "--output",
        output
      ],
      { cwd: dir }
    );

    const source = await sharp(
      join(root, "client/public/characters/generated/npc/groom__idle.png")
    )
      .extract({ left: 0, top: 0, width: 96, height: 144 })
      .resize(48, 72, { kernel: "nearest" })
      .ensureAlpha()
      .toBuffer();
    const actual = await sharp(output)
      .extract({ left: 648, top: 162, width: 48, height: 72 })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const checkerColors = [
      [0xff, 0xfa, 0xf2, 0xff],
      [0xde, 0xd5, 0xc9, 0xff]
    ];
    const checker = Buffer.alloc(48 * 72 * 4);

    for (let y = 0; y < 72; y += 1) {
      for (let x = 0; x < 48; x += 1) {
        const offset = (y * 48 + x) * 4;
        const color = checkerColors[(Math.floor(x / 4) + Math.floor(y / 4)) % 2];
        checker.set(color, offset);
      }
    }

    const expected = await sharp(checker, {
      raw: { width: 48, height: 72, channels: 4 }
    })
      .composite([{ input: source }])
      .ensureAlpha()
      .raw()
      .toBuffer();

    for (let y = 0; y < 72; y += 1) {
      for (let x = 0; x < 48; x += 1) {
        const offset = (y * 48 + x) * 4;
        assert.deepEqual(
          [...actual.subarray(offset, offset + 4)],
          [...expected.subarray(offset, offset + 4)],
          `unexpected actual-size pixel at ${x},${y}`
        );
      }
    }

    const padded = await sharp(output)
      .extract({ left: 647, top: 161, width: 50, height: 74 })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const sheetPixel = [0xf4, 0xef, 0xe7, 0xff];
    for (let x = 0; x < 50; x += 1) {
      assert.deepEqual([...padded.subarray(x * 4, x * 4 + 4)], sheetPixel);
      const bottom = ((73 * 50) + x) * 4;
      assert.deepEqual([...padded.subarray(bottom, bottom + 4)], sheetPixel);
    }
    for (let y = 0; y < 74; y += 1) {
      const left = y * 50 * 4;
      const right = (y * 50 + 49) * 4;
      assert.deepEqual([...padded.subarray(left, left + 4)], sheetPixel);
      assert.deepEqual([...padded.subarray(right, right + 4)], sheetPixel);
    }
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("guest presets are the default mode and render every finished preset card", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-contact-sheet-"));
  const output = join(dir, "guest-presets.png");
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [join(root, "scripts/render-character-contact-sheet.mjs"), `--output=${output}`],
      { cwd: dir }
    );
    const metadata = await sharp(output).metadata();

    assert.match(stdout, /Rendered 12 guest-presets samples/);
    assert.deepEqual(
      { width: metadata.width, height: metadata.height },
      { width: 1212, height: 792 }
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("guest walk review renders 48 direction rows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guest-walk-review-"));
  const output = join(dir, "review.png");
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        join(root, "scripts/render-character-contact-sheet.mjs"),
        "--mode=guest-walk-review",
        `--output=${output}`
      ],
      { cwd: root }
    );
    const metadata = await sharp(output).metadata();
    assert.match(stdout, /Rendered 48 guest-walk-review samples/);
    assert.deepEqual(
      { width: metadata.width, height: metadata.height },
      { width: 1356, height: 3168 }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("guest walk review first tile preserves source and Lanczos3 display pixels", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guest-walk-review-pixels-"));
  const output = join(dir, "review.png");
  try {
    await execFileAsync(
      process.execPath,
      [
        join(root, "scripts/render-character-contact-sheet.mjs"),
        "--mode=guest-walk-review",
        `--output=${output}`
      ],
      { cwd: root }
    );

    const sourcePath = join(
      root,
      "client/public/characters/generated",
      guestPresetCatalog.presets[0].generated.walk
    );
    const sourceImage = sharp(sourcePath)
      .extract({ left: 0, top: 0, width: 96, height: 144 })
      .ensureAlpha();
    const sourcePng = await sourceImage.clone().png().toBuffer();
    const displayPng = await sourceImage.clone()
      .resize(48, 72, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    const checkerColors = [
      [0xff, 0xfa, 0xf2, 0xff],
      [0xde, 0xd5, 0xc9, 0xff]
    ];
    const actualSource = await sharp(output)
      .extract({ left: 4, top: 50, width: 96, height: 144 })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const actualDisplay = await sharp(output)
      .extract({ left: 100, top: 86, width: 48, height: 72 })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const checker = Buffer.alloc(96 * 144 * 4);
    for (let y = 0; y < 144; y += 1) {
      for (let x = 0; x < 96; x += 1) {
        checker.set(
          checkerColors[(Math.floor(x / 8) + Math.floor(y / 8)) % 2],
          (y * 96 + x) * 4
        );
      }
    }
    const ratioGuide = Buffer.from(
      `<svg width="96" height="144" xmlns="http://www.w3.org/2000/svg">` +
        `<line x1="0" y1="48" x2="96" y2="48" stroke="#d1495b" stroke-opacity="0.72"/>` +
        `<line x1="0" y1="90" x2="96" y2="90" stroke="#2a9d8f" stroke-opacity="0.72"/>` +
      `</svg>`
    );
    const expectedSource = await sharp(checker, {
      raw: { width: 96, height: 144, channels: 4 }
    })
      .composite([{ input: sourcePng }, { input: ratioGuide }])
      .ensureAlpha()
      .raw()
      .toBuffer();
    const displayChecker = Buffer.alloc(48 * 72 * 4);
    for (let y = 0; y < 72; y += 1) {
      for (let x = 0; x < 48; x += 1) {
        displayChecker.set(
          checkerColors[(Math.floor(x / 4) + Math.floor(y / 4)) % 2],
          (y * 48 + x) * 4
        );
      }
    }
    const expectedDisplay = await sharp(displayChecker, {
      raw: { width: 48, height: 72, channels: 4 }
    })
      .composite([{ input: displayPng }])
      .ensureAlpha()
      .raw()
      .toBuffer();

    for (let y = 0; y < 144; y += 1) {
      for (let x = 0; x < 96; x += 1) {
        const offset = (y * 96 + x) * 4;
        assert.deepEqual(
          [...actualSource.subarray(offset, offset + 4)],
          [...expectedSource.subarray(offset, offset + 4)],
          `unexpected first-tile source pixel at ${x},${y}`
        );
      }
    }
    for (let y = 0; y < 72; y += 1) {
      for (let x = 0; x < 48; x += 1) {
        const offset = (y * 48 + x) * 4;
        assert.deepEqual(
          [...actualDisplay.subarray(offset, offset + 4)],
          [...expectedDisplay.subarray(offset, offset + 4)],
          `unexpected first-tile display pixel at ${x},${y}`
        );
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("guest walk review cleans temporary tiles after output failure", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "guest-walk-review-cleanup-"));
  const output = join(tempRoot, "output-directory");
  try {
    await mkdir(output);
    await assert.rejects(
      () => execFileAsync(
        process.execPath,
        [
          join(root, "scripts/render-character-contact-sheet.mjs"),
          "--mode=guest-walk-review",
          `--output=${output}`
        ],
        { cwd: root, env: { ...process.env, TMPDIR: tempRoot } }
      )
    );
    assert.deepEqual(
      (await readdir(tempRoot)).filter((entry) => entry.startsWith("guest-walk-review-")),
      []
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("validateDimensions accepts 288x576 walk sheets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-"));
  const file = join(dir, "walk.png");
  await sharp({ create: { width: 288, height: 576, channels: 4, background: "#ff00ffff" } }).png().toFile(file);
  await assert.doesNotReject(() => validateDimensions(file, { width: 288, height: 576 }));
  await rm(dir, { recursive: true });
});

test("generateVariant replaces exact marker colors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-"));
  const source = join(dir, "source.png");
  const output = join(dir, "output.png");
  await sharp({
    create: { width: 1, height: 1, channels: 4, background: "#ff0000ff" }
  }).png().toFile(source);

  await generateVariant(source, output, { "#ff0000": "#123456" });
  const { data } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data], [0x12, 0x34, 0x56, 0xff]);
  await rm(dir, { recursive: true });
});

test("generateVariant rejects unknown opaque marker colors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-"));
  const source = join(dir, "source.png");
  await sharp({
    create: { width: 1, height: 1, channels: 4, background: "#00ff00ff" }
  }).png().toFile(source);

  await assert.rejects(
    () => generateVariant(source, join(dir, "output.png"), { "#ff0000": "#123456" }),
    /Unknown marker color/
  );
  await rm(dir, { recursive: true });
});

test("generateVariant preserves explicitly allowed fixed colors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-"));
  const source = join(dir, "source.png");
  const output = join(dir, "output.png");
  await sharp({
    create: { width: 1, height: 1, channels: 4, background: "#251812ff" }
  }).png().toFile(source);

  await generateVariant(source, output, {}, { allowedFixedColors: ["#251812"] });
  const { data } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data], [0x25, 0x18, 0x12, 0xff]);
  await rm(dir, { recursive: true });
});

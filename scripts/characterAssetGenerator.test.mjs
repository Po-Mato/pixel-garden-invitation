import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  assert.match(stdout, /Generated 28 character assets/);
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

    assert.equal(outputCount, 28);
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

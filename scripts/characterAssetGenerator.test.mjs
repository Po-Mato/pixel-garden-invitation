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
  assert.match(stdout, /Generated 266 character assets/);
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
    { mode: "catalog", output: "legacy=review.png" }
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

test("catalog samples preserve every variant and add four directions to hair and outfits", async () => {
  const { catalogSamples } = await import("./render-character-contact-sheet.mjs");
  const samples = await catalogSamples();

  assert.equal(samples.length, 153);
  for (const sample of samples.slice(0, 136)) {
    assert.deepEqual(
      sample.frames.map((entry) => entry.direction),
      ["down", "left", "right", "up"]
    );
  }
  for (const sample of samples.slice(136)) {
    assert.equal(sample.frames.length, 1);
  }
});

test("catalog samples defer frame decoding instead of retaining image buffers", async () => {
  const { catalogSamples } = await import("./render-character-contact-sheet.mjs");
  const samples = await catalogSamples();

  for (const sample of samples) {
    for (const sampleFrame of sample.frames) {
      assert.equal(Buffer.isBuffer(sampleFrame.image), false);
      assert.ok(sampleFrame.relative || sampleFrame.layers);
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

test("couple actual-size crop preserves source pixels, checker transparency, and edge padding", async () => {
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
      .raw()
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

    for (let y = 0; y < 72; y += 1) {
      for (let x = 0; x < 48; x += 1) {
        const offset = (y * 48 + x) * 4;
        const expected = source[offset + 3] === 0
          ? checkerColors[(Math.floor(x / 4) + Math.floor(y / 4)) % 2]
          : [...source.subarray(offset, offset + 4)];
        assert.deepEqual(
          [...actual.subarray(offset, offset + 4)],
          expected,
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

test("catalog is the default mode and renders every existing variant card", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-contact-sheet-"));
  const output = join(dir, "catalog.png");
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [join(root, "scripts/render-character-contact-sheet.mjs"), `--output=${output}`],
      { cwd: dir }
    );
    const metadata = await sharp(output).metadata();

    assert.match(stdout, /Rendered 153 catalog samples/);
    assert.deepEqual(
      { width: metadata.width, height: metadata.height },
      { width: 1212, height: 10098 }
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("validateDimensions accepts 144x288 walk sheets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-"));
  const file = join(dir, "walk.png");
  await sharp({ create: { width: 144, height: 288, channels: 4, background: "#ff00ffff" } }).png().toFile(file);
  await assert.doesNotReject(() => validateDimensions(file, { width: 144, height: 288 }));
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

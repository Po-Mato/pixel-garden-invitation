import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
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
    validateDimensions("character-assets/source/npc/groom-idle.png", { width: 96, height: 72 })
  );
  await assert.doesNotReject(() =>
    validateDimensions("character-assets/source/npc/groom-walk.png", { width: 144, height: 288 })
  );
  await assert.doesNotReject(() =>
    validateDimensions("character-assets/source/npc/bride-idle.png", { width: 96, height: 72 })
  );
  await assert.doesNotReject(() =>
    validateDimensions("character-assets/source/npc/bride-walk.png", { width: 144, height: 288 })
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
        { width: 96, height: 72 }
      )
    );
    await assert.doesNotReject(() =>
      validateDimensions(
        join(root, `client/public/characters/generated/npc/${id}__walk.png`),
        { width: 144, height: 288 }
      )
    );
  }
  assert.match(stdout, /Generated 266 character assets/);
});

test("contact-sheet frame extracts a 48x72 cell at the requested column and row", async () => {
  const { frame } = await import("./render-character-contact-sheet.mjs");
  const relative = "npc/groom__walk.png";
  const actual = await sharp(await frame(relative, 2, 3)).raw().toBuffer();
  const expected = await sharp(join(root, "client/public/characters/generated", relative))
    .extract({ left: 96, top: 216, width: 48, height: 72 })
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
        { width: 48, height: 72 }
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

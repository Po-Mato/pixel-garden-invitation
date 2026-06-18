import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { generateVariant, validateDimensions } from "./lib/characterAssetGenerator.mjs";

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

import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPixel,
  clonePixels,
  frameOffset,
  mirrorFrameHorizontally
} from "./editor-core.mjs";

test("frameOffset maps three columns and four rows", () => {
  assert.deepEqual(frameOffset(2, 3, 48, 72), { x: 96, y: 216 });
});

test("applyPixel records the previous pixel for undo", () => {
  const pixels = new Uint8ClampedArray([0, 0, 0, 0]);
  const undo = applyPixel(pixels, 1, 0, 0, [37, 24, 18, 255]);
  assert.deepEqual([...pixels], [37, 24, 18, 255]);
  assert.deepEqual(undo, { offset: 0, previous: [0, 0, 0, 0] });
});

test("mirrorFrameHorizontally mirrors only the selected frame", () => {
  const pixels = new Uint8ClampedArray([
    1, 0, 0, 255, 2, 0, 0, 255,
    3, 0, 0, 255, 4, 0, 0, 255
  ]);
  mirrorFrameHorizontally(pixels, 4, 1, { x: 0, y: 0, width: 2, height: 1 });
  assert.deepEqual([...pixels.slice(0, 8)], [2, 0, 0, 255, 1, 0, 0, 255]);
  assert.deepEqual([...pixels.slice(8)], [3, 0, 0, 255, 4, 0, 0, 255]);
});

test("clonePixels creates an independent history snapshot", () => {
  const source = new Uint8ClampedArray([1, 2, 3, 4]);
  const copy = clonePixels(source);
  copy[0] = 9;
  assert.equal(source[0], 1);
});

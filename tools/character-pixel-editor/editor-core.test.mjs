import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPixel,
  clonePixels,
  frameAvailability,
  frameOffset,
  isFrameWithinImage,
  mirrorFrameHorizontally,
  recordHistoryMutation,
  selectPaletteColor,
  shouldUseDownloadFallback
} from "./editor-core.mjs";
import { resolveRequestPath } from "../../scripts/serve-character-editor.mjs";

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

test("idle sheets expose two columns and only the down row", () => {
  assert.deepEqual(frameAvailability(96, 72), {
    columns: [true, true, false],
    rows: [true, false, false, false]
  });
  assert.equal(
    isFrameWithinImage(96, 72, { x: 48, y: 0, width: 48, height: 72 }),
    true
  );
  assert.equal(
    isFrameWithinImage(96, 72, { x: 96, y: 0, width: 48, height: 72 }),
    false
  );
});

test("walk sheets expose all three columns and four rows", () => {
  assert.deepEqual(frameAvailability(144, 288), {
    columns: [true, true, true],
    rows: [true, true, true, true]
  });
  assert.equal(
    isFrameWithinImage(144, 288, { x: 96, y: 216, width: 48, height: 72 }),
    true
  );
});

test("recordHistoryMutation clears redo history when branching", () => {
  const pixels = new Uint8ClampedArray([1, 2, 3, 4]);
  const history = [];
  const future = [new Uint8ClampedArray([9, 9, 9, 9])];

  recordHistoryMutation(history, future, pixels);
  pixels[0] = 8;

  assert.equal(future.length, 0);
  assert.deepEqual([...history[0]], [1, 2, 3, 4]);
});

test("selectPaletteColor chooses the first color for a new class", () => {
  assert.equal(selectPaletteColor(["#251812", "#fff4dc"]), "#251812");
});

test("download fallback is skipped only for explicit picker cancellation", () => {
  assert.equal(shouldUseDownloadFallback({ name: "AbortError" }), false);
  assert.equal(shouldUseDownloadFallback({ name: "NotAllowedError" }), true);
});

test("resolveRequestPath maps root URLs with query strings to the editor", () => {
  assert.equal(
    resolveRequestPath("/project", "/?cache=1"),
    "/project/tools/character-pixel-editor/index.html"
  );
});

test("resolveRequestPath rejects traversal outside the project root", () => {
  assert.equal(resolveRequestPath("/project", "/../../etc/passwd"), null);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { measureAlphaVisualAnchor } from "./lib/characterVisualAnchor.mjs";
import { buildCharacterWorldAnchorManifest } from "./generate-character-world-anchors.mjs";

test("alpha visual anchor follows the visible bounds instead of the PNG canvas", () => {
  const pixels = Buffer.alloc(8 * 10 * 4);
  for (let y = 2; y <= 8; y += 1) {
    for (let x = 1; x <= 6; x += 1) pixels[(y * 8 + x) * 4 + 3] = 255;
  }
  assert.deepEqual(measureAlphaVisualAnchor(pixels, { width: 8, height: 10 }), {
    centerX: 4,
    centerY: 5.5,
    feetY: 9,
    bounds: { left: 1, top: 2, width: 6, height: 7 },
    opaquePixelCount: 42
  });
});

test("tracked world anchors match every generated guest PNG", async () => {
  const tracked = JSON.parse(await readFile("client/src/character/worldAnchors.generated.json", "utf8"));
  assert.deepEqual(tracked, await buildCharacterWorldAnchorManifest());
  assert.equal(Object.keys(tracked.presets).length, 12);
});

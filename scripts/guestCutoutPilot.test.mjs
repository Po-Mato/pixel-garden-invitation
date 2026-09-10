import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  auditGuestCutoutPilot,
  buildGuestCutoutPilot,
  loadGuestCutoutRig,
  renderGuestCutoutFrameSvg,
  validateGuestCutoutSource
} from "./lib/guestCutoutRig.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rigPath = path.join(root, "character-assets/rigs/guest-03/navy-suit-v3/rig.json");

test("guest-03 cutout source declares editable direction-specific parts without mirroring", async () => {
  const bundle = await loadGuestCutoutRig(rigPath);
  const result = validateGuestCutoutSource(bundle);
  assert.equal(result.passed, true);
  assert.equal(result.partCount, 23);
  assert.equal(bundle.rig.sourcePolicy.directionMirroring, false);
  assert.doesNotMatch(bundle.artwork, /scale\s*\(\s*-|matrix\s*\(\s*-/u);
  for (const direction of ["down", "left", "right", "up"]) {
    for (const part of bundle.rig.parts) {
      assert.match(bundle.definitions, new RegExp(`id="${direction}-${part.id}"`));
    }
  }
});

test("guest-03 cutout frames use joint transforms only and repeat the neutral pose", async () => {
  const bundle = await loadGuestCutoutRig(rigPath);
  for (const direction of ["down", "left", "right", "up"]) {
    const neutral = renderGuestCutoutFrameSvg(bundle, direction, 1);
    const repeatedNeutral = renderGuestCutoutFrameSvg(bundle, direction, 3);
    assert.equal(neutral, repeatedNeutral.replace("frame 4", "frame 2").replace('data-frame="4"', 'data-frame="2"'));
    assert.doesNotMatch(neutral, /scale\s*\(/u);
  }
});

test("guest-03 cutout build produces audited high-density and runtime sheets", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "guest-cutout-pilot-"));
  const outputRoot = path.join(temporary, "generated");
  const reviewRoot = path.join(temporary, "review");
  const result = await buildGuestCutoutPilot({ rigPath, outputRoot, reviewRoot });
  const audit = await auditGuestCutoutPilot({ rigPath, outputRoot, projectRoot: root });
  assert.equal(audit.report.summary.passed, true);
  const high = await sharp(result.outputs.highWalk).metadata();
  const runtime = await sharp(result.outputs.runtimeWalk).metadata();
  assert.deepEqual({ width: high.width, height: high.height }, { width: 768, height: 1152 });
  assert.deepEqual({ width: runtime.width, height: runtime.height }, { width: 384, height: 576 });
  const manifest = JSON.parse(await readFile(result.outputs.manifest, "utf8"));
  assert.deepEqual(manifest.forbiddenOperationsUsed, []);
});

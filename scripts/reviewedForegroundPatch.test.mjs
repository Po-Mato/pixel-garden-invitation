import assert from "node:assert/strict";
import test from "node:test";
import { sha256Text } from "./lib/mapForegroundContractWrite.mjs";
import { previewReviewedForegroundPatch } from "./lib/reviewedForegroundPatch.mjs";

const contract = {
  version: 1,
  zones: {
    lobby: [{ decorationId: "desk", depthY: 480, collision: { x: 1, y: 2, width: 3, height: 4 } }]
  }
};
const source = `${JSON.stringify(contract, null, 2)}\n`;

test("reviewed patch validates its source checksum and emits a reversible preview", () => {
  const patch = {
    version: 1,
    target: "client/src/game/worldForegroundPlacements.json",
    sourceContractVersion: 1,
    sourceChecksum: sha256Text(source),
    acceptedPlacementKeys: ["lobby/desk"],
    operationCount: 2,
    operations: [
      { op: "replace", path: "/zones/lobby/0/depthY", value: 475 },
      { op: "remove", path: "/zones/lobby/0/collision" }
    ]
  };
  const preview = previewReviewedForegroundPatch(source, patch);
  assert.equal(preview.proposedContract.zones.lobby[0].depthY, 475);
  assert.equal(preview.proposedContract.zones.lobby[0].collision, undefined);
  assert.deepEqual(preview.rollback.operations, [
    { op: "add", path: "/zones/lobby/0/collision", value: { x: 1, y: 2, width: 3, height: 4 } },
    { op: "replace", path: "/zones/lobby/0/depthY", value: 480 }
  ]);
});

test("reviewed patch rejects stale checksums and unrelated JSON pointers", () => {
  const base = {
    version: 1,
    target: "client/src/game/worldForegroundPlacements.json",
    sourceContractVersion: 1,
    sourceChecksum: "0".repeat(64),
    acceptedPlacementKeys: ["lobby/desk"],
    operationCount: 1,
    operations: [{ op: "replace", path: "/zones/lobby/0/depthY", value: 475 }]
  };
  assert.throws(() => previewReviewedForegroundPatch(source, base), /체크섬 불일치/);
  assert.throws(() => previewReviewedForegroundPatch(source, {
    ...base,
    sourceChecksum: sha256Text(source),
    operations: [{ op: "replace", path: "/version", value: 2 }]
  }), /허용되지 않은/);
});

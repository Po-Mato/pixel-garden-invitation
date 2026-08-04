import assert from "node:assert/strict";
import test from "node:test";
import {
  buildForegroundPlacementRollbackJsonPatch,
  sha256Text,
  verifyForegroundContractChecksum
} from "./lib/mapForegroundContractWrite.mjs";
import { applyForegroundPlacementJsonPatch } from "./lib/mapForegroundPlacementSuggestions.mjs";

test("foreground contract checksum locks writes to the previewed source", () => {
  const checksum = sha256Text("abc");
  assert.equal(checksum, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(verifyForegroundContractChecksum(checksum, checksum), true);
  assert.throws(() => verifyForegroundContractChecksum("", checksum), /--expect-checksum/);
  assert.throws(() => verifyForegroundContractChecksum("0".repeat(64), checksum), /체크섬 불일치/);
});

test("generated rollback restores replacements and removes optional additions", () => {
  const contract = { zones: { lobby: [{ depthY: 100 }] } };
  const forward = [
    { op: "replace", path: "/zones/lobby/0/depthY", value: 95 },
    { op: "add", path: "/zones/lobby/0/collision", value: { x: 1, y: 2, width: 3, height: 4 } }
  ];
  const changed = applyForegroundPlacementJsonPatch(contract, forward);
  const rollback = buildForegroundPlacementRollbackJsonPatch(contract, forward);
  assert.deepEqual(rollback, [
    { op: "remove", path: "/zones/lobby/0/collision" },
    { op: "replace", path: "/zones/lobby/0/depthY", value: 100 }
  ]);
  assert.deepEqual(applyForegroundPlacementJsonPatch(changed, rollback), contract);
});

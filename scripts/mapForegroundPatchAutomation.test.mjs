import assert from "node:assert/strict";
import test from "node:test";
import { sha256Text } from "./lib/mapForegroundContractWrite.mjs";
import { buildApprovedForegroundPatch } from "./lib/mapForegroundPatchAutomation.mjs";

const contract = { version: 1, zones: { lobby: [{ decorationId: "lobby-desk", depthY: 480, collision: { x: 1, y: 2, width: 3, height: 4 } }] } };
const source = `${JSON.stringify(contract, null, 2)}\n`;
const operations = [{ op: "replace", path: "/zones/lobby/0/depthY", value: 475 }];
const proposed = structuredClone(contract); proposed.zones.lobby[0].depthY = 475;

test("approved automation converts a CI suggestion into a reviewed patch", () => {
  const result = buildApprovedForegroundPatch(source, {
    version: 1,
    target: "client/src/game/worldForegroundPlacements.json",
    sourceChecksum: sha256Text(source),
    proposedChecksum: sha256Text(`${JSON.stringify(proposed, null, 2)}\n`),
    operationCount: 1,
    operations
  }, { approvedBy: "reviewer", pullRequestNumber: 42, headSha: "a".repeat(40) });
  assert.deepEqual(result.reviewedPatch.acceptedPlacementKeys, ["lobby/lobby-desk"]);
  assert.equal(JSON.parse(result.proposedSource).zones.lobby[0].depthY, 475);
  assert.equal(result.reviewedPatch.approval.approvedBy, "reviewer");
});

test("approved automation rejects stale and out-of-scope CI patches", () => {
  const base = { version: 1, target: "client/src/game/worldForegroundPlacements.json", sourceChecksum: "0".repeat(64), operationCount: 1, operations };
  assert.throws(() => buildApprovedForegroundPatch(source, base), /체크섬 불일치/);
  assert.throws(() => buildApprovedForegroundPatch(source, { ...base, sourceChecksum: sha256Text(source), operations: [{ op: "replace", path: "/version", value: 2 }] }), /허용 범위/);
});

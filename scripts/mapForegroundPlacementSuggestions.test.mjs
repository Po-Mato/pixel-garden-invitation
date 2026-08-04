import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { auditMapForegroundPlacements } from "./lib/mapForegroundAuditRenderer.mjs";
import {
  applyForegroundPlacementJsonPatch,
  buildForegroundPlacementJsonPatch,
  buildForegroundPlacementPatchPreview,
  buildMapForegroundPlacementSuggestions,
  clampRectToBounds,
  recommendForegroundPlacementGeometry
} from "./lib/mapForegroundPlacementSuggestions.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const floorMetric = {
  zoneId: "home",
  placement: {
    decorationId: "plant",
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    depthY: 58,
    depthMode: "floor"
  },
  visibleBounds: { x: 12, y: 24, width: 26, height: 30 }
};

test("foreground suggestion anchors floor depth to visible alpha pixels", () => {
  const suggestion = recommendForegroundPlacementGeometry(floorMetric, { depthPadding: 2, collisionPadding: 4 });
  assert.equal(suggestion.recommended.depthY, 56);
  assert.equal(suggestion.depthDelta, -2);
  assert.equal(suggestion.depthAction, "review-update");
  assert.deepEqual(suggestion.recommended.collision, { x: 10, y: 20, width: 30, height: 38 });
  assert.equal(suggestion.collisionAction, "optional-add");
});

test("foreground suggestion clamps expanded collision to placement bounds", () => {
  assert.deepEqual(clampRectToBounds(
    { x: 5, y: 15, width: 50, height: 60 },
    { x: 10, y: 20, width: 30, height: 40 }
  ), { x: 10, y: 20, width: 30, height: 40 });
});

test("foreground suggestion preserves semantic overhead depth", () => {
  const suggestion = recommendForegroundPlacementGeometry({
    ...floorMetric,
    placement: { ...floorMetric.placement, depthMode: "overhead", depthY: 76 }
  });
  assert.equal(suggestion.recommended.depthY, 76);
  assert.equal(suggestion.depthAction, "keep");
  assert.equal(suggestion.recommended.collision, null);
  assert.equal(suggestion.collisionAction, "not-applicable");
  assert.match(suggestion.reason, /수동 깊이값/);
});

test("foreground suggestion report counts instances and review actions", () => {
  const report = buildMapForegroundPlacementSuggestions({
    zoneIds: ["home"],
    instanceCount: 1,
    metrics: [floorMetric]
  });
  assert.equal(report.zoneCount, 1);
  assert.equal(report.instanceCount, 1);
  assert.equal(report.reviewCount, 1);
  assert.match(report.note, /자동 수정하지 않습니다/);
});

test("production floor recommendations contain alpha pixels and their recommended depth line", async () => {
  const audit = await auditMapForegroundPlacements({
    rootDir,
    manifestPath: path.join(rootDir, "map-assets/reference/v2/manifest.json")
  });
  const report = buildMapForegroundPlacementSuggestions(audit);
  assert.equal(report.suggestions.length, 18);
  for (const suggestion of report.suggestions) {
    if (suggestion.depthMode === "overhead") {
      assert.ok(["keep", "not-applicable"].includes(suggestion.collisionAction));
      continue;
    }
    const collision = suggestion.recommended.collision;
    const visible = suggestion.visibleBounds;
    assert.ok(collision.x <= visible.x && collision.y <= visible.y);
    assert.ok(collision.x + collision.width >= visible.x + visible.width);
    assert.ok(collision.y + collision.height >= visible.y + visible.height);
    assert.ok(suggestion.recommended.depthY >= collision.y);
    assert.ok(suggestion.recommended.depthY <= collision.y + collision.height);
  }

  const contract = JSON.parse(await readFile(
    path.join(rootDir, "client/src/game/worldForegroundPlacements.json"),
    "utf8"
  ));
  for (const includeOptionalCollisions of [false, true]) {
    const preview = buildForegroundPlacementPatchPreview(contract, report.suggestions, { includeOptionalCollisions });
    const proposedAudit = await auditMapForegroundPlacements({
      rootDir,
      manifestPath: path.join(rootDir, "map-assets/reference/v2/manifest.json"),
      placementsByZone: preview.proposedContract.zones
    });
    assert.equal(proposedAudit.instanceCount, 18);
  }
});

test("foreground JSON patch previews reviewed updates without optional collision additions", () => {
  const contract = {
    version: 1,
    zones: {
      home: [{ decorationId: "plant", depthY: 58, collision: { x: 10, y: 20, width: 30, height: 40 } }],
      lobby: [{ decorationId: "desk", depthY: 100 }]
    }
  };
  const suggestions = [
    {
      zoneId: "home",
      decorationId: "plant",
      depthAction: "review-update",
      collisionAction: "review-update",
      recommended: { depthY: 54, collision: { x: 11, y: 21, width: 28, height: 33 } }
    },
    {
      zoneId: "lobby",
      decorationId: "desk",
      depthAction: "keep",
      collisionAction: "optional-add",
      recommended: { depthY: 100, collision: { x: 2, y: 3, width: 4, height: 5 } }
    }
  ];

  const operations = buildForegroundPlacementJsonPatch(contract, suggestions);
  assert.deepEqual(operations, [
    { op: "replace", path: "/zones/home/0/depthY", value: 54 },
    { op: "replace", path: "/zones/home/0/collision", value: { x: 11, y: 21, width: 28, height: 33 } }
  ]);
  const preview = buildForegroundPlacementPatchPreview(contract, suggestions);
  assert.equal(preview.operationCount, 2);
  assert.equal(preview.proposedContract.zones.home[0].depthY, 54);
  assert.equal(preview.proposedContract.zones.lobby[0].collision, undefined);
  assert.equal(contract.zones.home[0].depthY, 58);
});

test("explicit optional collision patch can be applied and rejects invalid replacement paths", () => {
  const contract = { version: 1, zones: { lobby: [{ decorationId: "desk", depthY: 100 }] } };
  const suggestions = [{
    zoneId: "lobby",
    decorationId: "desk",
    depthAction: "keep",
    collisionAction: "optional-add",
    recommended: { depthY: 100, collision: { x: 2, y: 3, width: 4, height: 5 } }
  }];
  const operations = buildForegroundPlacementJsonPatch(contract, suggestions, { includeOptionalCollisions: true });
  assert.equal(operations[0].op, "add");
  assert.deepEqual(applyForegroundPlacementJsonPatch(contract, operations).zones.lobby[0].collision, {
    x: 2, y: 3, width: 4, height: 5
  });
  assert.throws(() => applyForegroundPlacementJsonPatch(contract, [
    { op: "replace", path: "/zones/lobby/0/missing", value: 1 }
  ]), /교체할.*값이 없습니다/);
});

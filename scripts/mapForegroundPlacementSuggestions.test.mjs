import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { auditMapForegroundPlacements } from "./lib/mapForegroundAuditRenderer.mjs";
import {
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
});

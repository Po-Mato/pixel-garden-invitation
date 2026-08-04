import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  DEFAULT_FOREGROUND_PLACEMENTS,
  auditForegroundPlacementGeometry,
  foregroundDiagnosticsSvg,
  serializeForegroundAuditReport,
  renderMapForegroundAuditSheet
} from "./lib/mapForegroundAuditRenderer.mjs";

async function writePng(file, width, height, background) {
  await mkdir(join(file, ".."), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background }
  }).png().toFile(file);
}

const visualPlacement = ({ asset, x, y }) => ({ asset, x, y });

test("keeps the subway platform free of foreground ticket gates", () => {
  assert.deepEqual(DEFAULT_FOREGROUND_PLACEMENTS["subway-station"], []);
});

test("aligns the lobby reception front with the built-in desk base", () => {
  assert.deepEqual(DEFAULT_FOREGROUND_PLACEMENTS.lobby.map(visualPlacement), [
    { asset: "reception-desk-front.png", x: 450, y: 360 }
  ]);
});

test("covers every foreground instance with one shared geometry and depth contract", () => {
  const placements = Object.values(DEFAULT_FOREGROUND_PLACEMENTS).flat();
  assert.equal(placements.length, 18);
  assert.equal(new Set(placements.map(({ decorationId }) => decorationId)).size, 18);
  assert.deepEqual(
    placements.filter(({ depthMode }) => depthMode === "overhead").map(({ decorationId }) => decorationId),
    ["train-straps"]
  );
  for (const placement of placements) {
    assert.ok(placement.width > 0 && placement.height > 0, placement.decorationId);
    assert.ok(placement.depthY > 0, placement.decorationId);
  }
});

test("composes the ceremony arch above the hall background", () => {
  assert.deepEqual(DEFAULT_FOREGROUND_PLACEMENTS["ceremony-hall"].map(visualPlacement), [
    { asset: "ceremony-arch-front.png", x: 180, y: 30 },
    { asset: "altar-table-front.png", x: 300, y: 165 },
    { asset: "aisle-bouquet-front.png", x: 240, y: 480 },
    { asset: "aisle-bouquet-front.png", x: 480, y: 720 },
    { asset: "aisle-bouquet-front.png", x: 240, y: 960 },
    { asset: "aisle-bouquet-front.png", x: 480, y: 1200 }
  ]);
});

test("composes four complete banquet tables without legacy split fronts", () => {
  assert.deepEqual(DEFAULT_FOREGROUND_PLACEMENTS.banquet.map(visualPlacement), [
    { asset: "table-floral.png", x: 210, y: 270 },
    { asset: "table-dining.png", x: 690, y: 270 },
    { asset: "table-dining.png", x: 210, y: 570 },
    { asset: "table-floral.png", x: 690, y: 570 }
  ]);
  assert.equal(
    DEFAULT_FOREGROUND_PLACEMENTS.banquet.some(({ asset }) => asset === "table-front.png"),
    false
  );
});

test("rejects foreground pixels that cross their floor depth or leave the map", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "map-foreground-geometry-"));
  const assetPath = join(rootDir, "front.png");
  const placement = {
    decorationId: "test-front",
    asset: "front.png",
    x: 5,
    y: 5,
    width: 10,
    height: 10,
    depthY: 14,
    depthMode: "floor"
  };

  try {
    await writePng(assetPath, 10, 10, "#ff0000ff");
    await assert.rejects(
      auditForegroundPlacementGeometry({ zoneId: "alpha", placement, assetPath, mapWidth: 40, mapHeight: 30 }),
      /visible pixels cross the configured floor depth line/
    );
    await assert.rejects(
      auditForegroundPlacementGeometry({
        zoneId: "alpha",
        placement: { ...placement, x: 35, depthY: 15 },
        assetPath,
        mapWidth: 40,
        mapHeight: 30
      }),
      /extends outside the map bounds/
    );
    await assert.rejects(
      auditForegroundPlacementGeometry({
        zoneId: "alpha",
        placement: {
          ...placement,
          depthY: 15,
          collision: { x: 5, y: 5, width: 10, height: 5 }
        },
        assetPath,
        mapWidth: 40,
        mapHeight: 30
      }),
      /collision does not contain its visible foreground pixels/
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("draws distinct alpha, depth, and collision diagnostics", () => {
  const svg = foregroundDiagnosticsSvg({
    width: 120,
    height: 100,
    metrics: [{
      placement: {
        decorationId: "test-front",
        asset: "front.png",
        x: 10,
        y: 20,
        width: 40,
        height: 30,
        depthY: 50,
        depthMode: "floor",
        collision: { x: 10, y: 25, width: 40, height: 25 }
      },
      visibleBounds: { x: 15, y: 27, width: 30, height: 20 }
    }]
  }).toString("utf8");

  assert.match(svg, /stroke="#4df2ff"/);
  assert.match(svg, /stroke="#ff4d98"/);
  assert.match(svg, /stroke="#ffc857"/);
  assert.match(svg, /x1="10" y1="50" x2="50" y2="50"/);
  assert.match(svg, />test-front<\/text>/);
});

test("serializes portable foreground metrics for CI artifacts", () => {
  const report = serializeForegroundAuditReport({
    zoneIds: ["alpha"],
    instanceCount: 1,
    placementMetrics: [{
      zoneId: "alpha",
      placement: {
        decorationId: "alpha-front",
        asset: "front.png",
        x: 5,
        y: 6,
        width: 10,
        height: 10,
        depthY: 16,
        depthMode: "floor"
      },
      alphaBounds: { canvasWidth: 10, canvasHeight: 10, x: 0, y: 0, width: 10, height: 8 },
      visibleBounds: { x: 5, y: 6, width: 10, height: 8 }
    }]
  });

  assert.deepEqual(report.zones, [{ zoneId: "alpha", instanceCount: 1 }]);
  assert.equal(report.placements[0].visibleBottom, 14);
  assert.equal(report.placements[0].depthGap, 2);
  assert.equal(report.placements[0].collision, null);
});

test("renders every manifest zone with its foreground placements", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "map-foreground-audit-"));
  const manifestPath = join(rootDir, "map-assets/reference/v2/manifest.json");
  const outputPath = join(rootDir, "audit.png");
  const manifest = {
    version: 2,
    zones: [
      {
        id: "alpha",
        background: { output: "background.webp", width: 40, height: 30 },
        overlays: [{ output: "front.png", width: 10, height: 10 }]
      },
      {
        id: "beta",
        background: { output: "background.webp", width: 30, height: 40 },
        overlays: [{ output: "front.png", width: 8, height: 12 }]
      }
    ]
  };

  try {
    await mkdir(join(manifestPath, ".."), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    await writePng(join(rootDir, "client/public/assets/maps/v2/alpha/background.webp"), 40, 30, "#203040");
    await writePng(join(rootDir, "client/public/assets/maps/v2/alpha/front.png"), 10, 10, "#ff0000ff");
    await writePng(join(rootDir, "client/public/assets/maps/v2/beta/background.webp"), 30, 40, "#405060");
    await writePng(join(rootDir, "client/public/assets/maps/v2/beta/front.png"), 8, 12, "#00ff00ff");

    const result = await renderMapForegroundAuditSheet({
      rootDir,
      manifestPath,
      outputPath,
      placementsByZone: {
        alpha: [{ decorationId: "alpha-front", asset: "front.png", x: 5, y: 6, width: 10, height: 10, depthY: 16, depthMode: "floor" }],
        beta: [{ decorationId: "beta-front", asset: "front.png", x: 12, y: 15, width: 8, height: 12, depthY: 27, depthMode: "floor" }]
      },
      cellWidth: 120,
      cellHeight: 100,
      columns: 2
    });

    const metadata = await sharp(outputPath).metadata();
    assert.deepEqual(result.zoneIds, ["alpha", "beta"]);
    assert.equal(result.instanceCount, 2);
    assert.equal(result.placementMetrics.length, 2);
    assert.equal(metadata.width, 240);
    assert.equal(metadata.height, 100);
    assert.ok((await readFile(outputPath)).length > 100);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

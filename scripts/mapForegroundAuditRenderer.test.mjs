import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  DEFAULT_FOREGROUND_PLACEMENTS,
  renderMapForegroundAuditSheet
} from "./lib/mapForegroundAuditRenderer.mjs";

async function writePng(file, width, height, background) {
  await mkdir(join(file, ".."), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background }
  }).png().toFile(file);
}

test("uses one unified gate bank placement for the subway station", () => {
  assert.deepEqual(DEFAULT_FOREGROUND_PLACEMENTS["subway-station"], [
    { asset: "ticket-gate-bank-front.png", x: 360, y: 360 }
  ]);
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
        alpha: [{ asset: "front.png", x: 5, y: 6 }],
        beta: [{ asset: "front.png", x: 12, y: 15 }]
      },
      cellWidth: 120,
      cellHeight: 100,
      columns: 2
    });

    const metadata = await sharp(outputPath).metadata();
    assert.deepEqual(result.zoneIds, ["alpha", "beta"]);
    assert.equal(result.instanceCount, 2);
    assert.equal(metadata.width, 240);
    assert.equal(metadata.height, 100);
    assert.ok((await readFile(outputPath)).length > 100);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

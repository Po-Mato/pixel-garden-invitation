import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { auditMapAssets } from "./lib/mapAssetAudit.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const manifest = {
  version: 2,
  zones: [
    {
      id: "home",
      background: {
        source: "pixel-background-source.png",
        output: "background.webp",
        width: 60,
        height: 90
      },
      overlays: [
        {
          source: "topiary-foreground-source.png",
          output: "topiary-foreground.png",
          width: 12,
          height: 18
        }
      ],
      requiredArtifacts: ["window", "sofa", "table", "door"]
    }
  ]
};

async function writeImage(file, { width, height, format, channels = 4, background }) {
  await mkdir(join(file, ".."), { recursive: true });
  await sharp({
    create: { width, height, channels, background }
  })[format]().toFile(file);
}

async function withFixture(callback) {
  const rootDir = await mkdtemp(join(tmpdir(), "map-asset-audit-"));
  const manifestPath = join(rootDir, "map-assets/reference/v2/manifest.json");
  const sourceDir = join(rootDir, "map-assets/reference/v2/home");
  const outputDir = join(rootDir, "client/public/assets/maps/v2/home");

  try {
    await mkdir(sourceDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeImage(join(sourceDir, "pixel-background-source.png"), {
      width: 60,
      height: 90,
      format: "png",
      background: "#4f7f9f"
    });
    await writeImage(join(sourceDir, "topiary-foreground-source.png"), {
      width: 12,
      height: 18,
      format: "png",
      background: "#00000000"
    });
    await writeImage(join(outputDir, "background.webp"), {
      width: 60,
      height: 90,
      format: "webp",
      background: "#4f7f9f"
    });
    await writeImage(join(outputDir, "topiary-foreground.png"), {
      width: 12,
      height: 18,
      format: "png",
      background: "#00000000"
    });

    return await callback({ rootDir, manifestPath, sourceDir, outputDir });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test("audits a complete map fixture", async () => {
  await withFixture(async ({ rootDir, manifestPath }) => {
    const result = await auditMapAssets({ rootDir, manifestPath });

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.zoneIds, ["home"]);
  });
});

test("reports a missing background output", async () => {
  await withFixture(async ({ rootDir, manifestPath, outputDir }) => {
    await unlink(join(outputDir, "background.webp"));

    const missingResult = await auditMapAssets({ rootDir, manifestPath });

    assert.match(missingResult.errors[0], /background\.webp/);
  });
});

test("reports an incorrectly sized background output", async () => {
  await withFixture(async ({ rootDir, manifestPath, outputDir }) => {
    await writeImage(join(outputDir, "background.webp"), {
      width: 61,
      height: 90,
      format: "webp",
      background: "#4f7f9f"
    });

    const wrongSizeResult = await auditMapAssets({ rootDir, manifestPath });

    assert.match(wrongSizeResult.errors[0], /크기/);
  });
});

test("reports an opaque overlay output", async () => {
  await withFixture(async ({ rootDir, manifestPath, outputDir }) => {
    await writeImage(join(outputDir, "topiary-foreground.png"), {
      width: 12,
      height: 18,
      format: "png",
      channels: 3,
      background: "#0f7f3f"
    });

    const opaqueOverlayResult = await auditMapAssets({ rootDir, manifestPath });

    assert.match(opaqueOverlayResult.errors[0], /알파/);
  });
});

test("reports a missing source image", async () => {
  await withFixture(async ({ rootDir, manifestPath, sourceDir }) => {
    await unlink(join(sourceDir, "pixel-background-source.png"));

    const result = await auditMapAssets({ rootDir, manifestPath });

    assert.match(result.errors[0], /pixel-background-source\.png/);
  });
});

test("allows higher-resolution source images when app outputs match the contract", async () => {
  await withFixture(async ({ rootDir, manifestPath, sourceDir }) => {
    await writeImage(join(sourceDir, "pixel-background-source.png"), {
      width: 120,
      height: 180,
      format: "png",
      background: "#4f7f9f"
    });
    await writeImage(join(sourceDir, "topiary-foreground-source.png"), {
      width: 24,
      height: 36,
      format: "png",
      background: "#00000000"
    });

    const result = await auditMapAssets({ rootDir, manifestPath });

    assert.equal(result.errors.length, 0);
  });
});

test("declares the ten map contracts in journey order", async () => {
  const actual = JSON.parse(
    await readFile(join(root, "map-assets/reference/v2/manifest.json"), "utf8")
  );

  assert.deepEqual(actual.zones, [
    {
      id: "home",
      background: { source: "pixel-background-source.png", output: "background.webp", width: 600, height: 720 },
      overlays: [{ source: "topiary-foreground-source.png", output: "topiary-foreground.png", width: 60, height: 90 }],
      requiredArtifacts: ["window", "sofa", "table", "shoe-rack", "door", "topiary"]
    },
    {
      id: "neighborhood",
      background: { source: "pixel-background-source.png", output: "background.webp", width: 1200, height: 660 },
      overlays: [{ source: "tree-canopy-source.png", output: "tree-canopy.png", width: 90, height: 150 }],
      requiredArtifacts: ["tree", "street-lamp", "bench", "crosswalk", "flower-bed", "station-entrance"]
    },
    {
      id: "subway-station",
      background: { source: "pixel-background-source.png", output: "background.webp", width: 900, height: 840 },
      overlays: [{ source: "ticket-gate-front-source.png", output: "ticket-gate-front.png", width: 60, height: 120 }],
      requiredArtifacts: ["route-band", "ticket-gate", "bench", "safety-line", "platform-door"]
    },
    {
      id: "subway-train",
      background: { source: "pixel-background-source.png", output: "background.webp", width: 1440, height: 540 },
      overlays: [{ source: "strap-row-foreground-source.png", output: "strap-row-foreground.png", width: 960, height: 120 }],
      requiredArtifacts: ["city-window", "teal-seat", "strap", "ceiling-light", "train-door"]
    },
    {
      id: "venue-exterior",
      background: { source: "pixel-background-source.png", output: "background.webp", width: 960, height: 900 },
      overlays: [{ source: "flower-arch-front-source.png", output: "flower-arch-front.png", width: 240, height: 180 }],
      requiredArtifacts: ["stone-facade", "glass-door", "flower-arch", "water-feature", "flower-bed", "tree"]
    },
    {
      id: "lobby",
      background: { source: "pixel-background-source.png", output: "background.webp", width: 1080, height: 900 },
      overlays: [{ source: "reception-desk-front-source.png", output: "reception-desk-front.png", width: 180, height: 120 }],
      requiredArtifacts: ["reception-desk", "gift-desk", "photo-wall", "sofa", "flower-arrangement", "hall-door"]
    },
    {
      id: "bridal-room",
      background: { source: "pixel-background-source.png", output: "background.webp", width: 720, height: 630 },
      overlays: [{ source: "flower-arrangement-front-source.png", output: "flower-arrangement-front.png", width: 90, height: 120 }],
      requiredArtifacts: ["flower-wall", "ivory-sofa", "vanity", "mirror", "flower-arrangement", "door"]
    },
    {
      id: "ceremony-hall",
      background: { source: "pixel-background-source.png", output: "background.webp", width: 780, height: 1920 },
      overlays: [{ source: "aisle-bouquet-front-source.png", output: "aisle-bouquet-front.png", width: 60, height: 90 }],
      requiredArtifacts: ["altar", "ceremony-seat", "aisle", "aisle-bouquet", "candle-light", "entrance-door"]
    },
    {
      id: "restroom",
      background: { source: "pixel-background-source.png", output: "background.webp", width: 660, height: 660 },
      overlays: [{ source: "stall-front-source.png", output: "stall-front.png", width: 150, height: 240 }],
      requiredArtifacts: ["mirror", "sink", "terrazzo-floor", "stall", "plant", "door"]
    },
    {
      id: "banquet",
      background: { source: "pixel-background-source.png", output: "background.webp", width: 1200, height: 930 },
      overlays: [{ source: "table-front-source.png", output: "table-front.png", width: 180, height: 180 }],
      requiredArtifacts: ["banquet-table", "table-setting", "buffet", "dessert-cart", "window", "garland"]
    }
  ]);
});

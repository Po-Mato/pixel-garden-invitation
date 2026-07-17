import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { auditMapAssets } from "./lib/mapAssetAudit.mjs";
import { buildMapAssets } from "./lib/mapAssetBuilder.mjs";

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

const fixtureZoneIds = ["home"];

async function auditFixture({ rootDir, manifestPath }, expectedZoneIds = fixtureZoneIds) {
  return auditMapAssets({ rootDir, manifestPath, expectedZoneIds });
}

async function writeImage(file, { width, height, format, channels = 4, background }) {
  await mkdir(join(file, ".."), { recursive: true });
  await sharp({
    create: { width, height, channels, background }
  })[format]().toFile(file);
}

async function writeTransparentVisibleImage(file, { width, height }) {
  const pixels = Buffer.alloc(width * height * 4);
  pixels.set([15, 127, 63, 255], 0);
  await mkdir(dirname(file), { recursive: true });
  await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toFile(file);
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
    await writeTransparentVisibleImage(join(sourceDir, "topiary-foreground-source.png"), {
      width: 12,
      height: 18
    });
    await writeImage(join(outputDir, "background.webp"), {
      width: 60,
      height: 90,
      format: "webp",
      background: "#4f7f9f"
    });
    await writeTransparentVisibleImage(join(outputDir, "topiary-foreground.png"), {
      width: 12,
      height: 18
    });

    return await callback({ rootDir, manifestPath, sourceDir, outputDir });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test("audits a complete map fixture", async () => {
  await withFixture(async ({ rootDir, manifestPath }) => {
    const result = await auditFixture({ rootDir, manifestPath });

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.zoneIds, ["home"]);
  });
});

test("allows a map zone with no foreground overlays", async () => {
  await withFixture(async ({ rootDir, manifestPath }) => {
    const overlaylessManifest = {
      ...manifest,
      zones: manifest.zones.map((zone) => ({ ...zone, overlays: [] }))
    };
    await writeFile(manifestPath, `${JSON.stringify(overlaylessManifest, null, 2)}\n`);

    const result = await auditFixture({ rootDir, manifestPath });

    assert.equal(result.errors.length, 0);
  });
});

test("reports a missing background output", async () => {
  await withFixture(async ({ rootDir, manifestPath, outputDir }) => {
    await unlink(join(outputDir, "background.webp"));

    const missingResult = await auditFixture({ rootDir, manifestPath });

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

    const wrongSizeResult = await auditFixture({ rootDir, manifestPath });

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

    const opaqueOverlayResult = await auditFixture({ rootDir, manifestPath });

    assert.match(opaqueOverlayResult.errors[0], /알파/);
  });
});

test("reports a fully transparent overlay output", async () => {
  await withFixture(async ({ rootDir, manifestPath, outputDir }) => {
    await writeImage(join(outputDir, "topiary-foreground.png"), {
      width: 12,
      height: 18,
      format: "png",
      background: "#00000000"
    });

    const transparentOverlayResult = await auditFixture({ rootDir, manifestPath });

    assert.ok(
      transparentOverlayResult.errors.some((error) => /visible 알파 pixel/.test(error)),
      `expected a visible alpha pixel error; received ${JSON.stringify(transparentOverlayResult.errors)}`
    );
  });
});

test("reports a missing source image", async () => {
  await withFixture(async ({ rootDir, manifestPath, sourceDir }) => {
    await unlink(join(sourceDir, "pixel-background-source.png"));

    const result = await auditFixture({ rootDir, manifestPath });

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

    const result = await auditFixture({ rootDir, manifestPath });

    assert.equal(result.errors.length, 0);
  });
});

async function corruptImageBody(file) {
  const data = await readFile(file);
  await writeFile(file, data.subarray(0, -24));
}

async function writePatternImage(file, { width, height, channels = 4 }) {
  const data = Buffer.alloc(width * height * channels);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const color = (x + y) % 2 === 0 ? [13, 97, 211] : [241, 72, 39];
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      if (channels === 4) data[offset + 3] = 255;
    }
  }

  await mkdir(dirname(file), { recursive: true });
  await sharp(data, { raw: { width, height, channels } }).png().toFile(file);
}

async function withBuildFixture(
  callback,
  { backgroundWidth = 103, overlayWidth = 103 } = {}
) {
  const rootDir = await mkdtemp(join(tmpdir(), "map-asset-build-"));
  const manifestPath = join(rootDir, "map-assets/reference/v2/manifest.json");
  const sourceDir = join(rootDir, "map-assets/reference/v2/home");
  const outputDir = join(rootDir, "client/public/assets/maps/v2/home");
  const buildManifest = {
    version: 2,
    zones: [
      {
        id: "home",
        background: {
          source: "pixel-background-source.png",
          output: "background.webp",
          width: 100,
          height: 100
        },
        overlays: [
          {
            source: "topiary-foreground-source.png",
            output: "topiary-foreground.png",
            width: 100,
            height: 100
          }
        ],
        requiredArtifacts: ["window", "sofa", "table", "door"]
      }
    ]
  };

  try {
    await mkdir(sourceDir, { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(buildManifest, null, 2)}\n`);
    await writePatternImage(join(sourceDir, "pixel-background-source.png"), {
      width: backgroundWidth,
      height: 100,
      channels: 3
    });
    await writePatternImage(join(sourceDir, "topiary-foreground-source.png"), {
      width: overlayWidth,
      height: 100
    });

    return await callback({
      rootDir,
      manifestPath,
      sourceDir,
      outputDir,
      backgroundSource: join(sourceDir, "pixel-background-source.png")
    });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test("builds assets at exactly three percent aspect-ratio difference", async () => {
  await withBuildFixture(async ({ rootDir, manifestPath, outputDir, backgroundSource }) => {
    await buildMapAssets({ rootDir, manifestPath, zoneId: "home" });

    const backgroundOutput = join(outputDir, "background.webp");
    const overlayOutput = join(outputDir, "topiary-foreground.png");
    const backgroundMetadata = await sharp(backgroundOutput).metadata();
    const overlayMetadata = await sharp(overlayOutput).metadata();
    const expectedBackground = await sharp(backgroundSource)
      .resize({ width: 100, height: 100, fit: "cover", kernel: sharp.kernel.nearest })
      .raw()
      .toBuffer();
    const actualBackground = await sharp(backgroundOutput).raw().toBuffer();
    const { data: overlayPixels } = await sharp(overlayOutput)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    assert.equal(backgroundMetadata.format, "webp");
    assert.equal(backgroundMetadata.width, 100);
    assert.equal(backgroundMetadata.height, 100);
    assert.deepEqual(actualBackground, expectedBackground);
    assert.equal(overlayMetadata.format, "png");
    assert.equal(overlayMetadata.width, 100);
    assert.equal(overlayMetadata.height, 100);
    assert.equal(overlayMetadata.hasAlpha, true);
    assert.ok(overlayPixels.some((channel, index) => index % 4 === 3 && channel === 0));
  });
});

test("rejects a background source that exceeds three percent aspect-ratio difference", async () => {
  await withBuildFixture(
    async ({ rootDir, manifestPath }) => {
      await assert.rejects(
        () => buildMapAssets({ rootDir, manifestPath, zoneId: "home" }),
        /background aspect ratio differs by 4\.00%; maximum is 3%/
      );
    },
    { backgroundWidth: 104 }
  );
});

test("rejects an overlay source that exceeds three percent aspect-ratio difference", async () => {
  await withBuildFixture(
    async ({ rootDir, manifestPath }) => {
      await assert.rejects(
        () => buildMapAssets({ rootDir, manifestPath, zoneId: "home" }),
        /topiary-foreground\.png aspect ratio differs by 4\.00%; maximum is 3%/
      );
    },
    { overlayWidth: 104 }
  );
});

test("defaults to the production journey zone order", async () => {
  await withFixture(async ({ rootDir, manifestPath }) => {
    const result = await auditMapAssets({ rootDir, manifestPath });

    assert.match(result.errors[0], /zone IDs must match the expected journey order/);
    assert.match(result.errors[0], /"home"/);
    assert.match(result.errors[0], /"banquet"/);
  });
});

test("rejects a manifest missing an expected zone", async () => {
  await withFixture(async ({ rootDir, manifestPath }) => {
    const result = await auditFixture(
      { rootDir, manifestPath },
      ["home", "neighborhood"]
    );

    assert.match(result.errors[0], /zone IDs must match the expected journey order/);
    assert.match(result.errors[0], /"home","neighborhood"/);
  });
});

test("rejects a manifest with an unexpected extra zone", async () => {
  await withFixture(async ({ rootDir, manifestPath }) => {
    const extraManifest = {
      ...manifest,
      zones: [...manifest.zones, { ...manifest.zones[0], id: "extra-zone" }]
    };
    await writeFile(manifestPath, `${JSON.stringify(extraManifest, null, 2)}\n`);

    const result = await auditFixture({ rootDir, manifestPath });

    assert.match(result.errors[0], /zone IDs must match the expected journey order/);
    assert.match(result.errors[0], /"extra-zone"/);
  });
});

test("rejects a manifest whose zones are out of journey order", async () => {
  await withFixture(async ({ rootDir, manifestPath }) => {
    const reorderedManifest = {
      ...manifest,
      zones: [
        { ...manifest.zones[0], id: "neighborhood" },
        manifest.zones[0]
      ]
    };
    await writeFile(manifestPath, `${JSON.stringify(reorderedManifest, null, 2)}\n`);

    const result = await auditFixture(
      { rootDir, manifestPath },
      ["home", "neighborhood"]
    );

    assert.match(result.errors[0], /zone IDs must match the expected journey order/);
    assert.match(result.errors[0], /"neighborhood","home"/);
  });
});

test("reports a background source with a corrupted pixel body", async () => {
  await withFixture(async ({ rootDir, manifestPath, sourceDir }) => {
    await corruptImageBody(join(sourceDir, "pixel-background-source.png"));

    const result = await auditFixture({ rootDir, manifestPath });

    assert.match(result.errors[0], /background source could not be inspected/);
  });
});

test("reports an overlay source with a corrupted pixel body", async () => {
  await withFixture(async ({ rootDir, manifestPath, sourceDir }) => {
    await corruptImageBody(join(sourceDir, "topiary-foreground-source.png"));

    const result = await auditFixture({ rootDir, manifestPath });

    assert.match(result.errors[0], /overlay source could not be inspected/);
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
      overlays: [],
      requiredArtifacts: ["route-band", "bench", "safety-line", "platform-door"]
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
      overlays: [],
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

test("wires map asset audit into root test and build scripts", async () => {
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  assert.equal(
    packageJson.scripts.build,
    "pnpm maps:audit && pnpm characters:audit && pnpm characters:generate && pnpm --filter @wedding-game/shared build && pnpm --filter @wedding-game/client build && pnpm --filter @wedding-game/worker build"
  );
  assert.equal(
    packageJson.scripts.test,
    "pnpm maps:audit && pnpm maps:test && pnpm characters:audit && pnpm characters:test && pnpm --filter @wedding-game/shared test && pnpm --filter @wedding-game/client test && pnpm --filter @wedding-game/worker test"
  );
});

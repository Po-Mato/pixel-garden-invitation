import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const DEFAULT_FOREGROUND_PLACEMENTS = Object.freeze({
  home: [{ asset: "topiary-foreground.png", x: 420, y: 480 }],
  neighborhood: [
    { asset: "tree-canopy.png", x: 214, y: 90 },
    { asset: "tree-canopy.png", x: 513, y: 90 },
    { asset: "tree-canopy.png", x: 860, y: 90 }
  ],
  "subway-station": [],
  "subway-train": [{ asset: "strap-row-foreground.png", x: 240, y: 105 }],
  "venue-exterior": [{ asset: "flower-arch-front.png", x: 360, y: 180 }],
  lobby: [{ asset: "reception-desk-front.png", x: 450, y: 320 }],
  "bridal-room": [{ asset: "flower-arrangement-front.png", x: 240, y: 300 }],
  "ceremony-hall": [
    { asset: "aisle-bouquet-front.png", x: 240, y: 480 },
    { asset: "aisle-bouquet-front.png", x: 480, y: 720 },
    { asset: "aisle-bouquet-front.png", x: 240, y: 960 },
    { asset: "aisle-bouquet-front.png", x: 480, y: 1200 }
  ],
  restroom: [],
  banquet: [
    { asset: "table-floral.png", x: 210, y: 270 },
    { asset: "table-dining.png", x: 690, y: 270 },
    { asset: "table-dining.png", x: 210, y: 570 },
    { asset: "table-floral.png", x: 690, y: 570 }
  ]
});

function escapeXml(value) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    "\"": "&quot;"
  })[character]);
}

function labelSvg(label, width, height) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#171717"/>` +
      `<text x="12" y="24" font-family="Arial, sans-serif" font-size="18" fill="#ffffff">` +
      `${escapeXml(label)}</text></svg>`
  );
}

export async function renderMapForegroundAuditSheet({
  rootDir,
  manifestPath,
  outputPath,
  placementsByZone = DEFAULT_FOREGROUND_PLACEMENTS,
  cellWidth = 540,
  cellHeight = 420,
  columns = 2
}) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const labelHeight = 34;
  const rows = Math.ceil(manifest.zones.length / columns);
  const cells = [];
  let instanceCount = 0;

  for (const [index, zone] of manifest.zones.entries()) {
    const zoneDir = path.join(rootDir, "client/public/assets/maps/v2", zone.id);
    const placements = placementsByZone[zone.id] ?? [];
    const declaredAssets = new Set(zone.overlays.map((overlay) => overlay.output));

    for (const placement of placements) {
      if (!declaredAssets.has(placement.asset)) {
        throw new Error(`${zone.id} foreground asset is not declared in the manifest: ${placement.asset}`);
      }
    }

    const backgroundPath = path.join(zoneDir, zone.background.output);
    const composed = await sharp(backgroundPath)
      .composite(placements.map((placement) => ({
        input: path.join(zoneDir, placement.asset),
        left: placement.x,
        top: placement.y
      })))
      .png()
      .toBuffer();
    const mapImage = await sharp(composed)
      .resize({
        width: cellWidth,
        height: cellHeight - labelHeight,
        fit: "contain",
        kernel: sharp.kernel.nearest,
        background: "#171717"
      })
      .png()
      .toBuffer();
    const cell = await sharp({
      create: { width: cellWidth, height: cellHeight, channels: 4, background: "#171717" }
    })
      .composite([
        { input: labelSvg(zone.id, cellWidth, labelHeight), left: 0, top: 0 },
        { input: mapImage, left: 0, top: labelHeight }
      ])
      .png()
      .toBuffer();

    cells.push({
      input: cell,
      left: (index % columns) * cellWidth,
      top: Math.floor(index / columns) * cellHeight
    });
    instanceCount += placements.length;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      width: cellWidth * columns,
      height: cellHeight * rows,
      channels: 4,
      background: "#111111"
    }
  }).composite(cells).png().toFile(outputPath);

  return {
    zoneIds: manifest.zones.map((zone) => zone.id),
    instanceCount,
    outputPath
  };
}

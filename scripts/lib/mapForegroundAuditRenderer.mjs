import { readFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const placementContract = JSON.parse(readFileSync(
  new URL("../../client/src/game/worldForegroundPlacements.json", import.meta.url),
  "utf8"
));

export const DEFAULT_FOREGROUND_PLACEMENTS = Object.freeze(Object.fromEntries(
  Object.entries(placementContract.zones).map(([zoneId, placements]) => [
    zoneId,
    Object.freeze(placements.map((placement) => Object.freeze(placement)))
  ])
));

function containsRect(outer, inner) {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
}

export async function inspectForegroundAlphaBounds(assetPath, alphaThreshold = 8) {
  const { data, info } = await sharp(assetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha < alphaThreshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) throw new Error(`${assetPath} has no visible foreground pixels`);
  return {
    canvasWidth: info.width,
    canvasHeight: info.height,
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

export async function auditForegroundPlacementGeometry({
  zoneId,
  placement,
  assetPath,
  mapWidth,
  mapHeight
}) {
  const prefix = `${zoneId}/${placement.decorationId}`;
  const alphaBounds = await inspectForegroundAlphaBounds(assetPath);
  if (alphaBounds.canvasWidth !== placement.width || alphaBounds.canvasHeight !== placement.height) {
    throw new Error(`${prefix} asset dimensions do not match the placement contract`);
  }

  const placementBounds = {
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height
  };
  const visibleBounds = {
    x: placement.x + alphaBounds.x,
    y: placement.y + alphaBounds.y,
    width: alphaBounds.width,
    height: alphaBounds.height
  };
  const mapBounds = { x: 0, y: 0, width: mapWidth, height: mapHeight };
  if (!containsRect(mapBounds, placementBounds) || !containsRect(mapBounds, visibleBounds)) {
    throw new Error(`${prefix} foreground placement extends outside the map bounds`);
  }

  const canvasCenter = placement.width / 2;
  const visibleCenter = alphaBounds.x + alphaBounds.width / 2;
  const centerTolerance = Math.max(6, placement.width * 0.08);
  if (Math.abs(visibleCenter - canvasCenter) > centerTolerance) {
    throw new Error(`${prefix} visible pixels are not horizontally centered in the placement canvas`);
  }

  const visibleBottom = visibleBounds.y + visibleBounds.height;
  const placementBottom = placement.y + placement.height;
  if (placement.depthMode === "floor") {
    if (placement.depthY < visibleBottom || placement.depthY > placementBottom) {
      throw new Error(`${prefix} visible pixels cross the configured floor depth line`);
    }
  } else if (placement.depthMode === "overhead") {
    if (placement.depthY < placementBottom) {
      throw new Error(`${prefix} overhead depth line must stay below its placement canvas`);
    }
  } else {
    throw new Error(`${prefix} has an unsupported depth mode`);
  }

  if (placement.collision) {
    if (!containsRect(placement.collision, visibleBounds)) {
      throw new Error(`${prefix} collision does not contain its visible foreground pixels`);
    }
    const collisionBottom = placement.collision.y + placement.collision.height;
    if (placement.depthY < placement.collision.y || placement.depthY > collisionBottom) {
      throw new Error(`${prefix} depth line falls outside its collision region`);
    }
  }

  return { zoneId, placement, alphaBounds, visibleBounds };
}

async function auditForegroundPlacementSet({ rootDir, manifest, placementsByZone }) {
  const manifestZoneIds = manifest.zones.map((zone) => zone.id);
  const placementZoneIds = Object.keys(placementsByZone);
  if (JSON.stringify(placementZoneIds) !== JSON.stringify(manifestZoneIds)) {
    throw new Error("foreground placement zones must match the map manifest order");
  }

  const metrics = [];
  const decorationIds = new Set();
  for (const zone of manifest.zones) {
    const placements = placementsByZone[zone.id] ?? [];
    const declaredAssets = new Set(zone.overlays.map((overlay) => overlay.output));
    const placedAssets = new Set(placements.map((placement) => placement.asset));
    for (const asset of declaredAssets) {
      if (!placedAssets.has(asset)) throw new Error(`${zone.id} foreground asset has no placement contract: ${asset}`);
    }
    for (const placement of placements) {
      if (!declaredAssets.has(placement.asset)) {
        throw new Error(`${zone.id} foreground asset is not declared in the manifest: ${placement.asset}`);
      }
      if (decorationIds.has(placement.decorationId)) {
        throw new Error(`duplicate foreground decoration id: ${placement.decorationId}`);
      }
      decorationIds.add(placement.decorationId);
      metrics.push(await auditForegroundPlacementGeometry({
        zoneId: zone.id,
        placement,
        assetPath: path.join(rootDir, "client/public/assets/maps/v2", zone.id, placement.asset),
        mapWidth: zone.background.width,
        mapHeight: zone.background.height
      }));
    }
  }
  return { zoneIds: manifestZoneIds, instanceCount: metrics.length, metrics };
}

export async function auditMapForegroundPlacements({
  rootDir,
  manifestPath,
  placementsByZone = DEFAULT_FOREGROUND_PLACEMENTS
}) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return auditForegroundPlacementSet({ rootDir, manifest, placementsByZone });
}

function escapeXml(value) {
  return String(value).replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    "\"": "&quot;"
  })[character]);
}

function labelSvg(label, width, height, instanceCount) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#171717"/>` +
      `<text x="12" y="22" font-family="ui-monospace, monospace" font-size="16" font-weight="700" fill="#ffffff">` +
      `${escapeXml(label)} · ${instanceCount}</text>` +
      `<g font-family="ui-monospace, monospace" font-size="10" font-weight="700">` +
        `<line x1="12" y1="39" x2="28" y2="39" stroke="#4df2ff" stroke-width="3"/>` +
        `<text x="34" y="43" fill="#d7fbff">ALPHA</text>` +
        `<line x1="91" y1="39" x2="107" y2="39" stroke="#ff4d98" stroke-width="3"/>` +
        `<text x="113" y="43" fill="#ffd8e9">DEPTH</text>` +
        `<rect x="173" y="33" width="16" height="12" fill="#ffc85744" stroke="#ffc857" stroke-width="2"/>` +
        `<text x="195" y="43" fill="#ffe8ae">COLLISION</text>` +
      `</g></svg>`
  );
}

export function foregroundDiagnosticsSvg({ width, height, metrics }) {
  const diagnostics = metrics.map(({ placement, visibleBounds }) => {
    const collision = placement.collision
      ? `<rect x="${placement.collision.x}" y="${placement.collision.y}" width="${placement.collision.width}" height="${placement.collision.height}" fill="#ffc85733" stroke="#ffc857" stroke-width="4" stroke-dasharray="10 6"/>`
      : "";
    const labelY = Math.max(16, visibleBounds.y - 7);
    return collision +
      `<rect x="${visibleBounds.x}" y="${visibleBounds.y}" width="${visibleBounds.width}" height="${visibleBounds.height}" fill="none" stroke="#4df2ff" stroke-width="4"/>` +
      `<line x1="${placement.x}" y1="${placement.depthY}" x2="${placement.x + placement.width}" y2="${placement.depthY}" stroke="#ff4d98" stroke-width="5"/>` +
      `<text x="${placement.x + 4}" y="${labelY}" font-family="ui-monospace, monospace" font-size="13" font-weight="700" fill="#ffffff" stroke="#171717" stroke-width="4" paint-order="stroke">${escapeXml(placement.decorationId)}</text>`;
  }).join("");

  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">` +
      diagnostics +
    `</svg>`
  );
}

export function serializeForegroundAuditReport(result) {
  return {
    version: 1,
    zoneCount: result.zoneIds.length,
    instanceCount: result.instanceCount,
    zones: result.zoneIds.map((zoneId) => ({
      zoneId,
      instanceCount: result.placementMetrics.filter((metric) => metric.zoneId === zoneId).length
    })),
    placements: result.placementMetrics.map(({ zoneId, placement, alphaBounds, visibleBounds }) => ({
      zoneId,
      decorationId: placement.decorationId,
      asset: placement.asset,
      depthMode: placement.depthMode,
      placementBounds: {
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height
      },
      alphaBounds,
      visibleBounds,
      depthY: placement.depthY,
      visibleBottom: visibleBounds.y + visibleBounds.height,
      depthGap: placement.depthY - (visibleBounds.y + visibleBounds.height),
      collision: placement.collision ?? null
    }))
  };
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
  const placementAudit = await auditForegroundPlacementSet({ rootDir, manifest, placementsByZone });
  const labelHeight = 52;
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
    const zoneMetrics = placementAudit.metrics.filter((metric) => metric.zoneId === zone.id);
    const composed = await sharp(backgroundPath)
      .composite([
        ...placements.map((placement) => ({
          input: path.join(zoneDir, placement.asset),
          left: placement.x,
          top: placement.y
        })),
        {
          input: foregroundDiagnosticsSvg({
            width: zone.background.width,
            height: zone.background.height,
            metrics: zoneMetrics
          }),
          left: 0,
          top: 0
        }
      ])
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
        { input: labelSvg(zone.id, cellWidth, labelHeight, placements.length), left: 0, top: 0 },
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
    placementMetrics: placementAudit.metrics,
    outputPath
  };
}

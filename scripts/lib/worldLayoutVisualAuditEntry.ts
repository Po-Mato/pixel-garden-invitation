import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { gridTileSize } from "../../client/src/game/movement";
import { gardenWorld } from "../../client/src/game/world";
import { auditWorldGeometry } from "../../client/src/game/worldGeometryAudit";
import { evaluateWorldGeometryAuditPolicy } from "../../client/src/game/worldGeometryAuditPolicy";
import { worldPropInteractionsForZone } from "../../client/src/game/worldPropInteractions";

const rootDir = process.cwd();
const artifactDir = path.join(rootDir, ".superpowers/visual-regression");
const outputPath = path.join(artifactDir, "world-layout-current.png");
const baselinePath = path.join(rootDir, "scripts/visual-baselines/world-layout-regression.webp");
const diffPath = path.join(artifactDir, "world-layout-diff.png");
const reportPath = path.join(artifactDir, "world-layout-regions.json");
const policyReportPath = path.join(artifactDir, "world-geometry-policy-report.json");
const cellWidth = 360;
const cellHeight = 260;
const labelHeight = 32;
const columns = 2;

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;"
  })[character]!);
}

function zoneSvg(zone: (typeof gardenWorld.zones)[number]): Buffer {
  const audit = auditWorldGeometry(zone);
  const policy = evaluateWorldGeometryAuditPolicy(audit);
  const scale = Math.min(cellWidth / zone.bounds.width, (cellHeight - labelHeight) / zone.bounds.height);
  const contentWidth = zone.bounds.width * scale;
  const contentHeight = zone.bounds.height * scale;
  const offsetX = (cellWidth - contentWidth) / 2;
  const offsetY = labelHeight + ((cellHeight - labelHeight) - contentHeight) / 2;
  const transform = `translate(${offsetX} ${offsetY}) scale(${scale})`;
  const tileRects = audit.tiles.map((tile) => {
    const color = tile.state === "reachable" ? "#9fd0ab" : tile.state === "blocked" ? "#59635f" : "#df5368";
    return `<rect x="${tile.x - gridTileSize / 2}" y="${tile.y - gridTileSize / 2}" width="${gridTileSize}" height="${gridTileSize}" fill="${color}" stroke="#f7f2df" stroke-width="1"/>`;
  }).join("");
  const portals = zone.portals.flatMap((portal) => portal.entryTiles.map((point) => (
    `<rect x="${point.x - 11}" y="${point.y - 11}" width="22" height="22" fill="#f5d45e" stroke="#5d473f" stroke-width="3"/>`
  ))).join("");
  const interactions = worldPropInteractionsForZone(zone).map(({ decoration }) => (
    `<circle cx="${decoration.x + decoration.width / 2}" cy="${decoration.y + decoration.height / 2}" r="16" fill="#ae5068" stroke="#fff4c5" stroke-width="4"/>`
  )).join("");
  const issues = `B${audit.severityCounts.blocking} · W${audit.severityCounts.warning}/${policy.maxWarnings}`;

  return Buffer.from(`<svg width="${cellWidth}" height="${cellHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#17211d"/>
    <text x="10" y="21" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#fffbe5">${escapeXml(zone.label)} · 이동 ${audit.reachableCount} · 충돌 ${audit.blockedCount} · ${issues}</text>
    <g transform="${transform}">${tileRects}${portals}${interactions}</g>
  </svg>`);
}

async function renderSheet(): Promise<void> {
  const rows = Math.ceil(gardenWorld.zones.length / columns);
  const height = rows * cellHeight;
  const composites = gardenWorld.zones.map((zone, index) => ({
    input: zoneSvg(zone),
    left: (index % columns) * cellWidth,
    top: Math.floor(index / columns) * cellHeight
  }));
  await mkdir(artifactDir, { recursive: true });
  await sharp({
    create: { width: cellWidth * columns, height, channels: 4, background: "#17211d" }
  }).composite(composites).png().toFile(outputPath);
  const zones = gardenWorld.zones.map((zone) => {
    const audit = auditWorldGeometry(zone);
    const policy = evaluateWorldGeometryAuditPolicy(audit);
    return {
      zoneId: zone.id,
      policy,
      findings: audit.findings
    };
  });
  await writeFile(policyReportPath, `${JSON.stringify({ version: 1, zones }, null, 2)}\n`);
  const blocked = zones.filter(({ policy }) => policy.status === "blocked");
  if (blocked.length > 0) {
    throw new Error(`world geometry policy blocked: ${blocked.map(({ zoneId, policy }) => (
      `${zoneId} (${policy.violations.join(", ")})`
    )).join("; ")}`);
  }
}

async function compareSheet(): Promise<void> {
  const [current, baseline] = await Promise.all([
    sharp(outputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(baselinePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  if (current.info.width !== baseline.info.width || current.info.height !== baseline.info.height) {
    throw new Error("world layout baseline dimensions do not match");
  }
  const diff = Buffer.alloc(current.data.length);
  let changedPixels = 0;
  const zoneResults = gardenWorld.zones.map((zone, index) => ({
    zoneId: zone.id,
    changedPixels: 0,
    comparedPixels: cellWidth * cellHeight,
    changedRatio: 0
  }));
  for (let offset = 0; offset < current.data.length; offset += 4) {
    const difference = Math.max(
      Math.abs(current.data[offset] - baseline.data[offset]),
      Math.abs(current.data[offset + 1] - baseline.data[offset + 1]),
      Math.abs(current.data[offset + 2] - baseline.data[offset + 2])
    );
    const pixel = offset / 4;
    const x = pixel % current.info.width;
    const y = Math.floor(pixel / current.info.width);
    const zoneIndex = Math.floor(y / cellHeight) * columns + Math.floor(x / cellWidth);
    const changed = y % cellHeight >= labelHeight && difference > 24;
    if (changed) {
      changedPixels += 1;
      if (zoneResults[zoneIndex]) zoneResults[zoneIndex].changedPixels += 1;
    }
    const faded = Math.round(205 + current.data[offset] * 0.12);
    diff[offset] = changed ? 255 : faded;
    diff[offset + 1] = changed ? 42 : faded;
    diff[offset + 2] = changed ? 92 : faded;
    diff[offset + 3] = 255;
  }
  zoneResults.forEach((result) => {
    result.changedRatio = result.changedPixels / result.comparedPixels;
  });
  const changedRatio = changedPixels / (current.info.width * current.info.height);
  await sharp(diff, { raw: current.info }).png().toFile(diffPath);
  await writeFile(reportPath, `${JSON.stringify({ changedRatio, zoneResults }, null, 2)}\n`);
  const failedZones = zoneResults.filter(({ changedRatio: ratio }) => ratio > 0.005);
  if (changedRatio > 0.002 || failedZones.length > 0) {
    throw new Error(`world layout visual regression: ${(changedRatio * 100).toFixed(3)}% changed`);
  }
  console.log(`월드 배치 시각 회귀 통과: ${(changedRatio * 100).toFixed(3)}% 변경`);
}

await renderSheet();
if (process.argv.includes("--approve")) {
  await sharp(outputPath).webp({ quality: 96, lossless: true }).toFile(baselinePath);
  console.log(`월드 배치 기준 이미지 승인: ${baselinePath}`);
} else {
  await readFile(baselinePath);
  await compareSheet();
}

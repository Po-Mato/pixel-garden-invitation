import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(projectRoot, "character-assets/guest-character-presets.json");
const portraitRoot = path.join(projectRoot, "client/public/characters/generated/guests/portraits");
export const defaultPhotoEffectAuditPath = path.join(
  projectRoot,
  ".superpowers/character-review/photo-effect-anchor-audit.png"
);

export function opaqueBounds(raw, width, height, alphaThreshold = 8) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (raw[(y * width + x) * 4 + 3] <= alphaThreshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  return { left, top, right: right + 1, bottom: bottom + 1, width: right - left + 1, height: bottom - top + 1 };
}

export function photoEffectAnchors(bounds) {
  const x = (bounds.left + bounds.right) / 2;
  return {
    head: { x, y: bounds.top + bounds.height * 0.18 },
    chest: { x, y: bounds.top + bounds.height * 0.49 },
    feet: { x, y: bounds.bottom }
  };
}

export async function auditPhotoEffectPortrait(filePath, guestId, presetId) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = opaqueBounds(data, info.width, info.height);
  if (!bounds) throw new Error(`${guestId}: portrait is fully transparent`);
  if (info.width !== 192 || info.height !== 288) throw new Error(`${guestId}: portrait must be 192x288`);
  if (bounds.height < 205 || bounds.height > 280) throw new Error(`${guestId}: visible height ${bounds.height} is outside 205..280`);
  const anchors = photoEffectAnchors(bounds);
  if (!(anchors.head.y < anchors.chest.y && anchors.chest.y < anchors.feet.y)) {
    throw new Error(`${guestId}: photo effect anchors are out of order`);
  }
  return { guestId, presetId, filePath, width: info.width, height: info.height, bounds, anchors };
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function renderCard(report, cardWidth, cardHeight) {
  const imageX = 44;
  const imageY = 64;
  const scale = 1;
  const { bounds, anchors } = report;
  const overlay = Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0.5" y="0.5" width="${cardWidth - 1}" height="${cardHeight - 1}" fill="none" stroke="#c9c0b8"/>
    <text x="18" y="21" font-family="sans-serif" font-size="13" font-weight="700" fill="#493d38">${escapeXml(report.guestId)}</text>
    <text x="18" y="39" font-family="sans-serif" font-size="10" font-weight="600" fill="#6d625c">${escapeXml(report.presetId)}</text>
    <rect x="${imageX + bounds.left * scale}" y="${imageY + bounds.top * scale}" width="${bounds.width * scale}" height="${bounds.height * scale}" fill="none" stroke="#c54d59" stroke-width="1.5" stroke-dasharray="5 3"/>
    <line x1="${imageX + bounds.left}" y1="${imageY + anchors.head.y}" x2="${imageX + bounds.right}" y2="${imageY + anchors.head.y}" stroke="#d44f75" stroke-width="2"/>
    <line x1="${imageX + bounds.left}" y1="${imageY + anchors.chest.y}" x2="${imageX + bounds.right}" y2="${imageY + anchors.chest.y}" stroke="#4778c4" stroke-width="2"/>
    <line x1="${imageX + bounds.left}" y1="${imageY + anchors.feet.y}" x2="${imageX + bounds.right}" y2="${imageY + anchors.feet.y}" stroke="#47895c" stroke-width="2"/>
    <circle cx="${imageX + anchors.head.x}" cy="${imageY + anchors.head.y}" r="5" fill="#d44f75" stroke="#fff" stroke-width="2"/>
    <circle cx="${imageX + anchors.chest.x}" cy="${imageY + anchors.chest.y}" r="5" fill="#4778c4" stroke="#fff" stroke-width="2"/>
    <circle cx="${imageX + anchors.feet.x}" cy="${imageY + anchors.feet.y}" r="5" fill="#47895c" stroke="#fff" stroke-width="2"/>
    <text x="18" y="${cardHeight - 21}" font-family="sans-serif" font-size="11" fill="#6d625c">head ●  chest ●  feet ●  visible ${bounds.width}×${bounds.height}</text>
  </svg>`);
  return sharp({ create: { width: cardWidth, height: cardHeight, channels: 4, background: "#fffdf8" } })
    .composite([
      { input: report.filePath, left: imageX, top: imageY },
      { input: overlay, left: 0, top: 0 }
    ])
    .png()
    .toBuffer();
}

export async function collectPhotoEffectAuditReports() {
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  if (!Array.isArray(catalog.presets) || catalog.presets.length !== 12) {
    throw new Error(`photo effect audit requires 12 presets, received ${catalog.presets?.length ?? 0}`);
  }
  return Promise.all(catalog.presets.map((preset, index) => auditPhotoEffectPortrait(
    path.join(portraitRoot, `${preset.id}.png`),
    `guest-${String(index + 1).padStart(2, "0")}`,
    preset.id
  )));
}

export async function renderPhotoEffectAnchorAudit(outputPath = defaultPhotoEffectAuditPath) {
  const reports = await collectPhotoEffectAuditReports();
  const cardWidth = 280;
  const cardHeight = 390;
  const columns = 4;
  const cards = await Promise.all(reports.map((report) => renderCard(report, cardWidth, cardHeight)));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({
    create: { width: cardWidth * columns, height: cardHeight * 3, channels: 4, background: "#f1eee9" }
  }).composite(cards.map((input, index) => ({
    input,
    left: (index % columns) * cardWidth,
    top: Math.floor(index / columns) * cardHeight
  }))).png().toFile(outputPath);
  await fs.writeFile(outputPath.replace(/\.png$/, ".json"), `${JSON.stringify(reports.map(({ filePath, ...report }) => report), null, 2)}\n`);
  return reports;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reports = await renderPhotoEffectAnchorAudit();
  console.log(`Photo effect anchor audit passed: ${reports.length} guests`);
  console.log(defaultPhotoEffectAuditPath);
}

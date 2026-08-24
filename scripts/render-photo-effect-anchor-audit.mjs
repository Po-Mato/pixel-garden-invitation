import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(projectRoot, "character-assets/guest-character-presets.json");
const portraitRoot = path.join(projectRoot, "client/public/characters/generated/guests/portraits");
const walkRoot = path.join(projectRoot, "client/public/characters/generated/guests/world");
const photoZoneBackgroundPath = path.join(projectRoot, "client/public/assets/maps/v2/ceremony-hall/background.webp");
const walkDirections = ["down", "left", "right", "up"];
const walkFrameWidth = 48;
const walkFrameHeight = 72;
const walkFrameColumns = 4;
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

export async function auditPhotoEffectWalkSheet(filePath, guestId) {
  const metadata = await sharp(filePath).metadata();
  if (metadata.width !== walkFrameWidth * walkFrameColumns || metadata.height !== walkFrameHeight * 4) {
    throw new Error(`${guestId}: walk sheet must be 192x288`);
  }
  const frames = [];
  for (let row = 0; row < walkDirections.length; row += 1) {
    for (let column = 0; column < walkFrameColumns; column += 1) {
      const { data, info } = await sharp(filePath)
        .extract({ left: column * walkFrameWidth, top: row * walkFrameHeight, width: walkFrameWidth, height: walkFrameHeight })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const bounds = opaqueBounds(data, info.width, info.height);
      if (!bounds) throw new Error(`${guestId}/${walkDirections[row]}/step-${column + 1}: frame is transparent`);
      if (bounds.height < 60 || bounds.height > 66) {
        throw new Error(`${guestId}/${walkDirections[row]}/step-${column + 1}: visible height ${bounds.height} is outside 60..66`);
      }
      frames.push({
        direction: walkDirections[row],
        step: column + 1,
        row,
        column,
        bounds,
        anchors: photoEffectAnchors(bounds)
      });
    }
  }
  return { filePath, width: metadata.width, height: metadata.height, frames };
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function renderCard(report, cardWidth, cardHeight) {
  const portraitScale = 0.75;
  const portraitX = 73;
  const portraitY = 189;
  const walkX = 310;
  const walkY = 60;
  const walkScale = 2;
  const { bounds, anchors, walk } = report;
  const photoBackground = await sharp(photoZoneBackgroundPath)
    .extract({ left: 120, top: 30, width: 540, height: 510 })
    .resize(240, 330, { fit: "cover" })
    .modulate({ brightness: 0.98, saturation: 0.92 })
    .toBuffer();
  const portrait = await sharp(report.filePath).resize(144, 216, { fit: "fill" }).toBuffer();
  const walkSheet = await sharp(walk.filePath).resize(384, 576, { kernel: "nearest" }).toBuffer();
  const walkGuides = walk.frames.map((frame) => {
    const frameX = walkX + frame.column * walkFrameWidth * walkScale;
    const frameY = walkY + frame.row * walkFrameHeight * walkScale;
    const left = frameX + frame.bounds.left * walkScale;
    const right = frameX + frame.bounds.right * walkScale;
    return `<rect x="${left}" y="${frameY + frame.bounds.top * walkScale}" width="${frame.bounds.width * walkScale}" height="${frame.bounds.height * walkScale}" fill="none" stroke="#ba6b77" stroke-width="1" stroke-dasharray="3 2"/>
      <line x1="${left}" y1="${frameY + frame.anchors.head.y * walkScale}" x2="${right}" y2="${frameY + frame.anchors.head.y * walkScale}" stroke="#d44f75" stroke-width="1"/>
      <line x1="${left}" y1="${frameY + frame.anchors.feet.y * walkScale}" x2="${right}" y2="${frameY + frame.anchors.feet.y * walkScale}" stroke="#47895c" stroke-width="1"/>`;
  }).join("\n");
  const overlay = Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0.5" y="0.5" width="${cardWidth - 1}" height="${cardHeight - 1}" fill="none" stroke="#c9c0b8"/>
    <text x="18" y="21" font-family="sans-serif" font-size="13" font-weight="700" fill="#493d38">${escapeXml(report.guestId)}</text>
    <text x="18" y="39" font-family="sans-serif" font-size="10" font-weight="600" fill="#6d625c">${escapeXml(report.presetId)}</text>
    <text x="22" y="62" font-family="sans-serif" font-size="9" font-weight="700" fill="#725e63">ACTUAL PHOTOZONE EFFECT</text>
    <rect x="24" y="74" width="242" height="332" fill="none" stroke="#8f7d76"/>
    <ellipse cx="${portraitX + anchors.head.x * portraitScale}" cy="${portraitY + (bounds.top + bounds.height * 0.5) * portraitScale}" rx="58" ry="86" fill="none" stroke="#f3d178" stroke-width="4" opacity="0.82"/>
    <circle cx="${portraitX + anchors.head.x * portraitScale}" cy="${portraitY + anchors.head.y * portraitScale}" r="7" fill="#d44f75" stroke="#fff" stroke-width="2"/>
    <circle cx="${portraitX + anchors.chest.x * portraitScale}" cy="${portraitY + anchors.chest.y * portraitScale}" r="7" fill="#4778c4" stroke="#fff" stroke-width="2"/>
    <circle cx="${portraitX + anchors.feet.x * portraitScale}" cy="${portraitY + anchors.feet.y * portraitScale}" r="7" fill="#47895c" stroke="#fff" stroke-width="2"/>
    <text x="22" y="430" font-family="sans-serif" font-size="9" fill="#6d625c">portrait visible ${bounds.width}×${bounds.height} · effect anchors</text>
    <text x="310" y="50" font-family="sans-serif" font-size="9" font-weight="700" fill="#725e63">16-FRAME WALK SOURCE AUDIT</text>
    ${walkDirections.map((direction, row) => `<text x="282" y="${walkY + row * 144 + 76}" font-family="sans-serif" font-size="8" font-weight="700" fill="#66555a">${direction}</text>`).join("\n")}
    ${walkGuides}
    <text x="18" y="${cardHeight - 20}" font-family="sans-serif" font-size="10" fill="#6d625c">16 walk frames · head/feet guides · photo effect composite</text>
  </svg>`);
  return sharp({ create: { width: cardWidth, height: cardHeight, channels: 4, background: "#fffdf8" } })
    .composite([
      { input: photoBackground, left: 25, top: 75 },
      { input: portrait, left: portraitX, top: portraitY },
      { input: walkSheet, left: walkX, top: walkY },
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
  return Promise.all(catalog.presets.map(async (preset, index) => {
    const guestId = `guest-${String(index + 1).padStart(2, "0")}`;
    const portrait = await auditPhotoEffectPortrait(path.join(portraitRoot, `${preset.id}.png`), guestId, preset.id);
    const walk = await auditPhotoEffectWalkSheet(path.join(walkRoot, `${preset.id}__walk.png`), guestId);
    return { ...portrait, walk };
  }));
}

export async function renderPhotoEffectAnchorAudit(outputPath = defaultPhotoEffectAuditPath) {
  const reports = await collectPhotoEffectAuditReports();
  const cardWidth = 720;
  const cardHeight = 670;
  const columns = 2;
  const cards = await Promise.all(reports.map((report) => renderCard(report, cardWidth, cardHeight)));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({
    create: { width: cardWidth * columns, height: cardHeight * 6, channels: 4, background: "#f1eee9" }
  }).composite(cards.map((input, index) => ({
    input,
    left: (index % columns) * cardWidth,
    top: Math.floor(index / columns) * cardHeight
  }))).png().toFile(outputPath);
  await fs.writeFile(outputPath.replace(/\.png$/, ".json"), `${JSON.stringify(reports.map(({ filePath, walk, ...report }) => ({
    ...report,
    walk: { ...walk, filePath: undefined }
  })), null, 2)}\n`);
  return reports;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reports = await renderPhotoEffectAnchorAudit();
  console.log(`Photo effect anchor audit passed: ${reports.length} guests / ${reports.reduce((sum, report) => sum + report.walk.frames.length, 0)} walk frames`);
  console.log(defaultPhotoEffectAuditPath);
}

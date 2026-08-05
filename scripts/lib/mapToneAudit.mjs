import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export function relativeLuminance([red, green, blue]) {
  const linear = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(first, second) {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function evaluateMapToneMetrics(metrics, expected, thresholds) {
  const portalInk = relativeLuminance([26, 39, 48]);
  const portalText = relativeLuminance([248, 255, 255]);
  const portalSurface = portalInk * 0.88 + metrics.p90Luminance * 0.12;
  const spotContrast = contrastRatio(relativeLuminance([52, 43, 45]), relativeLuminance([255, 253, 248]));
  const npcContrast = contrastRatio(relativeLuminance([63, 53, 56]), relativeLuminance([255, 253, 249]));
  const portalContrast = contrastRatio(portalText, portalSurface);
  const issues = [];

  for (const key of ["averageLuminance", "p10Luminance", "p90Luminance"]) {
    if (Math.abs(metrics[key] - expected[key]) > thresholds.maxLuminanceDelta) {
      issues.push(`${key} 기준선 이탈`);
    }
  }
  if (metrics.p90Luminance - metrics.p10Luminance < thresholds.minDynamicRange) {
    issues.push("맵 명암 폭 부족");
  }
  for (const [label, ratio] of [["스팟", spotContrast], ["포털", portalContrast], ["NPC", npcContrast]]) {
    if (ratio < thresholds.minTextContrast) issues.push(`${label} 라벨 대비 부족`);
  }

  return { issues, contrasts: { spot: spotContrast, portal: portalContrast, npc: npcContrast } };
}

export async function measureMapTone(imagePath) {
  const { data, info } = await sharp(imagePath)
    .resize({ width: 120 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luminances = [];
  for (let offset = 0; offset < data.length; offset += info.channels) {
    luminances.push(relativeLuminance([data[offset], data[offset + 1], data[offset + 2]]));
  }
  luminances.sort((left, right) => left - right);
  return {
    averageLuminance: luminances.reduce((sum, value) => sum + value, 0) / luminances.length,
    p10Luminance: luminances[Math.floor(luminances.length * 0.1)],
    p90Luminance: luminances[Math.floor(luminances.length * 0.9)]
  };
}

export async function auditMapTones({ rootDir, contractPath = path.join(rootDir, "scripts/visual-baselines/map-tone-contract.json") }) {
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const mapRoot = path.join(rootDir, "client/public/assets/maps/v2");
  const actualZoneIds = (await readdir(mapRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const expectedZoneIds = Object.keys(contract.zones).sort();
  const issues = [];
  if (JSON.stringify(actualZoneIds) !== JSON.stringify(expectedZoneIds)) issues.push("맵 톤 계약 구역 목록 불일치");

  const reports = [];
  for (const zoneId of expectedZoneIds) {
    const metrics = await measureMapTone(path.join(mapRoot, zoneId, "background.webp"));
    const evaluation = evaluateMapToneMetrics(metrics, contract.zones[zoneId], contract.thresholds);
    evaluation.issues.forEach((issue) => issues.push(`${zoneId}: ${issue}`));
    reports.push({ zoneId, ...metrics, ...evaluation });
  }
  return { issues, reports, contractPath };
}

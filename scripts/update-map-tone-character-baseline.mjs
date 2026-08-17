#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditMapTones } from "./lib/mapToneAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(rootDir, "scripts/visual-baselines/map-tone-contract.json");
const contract = JSON.parse(await readFile(contractPath, "utf8"));
const result = await auditMapTones({ rootDir, contractPath });
const rounded = (value) => Number(value.toFixed(3));
const roundedRecord = (record) => Object.fromEntries(
  Object.entries(record).map(([key, value]) => [
    key,
    typeof value === "number" ? rounded(value) : roundedRecord(value)
  ])
);

for (const report of result.reports) {
  if (report.characterEdgeContrast < contract.thresholds.minCharacterEdgeContrast) {
    throw new Error(`${report.zoneId} 캐릭터 최소 대비가 안전 기준보다 낮습니다.`);
  }
  if (report.weakestMovementEdgeContrast < contract.thresholds.minCharacterEdgeContrast) {
    throw new Error(`${report.zoneId} 이동 캐릭터 최소 대비가 안전 기준보다 낮습니다.`);
  }
  for (const profile of Object.values(report.displayProfiles)) {
    if (
      profile.weakestCharacterEdgeContrast < contract.thresholds.minDisplayCharacterEdgeContrast
      || profile.weakestMovementEdgeContrast < contract.thresholds.minDisplayCharacterEdgeContrast
    ) {
      throw new Error(`${report.zoneId} ${profile.label} 표시 대비가 안전 기준보다 낮습니다.`);
    }
  }

  contract.zones[report.zoneId] = {
    ...contract.zones[report.zoneId],
    averageLuminance: rounded(report.averageLuminance),
    p10Luminance: rounded(report.p10Luminance),
    p90Luminance: rounded(report.p90Luminance),
    sceneAverageLuminance: rounded(report.sceneAverageLuminance),
    sceneP10Luminance: rounded(report.sceneP10Luminance),
    sceneP90Luminance: rounded(report.sceneP90Luminance),
    characterEdgeContrast: rounded(report.characterEdgeContrast),
    characterPresetCount: report.characterPresetCount,
    characterEdgeContrasts: roundedRecord(report.characterEdgeContrasts),
    foregroundAssetCount: report.foregroundAssetCount,
    movementFrameCount: report.movementFrameCount,
    characterMovementEdgeContrasts: roundedRecord(report.characterMovementEdgeContrasts)
  };
}

contract.version += 1;
await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
console.log(
  `평면 하객 맵 톤 기준선 갱신 완료: ${result.reports.length}개 구역 · 계약 v${contract.version}`
);

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { renderMobileGameVisualAudit } from "./mobileGameVisualAuditRenderer.mjs";
import { buildVisualBaselineProvenance } from "./visualBaselineProvenance.mjs";

export function parseBaselineApprovalArgs(args) {
  let approved = false;
  let reason = "";

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--approve") {
      approved = true;
      continue;
    }
    if (argument === "--reason") {
      reason = args[index + 1]?.trim() ?? "";
      index += 1;
      continue;
    }
    throw new Error(`알 수 없는 옵션입니다: ${argument}`);
  }

  if (!approved) throw new Error("시각 기준선 갱신에는 --approve 승인이 필요합니다.");
  if (!reason) throw new Error("시각 기준선 갱신 사유를 --reason으로 입력해야 합니다.");
  return { approved, reason };
}

export async function approveMobileVisualBaseline({ rootDir, approved, reason, now = new Date() }) {
  if (!approved) throw new Error("승인되지 않은 시각 기준선 갱신은 실행할 수 없습니다.");
  if (!reason?.trim()) throw new Error("시각 기준선 갱신 사유가 필요합니다.");

  const baselineDir = path.join(rootDir, "scripts/visual-baselines");
  const baselinePath = path.join(baselineDir, "mobile-game-visual-regression.webp");
  const metadataPath = path.join(baselineDir, "mobile-game-visual-regression.json");
  await mkdir(baselineDir, { recursive: true });
  const temporaryDir = await mkdtemp(path.join(baselineDir, ".approval-"));
  try {
    const auditPath = path.join(temporaryDir, "mobile-game-current.png");
    const nextBaselinePath = path.join(temporaryDir, "mobile-game-visual-regression.webp");
    const nextMetadataPath = path.join(temporaryDir, "mobile-game-visual-regression.json");
    const rendered = await renderMobileGameVisualAudit({ rootDir, outputPath: auditPath });
    await sharp(auditPath).webp({ lossless: true, effort: 6 }).toFile(nextBaselinePath);
    const baselineBuffer = await readFile(nextBaselinePath);
    const provenance = await buildVisualBaselineProvenance({
      rootDir,
      files: [{ logicalPath: "mobile-game-current", filePath: auditPath }]
    });
    const metadata = {
      version: 2,
      approvedAt: now.toISOString(),
      reason: reason.trim(),
      sha256: createHash("sha256").update(baselineBuffer).digest("hex"),
      provenance,
      width: rendered.outputWidth,
      height: rendered.outputHeight,
      mapZoneIds: rendered.mapZoneIds,
      characterPresetIds: rendered.characterPresetIds,
      directionSampleCount: rendered.directionSampleCount
    };

    await writeFile(nextMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    await rename(nextBaselinePath, baselinePath);
    await rename(nextMetadataPath, metadataPath);
    return { baselinePath, metadataPath, metadata };
  } finally {
    await rm(temporaryDir, { recursive: true, force: true });
  }
}

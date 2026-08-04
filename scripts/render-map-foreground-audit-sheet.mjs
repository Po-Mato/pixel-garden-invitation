import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  renderMapForegroundAuditSheet,
  serializeForegroundAuditReport
} from "./lib/mapForegroundAuditRenderer.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outIndex = process.argv.indexOf("--out");
const outputPath = outIndex >= 0
  ? path.resolve(rootDir, process.argv[outIndex + 1])
  : path.join(rootDir, ".superpowers/visual-regression/map-foreground-audit.png");
const reportIndex = process.argv.indexOf("--report");
const reportPath = reportIndex >= 0
  ? path.resolve(rootDir, process.argv[reportIndex + 1])
  : path.join(rootDir, ".superpowers/visual-regression/map-foreground-audit.json");

try {
  const result = await renderMapForegroundAuditSheet({
    rootDir,
    manifestPath: path.join(rootDir, "map-assets/reference/v2/manifest.json"),
    outputPath
  });
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify({ status: "passed", ...serializeForegroundAuditReport(result) }, null, 2)}\n`);

  console.log(`맵 전경 감사 시트 생성 완료: ${result.zoneIds.length}개 맵, ${result.instanceCount}개 전경`);
  console.log(result.outputPath);
  console.log(reportPath);
} catch (error) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify({
    status: "failed",
    error: error instanceof Error ? error.message : String(error)
  }, null, 2)}\n`);
  throw error;
}

import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditMapAssets } from "./lib/mapAssetAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(rootDir, "map-assets/reference/v2/manifest.json");
const result = await auditMapAssets({ rootDir, manifestPath });

if (result.errors.length > 0) {
  console.error("Map asset audit failed:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Map asset audit passed: ${result.zoneIds.length} zones, ${result.files.length} files`);
}

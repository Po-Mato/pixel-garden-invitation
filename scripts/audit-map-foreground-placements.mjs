import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditMapForegroundPlacements } from "./lib/mapForegroundAuditRenderer.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await auditMapForegroundPlacements({
  rootDir,
  manifestPath: path.join(rootDir, "map-assets/reference/v2/manifest.json")
});

console.log(`Map foreground placement audit passed: ${result.zoneIds.length} zones, ${result.instanceCount} placements`);

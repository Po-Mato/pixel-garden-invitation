import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMapAssets } from "./lib/mapAssetBuilder.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(rootDir, "map-assets/reference/v2/manifest.json");

function parseZoneArgument(argumentsList) {
  const index = argumentsList.indexOf("--zone");
  const inline = argumentsList.find((argument) => argument.startsWith("--zone="));

  if (index !== -1) {
    if (!argumentsList[index + 1]) throw new Error("--zone requires a zone id");
    return argumentsList[index + 1];
  }

  return inline ? inline.slice("--zone=".length) : null;
}

const requestedZone = parseZoneArgument(process.argv.slice(2));
const result = await buildMapAssets({ rootDir, manifestPath, zoneId: requestedZone });

for (const zoneId of result.zoneIds) {
  console.log(`Built map assets: ${zoneId}`);
}

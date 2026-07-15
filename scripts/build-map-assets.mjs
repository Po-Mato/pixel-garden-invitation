import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(rootDir, "map-assets/reference/v2/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

function parseZoneArgument(argumentsList) {
  const index = argumentsList.indexOf("--zone");
  const inline = argumentsList.find((argument) => argument.startsWith("--zone="));

  if (index !== -1) {
    if (!argumentsList[index + 1]) throw new Error("--zone requires a zone id");
    return argumentsList[index + 1];
  }

  return inline ? inline.slice("--zone=".length) : null;
}

async function requireFile(file) {
  try {
    await access(file);
  } catch {
    throw new Error(`Input file is missing: ${file}`);
  }
}

async function assertCompatibleAspectRatio(file, expected, label) {
  const metadata = await sharp(file).metadata();
  const actualRatio = metadata.width / metadata.height;
  const expectedRatio = expected.width / expected.height;
  const difference = Math.abs(actualRatio - expectedRatio) / expectedRatio;

  if (difference > 0.03) {
    throw new Error(
      `${label} aspect ratio differs by ${(difference * 100).toFixed(2)}%; maximum is 3%`
    );
  }
}

async function buildZone(zone) {
  const sourceDir = path.join(rootDir, "map-assets/reference/v2", zone.id);
  const outputDir = path.join(rootDir, "client/public/assets/maps/v2", zone.id);
  const backgroundSource = path.join(sourceDir, zone.background.source);
  const backgroundOutput = path.join(outputDir, zone.background.output);

  await requireFile(backgroundSource);
  await assertCompatibleAspectRatio(backgroundSource, zone.background, `${zone.id} background`);
  await mkdir(outputDir, { recursive: true });
  await sharp(backgroundSource)
    .resize({
      width: zone.background.width,
      height: zone.background.height,
      fit: "cover",
      kernel: sharp.kernel.nearest
    })
    .webp({ lossless: true })
    .toFile(backgroundOutput);

  for (const overlay of zone.overlays) {
    const source = path.join(sourceDir, overlay.source);
    const output = path.join(outputDir, overlay.output);
    await requireFile(source);
    await assertCompatibleAspectRatio(source, overlay, `${zone.id} overlay ${overlay.output}`);
    await sharp(source)
      .ensureAlpha()
      .resize({
        width: overlay.width,
        height: overlay.height,
        fit: "contain",
        kernel: sharp.kernel.nearest,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(output);
  }

  console.log(`Built map assets: ${zone.id}`);
}

const requestedZone = parseZoneArgument(process.argv.slice(2));
const zones = requestedZone
  ? manifest.zones.filter((zone) => zone.id === requestedZone)
  : manifest.zones;

if (requestedZone && zones.length === 0) {
  throw new Error(`Unknown map zone: ${requestedZone}`);
}

for (const zone of zones) {
  await buildZone(zone);
}

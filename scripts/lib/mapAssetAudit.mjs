import { access, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const DEFAULT_MAP_ZONE_IDS = Object.freeze([
  "home",
  "neighborhood",
  "subway-station",
  "subway-train",
  "venue-exterior",
  "lobby",
  "bridal-room",
  "ceremony-hall",
  "banquet",
  "restroom"
]);

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function dimensionsAreValid(dimensions) {
  return (
    Number.isInteger(dimensions?.width) &&
    dimensions.width > 0 &&
    Number.isInteger(dimensions?.height) &&
    dimensions.height > 0
  );
}

function addDuplicateErrors(errors, values, label) {
  const seen = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      errors.push(`manifest ${label} is duplicated: ${value}`);
    }
    seen.add(value);
  }
}

async function inspectImage(file, expected, label, errors, { transparent = false } = {}) {
  if (!(await exists(file))) {
    errors.push(`${label} is missing: ${file}`);
    return;
  }

  try {
    const image = sharp(file);
    const metadata = await image.metadata();

    if (metadata.width !== expected.width || metadata.height !== expected.height) {
      errors.push(
        `${label} 크기 must be ${expected.width}x${expected.height}; ` +
          `received ${metadata.width}x${metadata.height}`
      );
    }

    if (transparent) {
      const { data } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const hasTransparentPixel = metadata.hasAlpha && data.some((channel, index) => index % 4 === 3 && channel < 255);
      const hasVisiblePixel = data.some((channel, index) => index % 4 === 3 && channel > 0);

      if (!hasTransparentPixel) {
        errors.push(`${label} must preserve transparent 알파 pixels`);
      }
      if (!hasVisiblePixel) {
        errors.push(`${label} must contain at least one visible 알파 pixel`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${label} could not be inspected: ${message}`);
  }
}

async function inspectSource(file, label, errors) {
  if (!(await exists(file))) {
    errors.push(`${label} is missing: ${file}`);
    return;
  }

  try {
    await sharp(file).ensureAlpha().raw().toBuffer();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${label} could not be inspected: ${message}`);
  }
}

function sameZoneOrder(actual, expected) {
  return actual.length === expected.length && actual.every((id, index) => id === expected[index]);
}

export async function auditMapAssets({
  rootDir,
  manifestPath,
  expectedZoneIds = DEFAULT_MAP_ZONE_IDS
}) {
  const errors = [];
  const files = [];
  let manifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { zoneIds: [], errors: [`manifest could not be read: ${message}`], files };
  }

  if (!Array.isArray(manifest.zones)) {
    return { zoneIds: [], errors: ["manifest zones must be an array"], files };
  }

  const zoneIds = manifest.zones.map((zone) => zone?.id).filter((id) => typeof id === "string");

  if (!sameZoneOrder(zoneIds, expectedZoneIds)) {
    errors.push(
      "manifest zone IDs must match the expected journey order; " +
        `expected ${JSON.stringify(expectedZoneIds)}; received ${JSON.stringify(zoneIds)}`
    );
  }

  addDuplicateErrors(errors, zoneIds, "zone id");

  for (const zone of manifest.zones) {
    if (!zone || typeof zone.id !== "string" || zone.id.length === 0) {
      errors.push("manifest zone must have an id");
      continue;
    }

    const sourceDir = path.join(rootDir, "map-assets/reference/v2", zone.id);
    const outputDir = path.join(rootDir, "client/public/assets/maps/v2", zone.id);
    const background = zone.background;

    if (!background || typeof background.source !== "string" || typeof background.output !== "string" || !dimensionsAreValid(background)) {
      errors.push(`manifest background is invalid for ${zone.id}`);
    } else {
      const source = path.join(sourceDir, background.source);
      const output = path.join(outputDir, background.output);
      files.push(source, output);
      await inspectSource(source, `${zone.id} background source`, errors);
      await inspectImage(output, background, `${zone.id} background output`, errors);
    }

    if (!Array.isArray(zone.overlays)) {
      errors.push(`manifest overlays must be an array for ${zone.id}`);
    } else {
      addDuplicateErrors(errors, zone.overlays.map((overlay) => overlay?.output).filter(Boolean), `${zone.id} overlay output`);

      for (const overlay of zone.overlays) {
        if (!overlay || typeof overlay.source !== "string" || typeof overlay.output !== "string" || !dimensionsAreValid(overlay)) {
          errors.push(`manifest overlay is invalid for ${zone.id}`);
          continue;
        }

        const source = path.join(sourceDir, overlay.source);
        const output = path.join(outputDir, overlay.output);
        files.push(source, output);
        await inspectSource(source, `${zone.id} overlay source`, errors);
        await inspectImage(output, overlay, `${zone.id} overlay output`, errors, { transparent: true });
      }
    }

    if (!Array.isArray(zone.requiredArtifacts) || zone.requiredArtifacts.length < 4) {
      errors.push(`manifest requiredArtifacts must contain at least four entries for ${zone.id}`);
    } else {
      addDuplicateErrors(errors, zone.requiredArtifacts, `${zone.id} requiredArtifact`);
    }
  }

  return { zoneIds, errors, files };
}

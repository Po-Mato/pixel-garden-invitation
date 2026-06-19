import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import Sharp from "sharp";
import {
  collectStyleComparisonFailures,
  combinedAlpha,
  inspectSheet,
  rawRgba as readRawRgba
} from "./lib/characterAssetAudit.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "character-assets/source");
const catalog = JSON.parse(
  await readFile(path.join(root, "shared/character-catalog.json"), "utf8")
);
const rules = JSON.parse(
  await readFile(path.join(root, "character-assets/quality-rules.json"), "utf8")
);
const scopes = new Set(["all", "couple", "base", "hair", "outfits", "accessories"]);
const families = new Set(["all", "masculine", "feminine"]);

function parseOption(name, allowed, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  const value = argument ? argument.slice(prefix.length) : fallback;

  if (!allowed.has(value)) {
    throw new Error(
      `Invalid --${name}=${value}; expected one of ${[...allowed].join(", ")}`
    );
  }

  return value;
}

const scope = parseOption("scope", scopes, "all");
const family = parseOption("family", families, "all");
const failures = [];

function displayFile(file) {
  if (Array.isArray(file)) {
    return file.map(displayFile).join(" + ");
  }
  return path.relative(root, file) || file;
}

function fail(file, message) {
  failures.push(`${displayFile(file)}: ${message}`);
}

function normalizeAuditError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/^Input file is missing:/i.test(message)) {
    return "input file is missing";
  }
  return message.split(`${root}${path.sep}`).join("");
}

function wants(group) {
  return scope === "all" || scope === group;
}

function familyMatches(item) {
  return family === "all" || item.family === family;
}

async function rawRgba(file) {
  return readRawRgba(file, Sharp);
}

async function auditSheet(
  file,
  expectedDimensions,
  classRules,
  { requireEveryFrame = false, footBaseline = null } = {}
) {
  try {
    const inspection = await inspectSheet(file, {
      frameWidth: rules.frame.width,
      frameHeight: rules.frame.height
    });

    if (
      inspection.width !== expectedDimensions.width ||
      inspection.height !== expectedDimensions.height
    ) {
      fail(
        file,
        `must be ${expectedDimensions.width}x${expectedDimensions.height}; ` +
          `received ${inspection.width}x${inspection.height}`
      );
      return;
    }

    if (inspection.uniqueOpaqueColors < classRules.minimumUniqueOpaqueColors) {
      fail(
        file,
        `has ${inspection.uniqueOpaqueColors} unique opaque colors; ` +
          `requires at least ${classRules.minimumUniqueOpaqueColors}`
      );
    }

    const minimumOpaquePixels =
      classRules.minimumOpaquePixelsPerFrame ??
      classRules.minimumOpaquePixelsPerOccupiedFrame;
    const occupiedFrames = [];

    for (let index = 0; index < inspection.frames.length; index += 1) {
      const frame = inspection.frames[index];

      if (frame.opaquePixels === 0) {
        if (requireEveryFrame) {
          fail(file, `frame ${index + 1} is empty`);
        }
        continue;
      }

      occupiedFrames.push({ frame, index });

      if (frame.opaquePixels < minimumOpaquePixels) {
        fail(
          file,
          `frame ${index + 1} has ${frame.opaquePixels} opaque pixels; ` +
            `requires at least ${minimumOpaquePixels}`
        );
      }

      if (
        classRules.minimumColorTransitionsPerFrame !== undefined &&
        frame.colorTransitions < classRules.minimumColorTransitionsPerFrame
      ) {
        fail(
          file,
          `frame ${index + 1} has ${frame.colorTransitions} color transitions; ` +
            `requires at least ${classRules.minimumColorTransitionsPerFrame}`
        );
      }
    }

    if (footBaseline && occupiedFrames.length > 0) {
      const bottoms = occupiedFrames.map(({ frame, index }) => ({
        bottom: frame.bounds.bottom,
        index
      }));

      for (const { bottom, index } of bottoms) {
        if (bottom < footBaseline.footBottomMin || bottom > footBaseline.footBottomMax) {
          fail(
            file,
            `frame ${index + 1} foot bottom ${bottom} is outside ` +
              `${footBaseline.footBottomMin}-${footBaseline.footBottomMax}`
          );
        }
      }

      const bottomValues = bottoms.map(({ bottom }) => bottom);
      const spread = Math.max(...bottomValues) - Math.min(...bottomValues);
      if (spread > footBaseline.footBottomSpreadMax) {
        fail(
          file,
          `foot bottom spread ${spread} exceeds ${footBaseline.footBottomSpreadMax}`
        );
      }
    }
  } catch (error) {
    fail(file, normalizeAuditError(error));
  }
}

async function auditDistinctStyles(styles, minimumAlphaDifference) {
  if (styles.length === 0) return;
  const loaded = [];

  for (const style of styles) {
    try {
      const layers = await Promise.all(style.files.map(rawRgba));
      const image = combinedAlpha(layers);
      loaded.push({
        ...style,
        image
      });
    } catch (error) {
      fail(style.files, normalizeAuditError(error));
    }
  }

  for (const comparisonFailure of collectStyleComparisonFailures(
    loaded,
    minimumAlphaDifference
  )) {
    fail(comparisonFailure.files, normalizeAuditError(comparisonFailure.message));
  }
}

function groupLine(group) {
  console.log(`Auditing character source group: ${group}`);
}

if (wants("couple")) {
  groupLine("couple");
  for (const npc of catalog.npcs) {
    await auditSheet(
      path.join(source, "npc", `${npc.id}-idle.png`),
      { width: 96, height: 72 },
      rules.npc,
      { requireEveryFrame: true, footBaseline: rules.frame }
    );
    await auditSheet(
      path.join(source, "npc", `${npc.id}-walk.png`),
      { width: 144, height: 288 },
      rules.npc,
      { requireEveryFrame: true, footBaseline: rules.frame }
    );
  }
}

if (wants("base")) {
  groupLine("base");
  for (const selectedFamily of ["masculine", "feminine"]) {
    if (!familyMatches({ family: selectedFamily })) continue;

    await auditSheet(
      path.join(source, "base", `${selectedFamily}-idle.png`),
      { width: 96, height: 72 },
      rules.base,
      { requireEveryFrame: true, footBaseline: rules.frame }
    );
    await auditSheet(
      path.join(source, "base", `${selectedFamily}-walk.png`),
      { width: 144, height: 288 },
      rules.base,
      { requireEveryFrame: true, footBaseline: rules.frame }
    );
  }
}

if (wants("hair")) {
  groupLine("hair");
  const selectedStyles = catalog.hairStyles.filter(familyMatches);

  for (const style of selectedStyles) {
    await auditSheet(
      path.join(source, "hair", `${style.id}__back-walk.png`),
      { width: 144, height: 288 },
      rules.hair
    );
    await auditSheet(
      path.join(source, "hair", `${style.id}__front-walk.png`),
      { width: 144, height: 288 },
      rules.hair
    );
  }

  await auditDistinctStyles(
    selectedStyles.map((style) => ({
      id: style.id,
      family: style.family,
      files: [
        path.join(source, "hair", `${style.id}__back-walk.png`),
        path.join(source, "hair", `${style.id}__front-walk.png`)
      ]
    })),
    rules.hair.minimumAlphaDifferenceBetweenStyles
  );
}

if (wants("outfits")) {
  groupLine("outfits");
  const selectedOutfits = catalog.outfits.filter(familyMatches);

  for (const outfit of selectedOutfits) {
    await auditSheet(
      path.join(source, "outfits", `${outfit.id}__walk.png`),
      { width: 144, height: 288 },
      rules.outfit,
      { requireEveryFrame: true }
    );
  }

  await auditDistinctStyles(
    selectedOutfits.map((outfit) => ({
      id: outfit.id,
      family: outfit.family,
      files: [path.join(source, "outfits", `${outfit.id}__walk.png`)]
    })),
    rules.outfit.minimumAlphaDifferenceBetweenStyles
  );
}

if (wants("accessories")) {
  groupLine("accessories");
  for (const accessory of catalog.accessories) {
    await auditSheet(
      path.join(source, "accessories", `${accessory.id}__walk.png`),
      { width: 144, height: 288 },
      rules.accessory
    );
  }
}

if (failures.length === 0) {
  console.log("Character asset audit passed");
} else {
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
}

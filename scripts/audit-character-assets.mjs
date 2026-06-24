import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectFrameRuleFailures,
  collectRegionColorRuleFailures,
  collectRegionRuleFailures,
  inspectSheet
} from "./lib/characterAssetAudit.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.CHARACTER_ASSET_SOURCE_ROOT
  ? path.resolve(process.env.CHARACTER_ASSET_SOURCE_ROOT)
  : path.join(root, "character-assets/source");
const catalog = JSON.parse(
  await readFile(path.join(root, "shared/character-catalog.json"), "utf8")
);
const guestPresetCatalog = JSON.parse(
  await readFile(path.join(root, "character-assets/guest-character-presets.json"), "utf8")
);
const rules = JSON.parse(
  await readFile(path.join(root, "character-assets/quality-rules.json"), "utf8")
);
const scopes = new Set(["all", "couple", "guest-presets"]);

function parseOption(name, allowed, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  const value = argument ? argument.slice(prefix.length) : fallback;

  if (!allowed.has(value)) {
    throw new Error(`Unknown ${name}: ${value}`);
  }

  return value;
}

const scope = parseOption("scope", scopes, "all");
const failures = [];
const guestFrame = guestPresetCatalog.frame.source;
const guestIdleDimensions = guestPresetCatalog.frame.idle.sheet;
const guestWalkDimensions = guestPresetCatalog.frame.walk.sheet;
const guestPresetFootBaseline = {
  footBottomMin: 128,
  footBottomMax: 132,
  footBottomSpreadMax: 2
};

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

function sourcePath(sourceRoot, manifestPath) {
  return path.join(sourceRoot, manifestPath.replace(/^character-assets\/source\//, ""));
}

async function auditSheet(
  file,
  expectedDimensions,
  classRules,
  {
    requireEveryFrame = false,
    footBaseline = null,
    frameDimensions = rules.frame
  } = {}
) {
  try {
    const inspection = await inspectSheet(file, {
      frameWidth: frameDimensions.width,
      frameHeight: frameDimensions.height
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

    for (const ruleFailure of collectFrameRuleFailures(inspection, classRules)) {
      fail(file, ruleFailure.message);
    }

    for (const regionFailure of collectRegionRuleFailures(
      inspection,
      classRules.regionRules ?? []
    )) {
      fail(file, regionFailure.message);
    }

    for (const regionColorFailure of collectRegionColorRuleFailures(
      inspection,
      classRules.regionColorRules ?? []
    )) {
      fail(file, regionColorFailure.message);
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

function groupLine(group) {
  console.log(`Auditing character source group: ${group}`);
}

if (wants("couple")) {
  groupLine("couple");
  const npcFrame = { width: 96, height: 144 };
  const npcFootBaseline = {
    footBottomMin: 132,
    footBottomMax: 140,
    footBottomSpreadMax: 2
  };
  const npcRules = {
    ...rules.npc,
    minimumOpaquePixelsPerFrame: rules.npc.minimumOpaquePixelsPerFrame * 2,
    minimumColorTransitionsPerFrame: rules.npc.minimumColorTransitionsPerFrame + 70
  };

  for (const npc of catalog.npcs) {
    await auditSheet(
      path.join(source, "npc", `${npc.id}-idle.png`),
      { width: 192, height: 144 },
      npcRules,
      { requireEveryFrame: true, footBaseline: npcFootBaseline, frameDimensions: npcFrame }
    );
    await auditSheet(
      path.join(source, "npc", `${npc.id}-walk.png`),
      { width: 288, height: 576 },
      npcRules,
      { requireEveryFrame: true, footBaseline: npcFootBaseline, frameDimensions: npcFrame }
    );
  }
}

if (wants("guest-presets")) {
  groupLine("guest-presets");
  for (const preset of guestPresetCatalog.presets) {
    await auditSheet(
      sourcePath(source, preset.source.walk),
      guestWalkDimensions,
      rules.guestPreset,
      { requireEveryFrame: true, footBaseline: guestPresetFootBaseline, frameDimensions: guestFrame }
    );
    await auditSheet(
      sourcePath(source, preset.source.idle),
      guestIdleDimensions,
      rules.guestPreset,
      { requireEveryFrame: true, frameDimensions: guestFrame }
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

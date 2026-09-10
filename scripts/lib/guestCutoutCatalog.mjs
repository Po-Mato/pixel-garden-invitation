import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  guestCutoutPartDefinitions,
  renderEditableGuestArtwork
} from "./guestCutoutArtwork.mjs";

const directions = ["down", "left", "right", "up"];

const clone = (value) => JSON.parse(JSON.stringify(value));

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function mergeMotion(baseAnimation, template, { compensateGenericShoes = false } = {}) {
  const animation = clone(baseAnimation);
  for (const direction of directions) {
    for (let index = 0; index < 4; index += 1) {
      const garment = template.garmentMotion[direction][index];
      const accessory = template.accessoryMotion[direction][index];
      if (Object.keys(garment).length > 0) {
        animation.frames[direction][index].bones.garment = garment;
      }
      if (Object.keys(accessory).length > 0) {
        animation.frames[direction][index].bones.accessory = accessory;
      }
      if (compensateGenericShoes && direction === "down" && index === 2) {
        for (const shoe of ["shoeLeft", "shoeRight"]) {
          const current = animation.frames[direction][index].bones[shoe] ?? {};
          animation.frames[direction][index].bones[shoe] = {
            ...current,
            translateY: (current.translateY ?? 0) + 1
          };
        }
      }
    }
  }
  return animation;
}

function directionConfig(baseDirection, character, parts) {
  const drawOrder = baseDirection.drawOrder.filter((id) => id !== "accessory");
  if (character.template !== "tailored") {
    const withoutGarment = drawOrder.filter((id) => id !== "pelvis");
    const lastLegIndex = Math.max(
      withoutGarment.indexOf("shoeLeft"),
      withoutGarment.indexOf("shoeRight")
    );
    withoutGarment.splice(lastLegIndex + 1, 0, "pelvis");
    drawOrder.splice(0, drawOrder.length, ...withoutGarment);
  }
  drawOrder.push("accessory");
  const wearerSide = character.accessory.side;
  const visibility = wearerSide === "wearer-left"
    ? { down: "viewer-right", left: "near-side", right: "far-side-or-hidden", up: "hidden-or-back" }
    : { down: "viewer-left", left: "far-side-or-hidden", right: "near-side", up: "hidden-or-back" };
  return {
    ...clone(baseDirection),
    drawOrder: drawOrder.filter((partId) => parts.some((part) => part.id === partId)),
    asymmetry: {
      hairPart: character.hair.part,
      accessoryType: character.accessory.type,
      accessoryWearerSide: wearerSide,
      accessoryVisibility: visibility[baseDirection.meaning === "front"
        ? "down"
        : baseDirection.meaning === "back"
          ? "up"
          : baseDirection.meaning.includes("left") ? "left" : "right"]
    }
  };
}

function injectPilotAccessoryGroups(artwork) {
  if (artwork.includes('id="down-accessory"')) return artwork;
  const groups = directions.map((direction) => `<g id="${direction}-accessory"></g>`).join("\n");
  return artwork.replace("</defs>", `${groups}\n</defs>`);
}

export async function resolveGuestCutoutSources({ projectRoot }) {
  const rigsRoot = path.join(projectRoot, "character-assets/rigs");
  const catalogPath = path.join(rigsRoot, "guest-cutout-catalog-v1.json");
  const catalog = await readJson(catalogPath);
  const pilotRigPath = path.join(rigsRoot, "guest-03/navy-suit-v1/rig.json");
  const pilotArtworkPath = path.join(rigsRoot, "guest-03/navy-suit-v1/artwork.svg");
  const pilotRig = await readJson(pilotRigPath);
  const pilotArtwork = await readFile(pilotArtworkPath, "utf8");
  const resolved = [];

  for (const character of catalog.characters) {
    const templatePath = path.join(rigsRoot, catalog.templates[character.template]);
    const template = await readJson(templatePath);
    const parts = character.artworkMode === "approvedPilot"
      ? clone(pilotRig.parts)
      : clone(guestCutoutPartDefinitions);
    const directionsConfig = Object.fromEntries(directions.map((direction) => [
      direction,
      directionConfig(pilotRig.directions[direction], character, parts)
    ]));
    const rig = {
      version: 2,
      id: `${character.characterId}-${character.template}-cutout-v1`,
      characterId: character.characterId,
      presetId: character.presetId,
      label: character.label,
      outputName: character.presetId,
      templateId: template.id,
      skeleton: "../../common-three-head-v1/skeleton.json",
      artwork: "artwork.svg",
      appearance: "appearance.json",
      sourcePolicy: {
        kind: "editable-vector-cutout",
        authoritativeSource: "artwork.svg + rig.json + appearance.json",
        frameAiGeneration: false,
        pixelBandCopy: false,
        pixelRegionReplacement: false,
        bodyPartScaling: false,
        directionMirroring: false
      },
      parts,
      directions: directionsConfig,
      animation: mergeMotion(pilotRig.animation, template, {
        compensateGenericShoes: character.artworkMode !== "approvedPilot"
      })
    };
    const artwork = character.artworkMode === "approvedPilot"
      ? injectPilotAccessoryGroups(pilotArtwork)
      : renderEditableGuestArtwork(character, parts);
    const sourceRoot = path.join(rigsRoot, "guests-v1", character.presetId);
    await mkdir(sourceRoot, { recursive: true });
    const rigPath = path.join(sourceRoot, "rig.json");
    await Promise.all([
      writeFile(rigPath, `${JSON.stringify(rig, null, 2)}\n`),
      writeFile(path.join(sourceRoot, "appearance.json"), `${JSON.stringify(character, null, 2)}\n`),
      writeFile(path.join(sourceRoot, "artwork.svg"), artwork)
    ]);
    resolved.push({ character, rigPath, sourceRoot, templatePath });
  }
  return { catalog, catalogPath, resolved };
}

export async function loadGuestCutoutSources({ projectRoot }) {
  const rigsRoot = path.join(projectRoot, "character-assets/rigs");
  const catalogPath = path.join(rigsRoot, "guest-cutout-catalog-v1.json");
  const catalog = await readJson(catalogPath);
  const resolved = [];

  for (const catalogCharacter of catalog.characters) {
    const sourceRoot = path.join(rigsRoot, "guests-v1", catalogCharacter.presetId);
    const rigPath = path.join(sourceRoot, "rig.json");
    const appearancePath = path.join(sourceRoot, "appearance.json");
    const artworkPath = path.join(sourceRoot, "artwork.svg");
    const templatePath = path.join(rigsRoot, catalog.templates[catalogCharacter.template]);
    await Promise.all([
      access(rigPath),
      access(appearancePath),
      access(artworkPath),
      access(templatePath)
    ]);
    const character = await readJson(appearancePath);
    for (const field of ["characterId", "presetId", "template"]) {
      if (character[field] !== catalogCharacter[field]) {
        throw new Error(
          `${path.relative(projectRoot, appearancePath)} ${field} must match the cutout catalog`
        );
      }
    }
    resolved.push({ character, rigPath, sourceRoot, templatePath });
  }

  return { catalog, catalogPath, resolved };
}

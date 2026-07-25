import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_CATALOG_PATH = path.join(ROOT, "character-assets/guest-character-presets.json");
const DEFAULT_PILOT_ROOT = path.join(ROOT, "character-assets/reference/guest-3d-master-sources/v1");
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "character-assets/source/guests");

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} 옵션에 값이 필요합니다.`);
    }
    options[argument.slice(2)] = value;
    index += 1;
  }
  return options;
}

async function assertDimensions(filePath, expected, label) {
  const metadata = await sharp(filePath).metadata();
  if (metadata.width !== expected.width || metadata.height !== expected.height || !metadata.hasAlpha) {
    throw new Error(
      `${label} 규격 오류: ${metadata.width}x${metadata.height}, alpha=${Boolean(metadata.hasAlpha)}`
    );
  }
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function frameAlphaBounds(data, sheetWidth, frame, column, row) {
  let left = frame.width;
  let right = -1;
  let top = frame.height;
  let bottom = -1;

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const sheetX = column * frame.width + x;
      const sheetY = row * frame.height + y;
      if (data[(sheetY * sheetWidth + sheetX) * 4 + 3] <= 16) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  return right >= left ? { left, right, top, bottom } : null;
}

export async function applyUniformDepthGrade(filePath, frame, columns, rows) {
  const decoded = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = decoded;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const bounds = frameAlphaBounds(data, info.width, frame, column, row);
      if (!bounds) continue;
      const centerX = (bounds.left + bounds.right) / 2;
      const radiusX = Math.max(1, (bounds.right - bounds.left + 1) / 2);
      const height = Math.max(1, bounds.bottom - bounds.top + 1);

      for (let y = 0; y < frame.height; y += 1) {
        for (let x = 0; x < frame.width; x += 1) {
          const sheetX = column * frame.width + x;
          const sheetY = row * frame.height + y;
          const offset = (sheetY * info.width + sheetX) * 4;
          const alpha = data[offset + 3];
          if (alpha === 0) {
            data[offset] = 0;
            data[offset + 1] = 0;
            data[offset + 2] = 0;
            continue;
          }

          const normalizedX = Math.max(-1, Math.min(1, (x - centerX) / radiusX));
          const normalizedY = Math.max(0, Math.min(1, (y - bounds.top) / height));
          const convexity = Math.max(0, 1 - normalizedX * normalizedX);
          let light = -normalizedX * 0.105 + (0.45 - normalizedY) * 0.026 + (convexity - 0.5) * 0.038;

          const localX = column * frame.width + x;
          const localY = row * frame.height + y;
          const alphaAt = (targetX, targetY) => {
            if (
              targetX < column * frame.width ||
              targetX >= (column + 1) * frame.width ||
              targetY < row * frame.height ||
              targetY >= (row + 1) * frame.height
            ) return 0;
            return data[(targetY * info.width + targetX) * 4 + 3];
          };
          if (alpha > 96 && (alphaAt(localX - 1, localY) < 24 || alphaAt(localX, localY - 1) < 24)) {
            light += 0.036;
          }
          if (alpha > 96 && (alphaAt(localX + 1, localY) < 24 || alphaAt(localX, localY + 1) < 24)) {
            light -= 0.027;
          }

          for (let channel = 0; channel < 3; channel += 1) {
            const contrasted = ((data[offset + channel] / 255 - 0.5) * 1.065 + 0.5) * 255;
            data[offset + channel] = clampByte(contrasted * (1 + light));
          }
        }
      }
    }
  }

  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(filePath);
}

export function assertAcceptedAudit(audit, guestId) {
  const acceptance = audit?.acceptance;
  if (
    audit?.guest !== guestId ||
    acceptance?.frameCount !== 12 ||
    acceptance?.allFrameSizesMatch !== true ||
    acceptance?.greenFringePixels !== 0 ||
    acceptance?.headSizeConsistency?.passed !== true ||
    acceptance?.rearHairConsistency?.passed !== true ||
    acceptance?.rightHandAccessoryPlacement?.passed === false
  ) {
    throw new Error(`${guestId} 3D 파일이 필수 품질 감사를 통과하지 못했습니다.`);
  }
}

export async function promoteGuest3dPilots({
  catalogPath = DEFAULT_CATALOG_PATH,
  pilotRoot = DEFAULT_PILOT_ROOT,
  outputDir = DEFAULT_OUTPUT_DIR
} = {}) {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const expectedGuestIds = new Set(
    Array.from({ length: 12 }, (_, index) => `guest-${String(index + 1).padStart(2, "0")}`)
  );
  const promoted = [];

  if (catalog.presets.length !== expectedGuestIds.size) {
    throw new Error(`하객 프리셋은 12개여야 합니다. 현재 ${catalog.presets.length}개입니다.`);
  }

  await mkdir(outputDir, { recursive: true });

  for (const preset of catalog.presets) {
    const guestId = preset.reference?.walkSourceGuest;
    if (!expectedGuestIds.delete(guestId)) {
      throw new Error(`중복되거나 알 수 없는 3D 하객 매핑입니다: ${guestId}`);
    }

    const pilotDir = path.join(pilotRoot, guestId, "pilot");
    const audit = JSON.parse(await readFile(path.join(pilotDir, "audit.json"), "utf8"));
    assertAcceptedAudit(audit, guestId);

    const files = [
      {
        kind: "walk",
        source: path.join(pilotDir, `${guestId}__walk-soft-pilot.png`),
        destination: path.join(outputDir, path.basename(preset.source.walk)),
        dimensions: catalog.frame.walk.sheet
      },
      {
        kind: "idle",
        source: path.join(pilotDir, `${guestId}__idle-soft-pilot.png`),
        destination: path.join(outputDir, path.basename(preset.source.idle)),
        dimensions: catalog.frame.idle.sheet
      }
    ];

    for (const file of files) {
      await assertDimensions(file.source, file.dimensions, `${guestId} ${file.kind}`);
      await copyFile(file.source, file.destination);
      await applyUniformDepthGrade(
        file.destination,
        catalog.frame.source,
        file.kind === "walk" ? catalog.frame.walk.columns : catalog.frame.idle.columns,
        file.kind === "walk" ? catalog.frame.walk.rows.length : 1
      );
      promoted.push({ guestId, presetId: preset.id, kind: file.kind, destination: file.destination });
    }
  }

  if (expectedGuestIds.size > 0) {
    throw new Error(`누락된 3D 하객 매핑: ${[...expectedGuestIds].join(", ")}`);
  }

  return promoted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const promoted = await promoteGuest3dPilots({
    catalogPath: args.catalog ? path.resolve(args.catalog) : undefined,
    pilotRoot: args["pilot-root"] ? path.resolve(args["pilot-root"]) : undefined,
    outputDir: args["out-dir"] ? path.resolve(args["out-dir"]) : undefined
  });
  console.log(`3D 하객 시트 ${promoted.length}개를 게임 원본으로 승격했습니다.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

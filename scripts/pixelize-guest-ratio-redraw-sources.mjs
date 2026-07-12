#!/usr/bin/env node
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { authorGuestPresetSources } from "./author-guest-preset-sources.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8")
);
const walkSourceRoot =
  process.env.GUEST_RATIO_SOURCE_ROOT ??
  "character-assets/reference/guest-walk-ratio-redraw-sources/v2";
const pixelRoot = join(
  root,
  "character-assets/reference/guest-walk-ratio-redraw-pixel-sources/v2"
);
const requestedGuests = (
  process.argv.slice(2).length ? process.argv.slice(2) : ["guest-06", "guest-07", "guest-08"]
).map((guest) => {
  const match = guest.match(/^(?:guest-)?(\d{1,2})$/);
  if (!match) throw new Error(`잘못된 하객 번호: ${guest}`);
  return `guest-${match[1].padStart(2, "0")}`;
});

const selectedPresets = catalog.presets.filter((preset, index) => {
  const guest = preset.reference?.walkSourceGuest ?? `guest-${String(index + 1).padStart(2, "0")}`;
  return requestedGuests.includes(guest);
});

if (selectedPresets.length !== requestedGuests.length) {
  throw new Error(`일치하지 않는 하객 번호가 있습니다: ${requestedGuests.join(", ")}`);
}

await authorGuestPresetSources({
  catalog: { ...catalog, presets: selectedPresets },
  projectRoot: root,
  walkSourceRoot
});

const directions = catalog.frame.walk.rows;
const frame = catalog.frame.source;

for (const preset of selectedPresets) {
  const guest = preset.reference.walkSourceGuest;
  const walkFile = join(root, preset.source.walk);

  for (let row = 0; row < directions.length; row += 1) {
    const direction = directions[row];
    const rowFile = join(pixelRoot, "_sheets", guest, `${direction}-walk-cycle-pixel.png`);
    await mkdir(dirname(rowFile), { recursive: true });
    await sharp(walkFile)
      .extract({ left: 0, top: row * frame.height, width: frame.width * 3, height: frame.height })
      .png({ compressionLevel: 9 })
      .toFile(rowFile);

    for (let column = 0; column < 3; column += 1) {
      const output = join(
        pixelRoot,
        guest,
        direction,
        `step-${String(column + 1).padStart(2, "0")}-pixel.png`
      );
      await mkdir(dirname(output), { recursive: true });
      await sharp(walkFile)
        .extract({
          left: column * frame.width,
          top: row * frame.height,
          width: frame.width,
          height: frame.height
        })
        .png({ compressionLevel: 9 })
        .toFile(output);
    }
  }
}

console.log(`픽셀 보행 자산 갱신 완료: ${requestedGuests.join(", ")}`);

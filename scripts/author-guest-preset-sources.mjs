import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const presetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));
const defaultSourceRoot = join(root, "character-assets/source");
const frame = presetCatalog.frame.source;

const presetArt = {
  "feminine-long-wave-dress": {
    skin: "#f3c5a8",
    hair: "#3a241d",
    hairLight: "#5a382b",
    top: "#c87887",
    accent: "#e7a9b3",
    lower: "#b85f72",
    shoe: "#4a2c33"
  },
  "feminine-formal-hanbok": {
    skin: "#f2bea0",
    hair: "#2c201d",
    hairLight: "#4a342a",
    top: "#f0d7c0",
    accent: "#c86d83",
    lower: "#b85f80",
    shoe: "#4a2c33"
  },
  "feminine-half-up-skirt": {
    skin: "#f0bd9d",
    hair: "#4a2f24",
    hairLight: "#6b4434",
    top: "#f2dfc5",
    accent: "#8da0b2",
    lower: "#314867",
    shoe: "#252c3c"
  },
  "feminine-short-bob-suit": {
    skin: "#eab392",
    hair: "#30211d",
    hairLight: "#4c3328",
    top: "#b89d78",
    accent: "#efe0c4",
    lower: "#51483f",
    shoe: "#2f2724"
  },
  "masculine-navy-suit": {
    skin: "#e8b18f",
    hair: "#2f211c",
    hairLight: "#4c352b",
    top: "#293a55",
    accent: "#fff4dc",
    lower: "#24324b",
    shoe: "#1f1d22"
  },
  "masculine-charcoal-blazer": {
    skin: "#e3aa88",
    hair: "#2c2422",
    hairLight: "#4a3730",
    top: "#474a51",
    accent: "#b49b76",
    lower: "#2f3239",
    shoe: "#1f1d22"
  },
  "masculine-formal-hanbok": {
    skin: "#e8b18f",
    hair: "#33231f",
    hairLight: "#51372e",
    top: "#304467",
    accent: "#efe0c4",
    lower: "#6384a0",
    shoe: "#232b39"
  },
  "masculine-knit-jacket": {
    skin: "#dfaa8b",
    hair: "#2a211f",
    hairLight: "#4c3930",
    top: "#b49b76",
    accent: "#f1dec0",
    lower: "#3c424b",
    shoe: "#242529"
  }
};

function sourcePath(sourceRoot, manifestPath) {
  return join(sourceRoot, manifestPath.replace(/^character-assets\/source\//, ""));
}

function faceSvg({ skin, cheek = "#d9787c", blink = false }) {
  const eye = blink
    ? `<path d="M39 35 L44 35 M52 35 L57 35" stroke="#8b5e51" stroke-width="1.5" stroke-linecap="round"/>`
    : `<rect x="40" y="33" width="3" height="4" rx="1.5" fill="#251812"/>
       <rect x="53" y="33" width="3" height="4" rx="1.5" fill="#251812"/>
       <rect x="41" y="34" width="1" height="1" fill="#fff4dc"/>
       <rect x="54" y="34" width="1" height="1" fill="#fff4dc"/>`;

  return `
    <ellipse cx="48" cy="34" rx="17" ry="19" fill="${skin}"/>
    <rect x="41" y="50" width="14" height="12" rx="5" fill="${skin}"/>
    ${eye}
    <rect x="47" y="38" width="2" height="2" rx="1" fill="#b87562"/>
    <path d="M43 44 Q48 48 53 44" fill="none" stroke="#9b4b50" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="36" cy="41" r="2" fill="${cheek}" opacity="0.62"/>
    <circle cx="60" cy="41" r="2" fill="${cheek}" opacity="0.62"/>
    <path d="M35 35 C32 32 31 38 34 41" fill="${skin}"/>
    <path d="M61 35 C64 32 65 38 62 41" fill="${skin}"/>
  `;
}

function hairSvg(id, art) {
  const { hair, hairLight } = art;
  if (id === "feminine-long-wave-dress") {
    return `
      <path d="M30 32 C29 16 67 16 66 33 C70 49 62 67 55 74 L41 74 C34 66 26 49 30 32 Z" fill="${hair}"/>
      <path d="M34 29 C39 20 57 20 63 31 C56 28 49 27 43 29 C39 30 36 32 34 29 Z" fill="${hairLight}"/>
      <path d="M32 44 C30 54 34 65 41 72 M64 44 C66 55 62 65 55 72" fill="none" stroke="${hairLight}" stroke-width="2.5" stroke-linecap="round" opacity="0.75"/>
    `;
  }
  if (id === "feminine-formal-hanbok") {
    return `
      <ellipse cx="48" cy="22" rx="14" ry="9" fill="${hair}"/>
      <path d="M32 33 C33 19 63 19 64 34 C58 30 38 30 32 33 Z" fill="${hair}"/>
      <circle cx="59" cy="22" r="3" fill="#eac3c8"/>
    `;
  }
  if (id === "feminine-half-up-skirt") {
    return `
      <path d="M32 31 C34 18 62 17 64 32 C62 47 57 60 53 67 L43 67 C38 60 34 47 32 31 Z" fill="${hair}"/>
      <path d="M37 28 C44 20 55 22 61 30" fill="none" stroke="${hairLight}" stroke-width="4" stroke-linecap="round"/>
      <path d="M40 22 C46 27 52 27 58 22" fill="none" stroke="#d7b9a2" stroke-width="2" stroke-linecap="round"/>
    `;
  }
  if (id === "feminine-short-bob-suit") {
    return `
      <path d="M31 32 C32 18 64 18 65 33 L63 53 C58 59 38 59 33 53 Z" fill="${hair}"/>
      <path d="M37 28 C44 22 55 22 61 30" fill="none" stroke="${hairLight}" stroke-width="3" stroke-linecap="round"/>
    `;
  }
  if (id === "masculine-navy-suit") {
    return `
      <path d="M32 31 C34 18 63 18 65 31 C57 27 47 28 36 33 Z" fill="${hair}"/>
      <path d="M42 23 C49 20 57 22 63 27" fill="none" stroke="${hairLight}" stroke-width="4" stroke-linecap="round"/>
    `;
  }
  if (id === "masculine-charcoal-blazer") {
    return `
      <path d="M32 31 C34 18 62 17 65 31 C59 29 55 27 51 24 C45 28 39 30 32 31 Z" fill="${hair}"/>
      <path d="M37 26 L43 22 L49 25 L55 22 L62 27" fill="none" stroke="${hairLight}" stroke-width="3" stroke-linecap="round"/>
    `;
  }
  if (id === "masculine-formal-hanbok") {
    return `
      <path d="M31 32 C33 17 65 17 66 32 C61 29 55 28 49 28 C42 28 36 30 31 32 Z" fill="${hair}"/>
      <path d="M36 24 C44 18 56 20 63 27" fill="none" stroke="${hairLight}" stroke-width="4" stroke-linecap="round"/>
    `;
  }
  return `
    <path d="M32 31 C35 19 61 19 64 31 C58 30 54 27 50 25 C45 29 39 30 32 31 Z" fill="${hair}"/>
    <path d="M36 27 C43 21 53 21 60 28" fill="none" stroke="${hairLight}" stroke-width="3" stroke-linecap="round"/>
  `;
}

function bodySvg(id, art, { step = 1 }) {
  const shoeOffset = step === 0 ? -2 : step === 2 ? 2 : 0;
  const dress = id.startsWith("feminine") && !id.includes("suit");
  const hanbok = id.includes("hanbok");
  const suit = id.includes("suit") || id.includes("blazer") || id.includes("jacket");
  const sleeve = hanbok ? art.accent : art.top;
  const top = hanbok
    ? `<path d="M32 61 L64 61 L59 87 L37 87 Z" fill="${art.accent}"/>
       <path d="M38 62 L58 84" stroke="${art.top}" stroke-width="4" stroke-linecap="round"/>
       <path d="M57 62 L39 84" stroke="#fff4dc" stroke-width="2" stroke-linecap="round" opacity="0.65"/>`
    : suit
      ? `<path d="M33 60 L63 60 L59 92 L37 92 Z" fill="${art.top}"/>
         <path d="M39 62 L48 82 L57 62" fill="${art.accent}"/>
         <path d="M46 65 L50 65 L51 87 L45 87 Z" fill="${id.startsWith("masculine") ? "#493041" : "#304467"}" opacity="0.9"/>`
      : `<path d="M34 60 L62 60 L58 91 L38 91 Z" fill="${art.top}"/>
         <path d="M39 63 L57 63 L54 76 L42 76 Z" fill="${art.accent}" opacity="0.85"/>`;

  const lower = dress || hanbok
    ? `<path d="M36 84 L60 84 L68 126 L28 126 Z" fill="${art.lower}"/>
       <path d="M48 86 L48 126" stroke="#251812" stroke-width="1.5" opacity="0.28"/>
       <path d="M37 91 C43 96 53 96 59 91" fill="none" stroke="#fff4dc" stroke-width="1.5" opacity="0.5"/>`
    : `<path d="M37 88 L47 88 L45 ${126 + shoeOffset} L35 126 Z" fill="${art.lower}"/>
       <path d="M50 88 L60 88 L62 126 L52 ${126 - shoeOffset} Z" fill="${art.lower}"/>
       <path d="M48 88 L48 126" stroke="#171717" stroke-width="1.2" opacity="0.45"/>`;

  return `
    <path d="M34 64 C25 76 23 96 28 111" fill="none" stroke="${sleeve}" stroke-width="7" stroke-linecap="round"/>
    <path d="M62 64 C71 77 73 96 68 111" fill="none" stroke="${sleeve}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="28" cy="112" r="4" fill="${art.skin}"/>
    <circle cx="68" cy="112" r="4" fill="${art.skin}"/>
    ${top}
    ${lower}
    <rect x="34" y="126" width="12" height="5" rx="2" fill="${art.shoe}"/>
    <rect x="51" y="126" width="12" height="5" rx="2" fill="${art.shoe}"/>
  `;
}

function accessorySvg(id) {
  if (id === "feminine-long-wave-dress") {
    return `<path d="M68 86 C76 92 75 108 67 111 C61 106 61 94 68 86 Z" fill="#7b3443"/><circle cx="68" cy="88" r="2" fill="#eac3c8"/>`;
  }
  if (id === "feminine-formal-hanbok") {
    return `<circle cx="35" cy="42" r="1.7" fill="#fff4dc"/><circle cx="61" cy="42" r="1.7" fill="#fff4dc"/>`;
  }
  if (id === "feminine-half-up-skirt") {
    return `<path d="M29 84 L24 104 L33 104 Z" fill="#314867"/><path d="M27 84 C30 79 33 79 36 84" fill="none" stroke="#c6a47a" stroke-width="2"/>`;
  }
  if (id === "masculine-navy-suit") {
    return `<path d="M48 65 L52 87 L44 87 Z" fill="#7b3443"/>`;
  }
  if (id === "masculine-charcoal-blazer") {
    return `<circle cx="58" cy="72" r="2.2" fill="#e7a9b3"/><path d="M58 74 L62 78" stroke="#8b5e51" stroke-width="1"/>`;
  }
  return "";
}

function svgFrame(preset, options) {
  const art = presetArt[preset.id];
  const sideShift = options.direction === "left" ? -3 : options.direction === "right" ? 3 : 0;
  const scale = options.direction === "up" ? "scale(0.98 1)" : "scale(1)";
  const face = options.direction === "up"
    ? `<ellipse cx="48" cy="34" rx="17" ry="19" fill="${art.skin}"/>`
    : faceSvg({ ...art, blink: options.blink });

  return `
    <svg width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${sideShift} 0) ${scale}">
        ${hairSvg(preset.id, art)}
        ${face}
        ${bodySvg(preset.id, art, options)}
        ${options.direction === "up" ? "" : accessorySvg(preset.id)}
      </g>
    </svg>
  `;
}

async function renderFrame(preset, options) {
  return sharp(Buffer.from(svgFrame(preset, options))).png().toBuffer();
}

async function saveSheet(output, frames, width, height) {
  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: "#00000000" }
  })
    .composite(frames)
    .png({ compressionLevel: 9 })
    .toFile(output);
}

export async function authorGuestPresetSources({ sourceRoot = defaultSourceRoot } = {}) {
  let count = 0;
  const directions = ["down", "left", "right", "up"];

  for (const preset of presetCatalog.presets) {
    const walkComposites = [];
    for (let row = 0; row < directions.length; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        walkComposites.push({
          input: await renderFrame(preset, {
            direction: directions[row],
            step: column,
            blink: false
          }),
          left: column * frame.width,
          top: row * frame.height
        });
      }
    }
    await saveSheet(
      sourcePath(sourceRoot, preset.source.walk),
      walkComposites,
      presetCatalog.frame.walk.sheet.width,
      presetCatalog.frame.walk.sheet.height
    );
    count += 1;

    await saveSheet(
      sourcePath(sourceRoot, preset.source.idle),
      [
        {
          input: await renderFrame(preset, { direction: "down", step: 1, blink: false }),
          left: 0,
          top: 0
        },
        {
          input: await renderFrame(preset, { direction: "down", step: 1, blink: true }),
          left: frame.width,
          top: 0
        }
      ],
      presetCatalog.frame.idle.sheet.width,
      presetCatalog.frame.idle.sheet.height
    );
    count += 1;
  }

  return count;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await authorGuestPresetSources();
  console.log(`Authored ${count} finished guest preset source sheets`);
}

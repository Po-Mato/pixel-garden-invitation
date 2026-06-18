import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "shared/character-catalog.json"), "utf8"));
const sourceRoot = join(root, "character-assets/source");

const COLORS = {
  outline: "#251812",
  eyeHighlight: "#fff4dc",
  mouth: "#b75d65",
  blush: "#d47777",
  skinLight: "#ff0000",
  skinMid: "#cc0000",
  skinShade: "#990000",
  skinDeep: "#660000",
  hairLight: "#00ff00",
  hairMid: "#00cc00",
  hairShade: "#009900",
  hairDeep: "#006600",
  clothLight: "#0000ff",
  clothMid: "#0000cc",
  clothShade: "#000099",
  clothDeep: "#000066",
  accentLight: "#ffff00",
  accentShade: "#cccc00"
};

const DIRECTIONS = ["down", "left", "right", "up"];

function rgba(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255
  ];
}

class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
  }

  pixel(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [red, green, blue, alpha] = rgba(color);
    const offset = (Math.round(y) * this.width + Math.round(x)) * 4;
    this.data[offset] = red;
    this.data[offset + 1] = green;
    this.data[offset + 2] = blue;
    this.data[offset + 3] = alpha;
  }

  rect(x, y, width, height, color) {
    for (let row = Math.round(y); row < Math.round(y + height); row += 1) {
      for (let column = Math.round(x); column < Math.round(x + width); column += 1) {
        this.pixel(column, row, color);
      }
    }
  }

  ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        if ((((x - cx) ** 2) / (rx ** 2)) + (((y - cy) ** 2) / (ry ** 2)) <= 1) {
          this.pixel(x, y, color);
        }
      }
    }
  }

  line(x0, y0, x1, y1, color, thickness = 1) {
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    let x = x0;
    let y = y0;
    while (true) {
      this.rect(x, y, thickness, thickness, color);
      if (x === x1 && y === y1) break;
      const doubled = 2 * error;
      if (doubled >= dy) {
        error += dy;
        x += sx;
      }
      if (doubled <= dx) {
        error += dx;
        y += sy;
      }
    }
  }

  polygon(points, color) {
    const minY = Math.floor(Math.min(...points.map((point) => point[1])));
    const maxY = Math.ceil(Math.max(...points.map((point) => point[1])));
    for (let y = minY; y <= maxY; y += 1) {
      const intersections = [];
      for (let index = 0; index < points.length; index += 1) {
        const [x1, y1] = points[index];
        const [x2, y2] = points[(index + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let index = 0; index < intersections.length; index += 2) {
        this.rect(Math.ceil(intersections[index]), y, Math.floor(intersections[index + 1]) - Math.ceil(intersections[index]) + 1, 1, color);
      }
    }
  }
}

async function save(canvas, relative) {
  const target = join(sourceRoot, relative);
  await mkdir(dirname(target), { recursive: true });
  await sharp(canvas.data, {
    raw: { width: canvas.width, height: canvas.height, channels: 4 }
  }).png({ compressionLevel: 9 }).toFile(target);
}

function frameOrigin(directionIndex, step) {
  return { x: step * 48, y: directionIndex * 72 };
}

function drawBaseFrame(canvas, ox, oy, family, direction, step, blink = false) {
  const feminine = family === "feminine";
  const bob = step === 0 ? -1 : step === 2 ? 1 : 0;
  const headX = ox + 24;
  const headY = oy + 19 + bob;
  canvas.ellipse(headX, headY, feminine ? 10 : 11, 13, COLORS.outline);
  canvas.ellipse(headX, headY, feminine ? 9 : 10, 12, COLORS.skinMid);
  canvas.rect(headX - 7, headY - 8, 11, 4, COLORS.skinLight);
  canvas.rect(headX + 4, headY - 4, 4, 9, COLORS.skinShade);
  canvas.rect(headX - 2, headY + 10, 4, 5, COLORS.skinShade);

  if (direction === "down") {
    if (blink) {
      canvas.rect(headX - 6, headY, 4, 1, COLORS.outline);
      canvas.rect(headX + 3, headY, 4, 1, COLORS.outline);
    } else {
      canvas.rect(headX - 6, headY - 1, 3, 3, COLORS.outline);
      canvas.rect(headX + 4, headY - 1, 3, 3, COLORS.outline);
      canvas.pixel(headX - 5, headY - 1, COLORS.eyeHighlight);
      canvas.pixel(headX + 5, headY - 1, COLORS.eyeHighlight);
    }
    canvas.rect(headX - 9, headY + 4, 3, 2, COLORS.blush);
    canvas.rect(headX + 7, headY + 4, 3, 2, COLORS.blush);
    canvas.rect(headX - 2, headY + 6, 4, 2, COLORS.mouth);
  } else if (direction === "left") {
    canvas.rect(headX - 7, headY, 3, blink ? 1 : 3, COLORS.outline);
    canvas.rect(headX - 10, headY + 4, 3, 2, COLORS.blush);
    canvas.pixel(headX - 8, headY + 7, COLORS.mouth);
  } else if (direction === "right") {
    canvas.rect(headX + 5, headY, 3, blink ? 1 : 3, COLORS.outline);
    canvas.rect(headX + 8, headY + 4, 3, 2, COLORS.blush);
    canvas.pixel(headX + 8, headY + 7, COLORS.mouth);
  }

  const shoulder = feminine ? 8 : 10;
  canvas.rect(headX - shoulder, oy + 34 + bob, shoulder * 2, 20, COLORS.skinMid);
  canvas.rect(headX - shoulder + 2, oy + 34 + bob, shoulder - 1, 8, COLORS.skinLight);
  canvas.rect(headX - shoulder - 3, oy + 37 + bob, 4, 13, COLORS.skinShade);
  canvas.rect(headX + shoulder - 1, oy + 37 + bob, 4, 13, COLORS.skinShade);
  canvas.rect(headX - shoulder - 3, oy + 48 + bob, 4, 5, COLORS.skinLight);
  canvas.rect(headX + shoulder - 1, oy + 48 + bob, 4, 5, COLORS.skinLight);

  const leftLegShift = step === 0 ? -2 : step === 2 ? 2 : 0;
  const rightLegShift = -leftLegShift;
  canvas.rect(headX - 7 + leftLegShift, oy + 53, 6, 14, COLORS.skinShade);
  canvas.rect(headX + 1 + rightLegShift, oy + 53, 6, 14, COLORS.skinShade);
  canvas.rect(headX - 8 + leftLegShift, oy + 66, 7, 3, COLORS.outline);
  canvas.rect(headX + 1 + rightLegShift, oy + 66, 7, 3, COLORS.outline);
}

async function authorBaseSheets() {
  for (const family of ["masculine", "feminine"]) {
    const walk = new PixelCanvas(144, 288);
    DIRECTIONS.forEach((direction, directionIndex) => {
      for (let step = 0; step < 3; step += 1) {
        const origin = frameOrigin(directionIndex, step);
        drawBaseFrame(walk, origin.x, origin.y, family, direction, step);
      }
    });
    await save(walk, `base/${family}-walk.png`);

    const idle = new PixelCanvas(96, 72);
    drawBaseFrame(idle, 0, 0, family, "down", 1, false);
    drawBaseFrame(idle, 48, 0, family, "down", 1, true);
    await save(idle, `base/${family}-idle.png`);
  }
}

function hairTraits(id) {
  return {
    long: /long|ponytail|medium|wave|curl/.test(id),
    bob: /bob/.test(id),
    bun: /bun/.test(id),
    ponytail: /ponytail/.test(id),
    curl: /curl|wavy/.test(id),
    swept: /swept|side-part|comma/.test(id),
    fringe: /fringe|crop/.test(id),
    braided: /braided/.test(id),
    halfUp: /half-up/.test(id)
  };
}

function drawHairBack(canvas, ox, oy, id, direction, step) {
  const traits = hairTraits(id);
  if (!traits.long && !traits.bob && !traits.bun && !traits.ponytail) return;
  const bob = step === 0 ? -1 : step === 2 ? 1 : 0;
  const x = ox + 24;
  const y = oy + 18 + bob;
  if (traits.long) {
    const width = traits.curl ? 23 : 19;
    const length = traits.braided ? 40 : traits.ponytail ? 34 : 39;
    canvas.ellipse(x, y + 13, Math.floor(width / 2) + 1, 22, COLORS.hairDeep);
    canvas.rect(x - Math.floor(width / 2), y + 5, width, length, COLORS.hairMid);
    canvas.rect(x - Math.floor(width / 2) + 2, y + 7, 4, length - 5, COLORS.hairLight);
    canvas.rect(x + Math.floor(width / 2) - 4, y + 9, 3, length - 7, COLORS.hairShade);
    if (traits.curl) {
      for (let row = 0; row < 4; row += 1) {
        canvas.rect(x - 13 + (row % 2) * 3, y + 18 + row * 6, 5, 4, COLORS.hairShade);
        canvas.rect(x + 8 - (row % 2) * 3, y + 20 + row * 6, 5, 4, COLORS.hairLight);
      }
    }
  }
  if (traits.bob) {
    canvas.ellipse(x, y + 7, 13, 18, COLORS.hairDeep);
    canvas.rect(x - 12, y + 5, 24, traits.long ? 26 : 20, COLORS.hairMid);
    canvas.rect(x - 10, y + 7, 4, 15, COLORS.hairLight);
  }
  if (traits.bun) {
    const side = direction === "left" ? -6 : direction === "right" ? 6 : 0;
    canvas.ellipse(x + side, oy + 7 + bob, 7, 6, COLORS.hairDeep);
    canvas.ellipse(x + side, oy + 7 + bob, 5, 4, COLORS.hairMid);
  }
  if (traits.ponytail) {
    const side = direction === "left" ? 8 : direction === "right" ? -8 : 0;
    canvas.rect(x + side - 3, y + 15, 7, traits.braided ? 28 : 22, COLORS.hairDeep);
    canvas.rect(x + side - 1, y + 16, 3, traits.braided ? 26 : 20, COLORS.hairLight);
  }
  if (traits.halfUp) {
    canvas.rect(x - 5, y + 7, 10, 4, COLORS.hairDeep);
  }
}

function drawHairFront(canvas, ox, oy, id, direction, step) {
  const traits = hairTraits(id);
  const bob = step === 0 ? -1 : step === 2 ? 1 : 0;
  const x = ox + 24;
  const y = oy + 9 + bob;
  canvas.ellipse(x, y + 7, traits.curl ? 13 : 12, 10, COLORS.hairDeep);
  canvas.ellipse(x, y + 6, traits.curl ? 12 : 11, 9, COLORS.hairMid);
  canvas.rect(x - 8, y + 1, 7, 4, COLORS.hairLight);
  canvas.rect(x + 2, y + 3, 7, 3, COLORS.hairShade);

  if (direction !== "up") {
    if (traits.fringe) {
      canvas.rect(x - 10, y + 8, 20, 5, COLORS.hairMid);
      canvas.rect(x - 8, y + 12, 4, 4, COLORS.hairShade);
      canvas.rect(x + 2, y + 12, 6, 3, COLORS.hairLight);
    } else if (traits.swept) {
      canvas.line(x - 9, y + 10, x + 7, y + 6, COLORS.hairLight, 3);
      canvas.rect(x + 4, y + 7, 6, 8, COLORS.hairShade);
      if (/comma/.test(id)) canvas.rect(x + 1, y + 11, 4, 6, COLORS.hairDeep);
    } else {
      canvas.rect(x - 10, y + 8, 5, 9, COLORS.hairShade);
      canvas.rect(x + 5, y + 8, 5, 9, COLORS.hairMid);
      canvas.rect(x - 5, y + 8, 4, 5, COLORS.hairLight);
    }
  }

  if (traits.curl) {
    canvas.rect(x - 13, y + 7, 5, 6, COLORS.hairShade);
    canvas.rect(x + 9, y + 7, 5, 6, COLORS.hairLight);
  }
}

async function authorHairSheets() {
  for (const hair of catalog.hairStyles) {
    const back = new PixelCanvas(144, 288);
    const front = new PixelCanvas(144, 288);
    DIRECTIONS.forEach((direction, directionIndex) => {
      for (let step = 0; step < 3; step += 1) {
        const origin = frameOrigin(directionIndex, step);
        drawHairBack(back, origin.x, origin.y, hair.id, direction, step);
        drawHairFront(front, origin.x, origin.y, hair.id, direction, step);
      }
    });
    await save(back, `hair/${hair.id}__back-walk.png`);
    await save(front, `hair/${hair.id}__front-walk.png`);
  }
}

function drawSuit(canvas, ox, oy, id, step) {
  const x = ox + 24;
  const bob = step === 0 ? -1 : step === 2 ? 1 : 0;
  const slim = /slim/.test(id);
  const knit = /knit/.test(id);
  const blazer = /blazer/.test(id);
  const shoulder = slim ? 10 : 12;
  canvas.polygon([[x - shoulder, oy + 34 + bob], [x + shoulder, oy + 34 + bob], [x + 9, oy + 57], [x - 9, oy + 57]], COLORS.outline);
  canvas.polygon([[x - shoulder + 1, oy + 35 + bob], [x + shoulder - 1, oy + 35 + bob], [x + 8, oy + 56], [x - 8, oy + 56]], COLORS.clothMid);
  canvas.rect(x - shoulder + 2, oy + 38 + bob, 4, 16, COLORS.clothLight);
  canvas.rect(x + shoulder - 5, oy + 39 + bob, 4, 15, COLORS.clothShade);
  canvas.polygon([[x - 7, oy + 35 + bob], [x, oy + 44 + bob], [x - 2, oy + 49 + bob], [x - 9, oy + 38 + bob]], COLORS.clothShade);
  canvas.polygon([[x + 7, oy + 35 + bob], [x, oy + 44 + bob], [x + 2, oy + 49 + bob], [x + 9, oy + 38 + bob]], COLORS.clothDeep);
  canvas.rect(x - 3, oy + 35 + bob, 6, 10, COLORS.accentLight);
  canvas.rect(x - 1, oy + 39 + bob, 2, 10, knit ? COLORS.clothDeep : COLORS.accentShade);
  if (blazer) canvas.rect(x - 8, oy + 49, 16, 4, COLORS.accentShade);
  canvas.rect(x - 9, oy + 56, 8, 12, COLORS.clothDeep);
  canvas.rect(x + 1, oy + 56, 8, 12, COLORS.clothShade);
}

function drawDress(canvas, ox, oy, id, step) {
  const x = ox + 24;
  const bob = step === 0 ? -1 : step === 2 ? 1 : 0;
  const long = /long-dress/.test(id);
  const blouse = /blouse/.test(id);
  const jacket = /jacket/.test(id);
  canvas.polygon([[x - 9, oy + 34 + bob], [x + 9, oy + 34 + bob], [x + 7, oy + 48], [x - 7, oy + 48]], COLORS.outline);
  canvas.polygon([[x - 8, oy + 35 + bob], [x + 8, oy + 35 + bob], [x + 6, oy + 48], [x - 6, oy + 48]], blouse ? COLORS.accentLight : COLORS.clothMid);
  canvas.rect(x - 7, oy + 37 + bob, 3, 10, blouse ? COLORS.accentShade : COLORS.clothLight);
  canvas.rect(x + 4, oy + 38 + bob, 3, 9, COLORS.clothShade);
  canvas.rect(x - 7, oy + 47, 14, 3, COLORS.clothDeep);
  if (jacket) {
    canvas.polygon([[x - 10, oy + 34], [x - 1, oy + 44], [x - 5, oy + 51], [x - 11, oy + 39]], COLORS.clothShade);
    canvas.polygon([[x + 10, oy + 34], [x + 1, oy + 44], [x + 5, oy + 51], [x + 11, oy + 39]], COLORS.clothDeep);
    canvas.rect(x - 8, oy + 50, 7, 18, COLORS.clothDeep);
    canvas.rect(x + 1, oy + 50, 7, 18, COLORS.clothShade);
  } else {
    const hem = long ? 68 : 62;
    canvas.polygon([[x - 7, oy + 49], [x + 7, oy + 49], [x + (long ? 13 : 11), oy + hem], [x - (long ? 13 : 11), oy + hem]], blouse ? COLORS.clothMid : COLORS.clothMid);
    canvas.polygon([[x - 5, oy + 50], [x, oy + 50], [x - 2, oy + hem - 2], [x - 8, oy + hem - 2]], COLORS.clothLight);
    canvas.polygon([[x + 2, oy + 50], [x + 6, oy + 50], [x + 10, oy + hem - 2], [x + 4, oy + hem - 2]], COLORS.clothShade);
  }
}

function drawHanbok(canvas, ox, oy, family, step) {
  const x = ox + 24;
  const bob = step === 0 ? -1 : step === 2 ? 1 : 0;
  canvas.polygon([[x - 11, oy + 34 + bob], [x + 11, oy + 34 + bob], [x + 9, oy + 50], [x - 9, oy + 50]], COLORS.outline);
  canvas.polygon([[x - 10, oy + 35 + bob], [x + 10, oy + 35 + bob], [x + 8, oy + 49], [x - 8, oy + 49]], COLORS.accentLight);
  canvas.rect(x - 8, oy + 38, 4, 10, COLORS.accentShade);
  canvas.line(x - 5, oy + 36, x + 5, oy + 47, COLORS.clothShade, 2);
  canvas.rect(x - 2, oy + 46, 4, 8, COLORS.clothDeep);
  if (family === "feminine") {
    canvas.polygon([[x - 8, oy + 49], [x + 8, oy + 49], [x + 15, oy + 68], [x - 15, oy + 68]], COLORS.clothMid);
    canvas.polygon([[x - 6, oy + 50], [x, oy + 50], [x - 2, oy + 67], [x - 11, oy + 67]], COLORS.clothLight);
    canvas.polygon([[x + 3, oy + 50], [x + 7, oy + 50], [x + 13, oy + 67], [x + 5, oy + 67]], COLORS.clothShade);
  } else {
    canvas.rect(x - 10, oy + 49, 9, 19, COLORS.clothMid);
    canvas.rect(x + 1, oy + 49, 9, 19, COLORS.clothShade);
    canvas.rect(x - 8, oy + 52, 4, 14, COLORS.clothLight);
  }
}

async function authorOutfitSheets() {
  for (const outfit of catalog.outfits) {
    const sheet = new PixelCanvas(144, 288);
    DIRECTIONS.forEach((_direction, directionIndex) => {
      for (let step = 0; step < 3; step += 1) {
        const { x, y } = frameOrigin(directionIndex, step);
        if (/hanbok/.test(outfit.id)) {
          drawHanbok(sheet, x, y, outfit.family, step);
        } else if (outfit.family === "masculine") {
          drawSuit(sheet, x, y, outfit.id, step);
        } else {
          drawDress(sheet, x, y, outfit.id, step);
        }
      }
    });
    await save(sheet, `outfits/${outfit.id}__walk.png`);
  }
}

function drawAccessory(canvas, ox, oy, id, direction, step) {
  const x = ox + 24;
  const bob = step === 0 ? -1 : step === 2 ? 1 : 0;
  if (id === "glasses-round-gold" && direction !== "up") {
    canvas.ellipse(x - 5, oy + 19 + bob, 4, 3, "#c99a3d");
    canvas.ellipse(x + 5, oy + 19 + bob, 4, 3, "#c99a3d");
    canvas.rect(x - 1, oy + 19 + bob, 3, 1, "#c99a3d");
  } else if (id === "glasses-square-black" && direction !== "up") {
    canvas.rect(x - 9, oy + 16 + bob, 8, 7, "#211d1d");
    canvas.rect(x - 7, oy + 18 + bob, 4, 3, "#d7e6e8");
    canvas.rect(x + 1, oy + 16 + bob, 8, 7, "#211d1d");
    canvas.rect(x + 3, oy + 18 + bob, 4, 3, "#d7e6e8");
  } else if (id === "earrings-pearl" && direction !== "up") {
    canvas.rect(x - 12, oy + 24 + bob, 3, 3, "#f6ead7");
    canvas.rect(x + 10, oy + 24 + bob, 3, 3, "#f6ead7");
  } else if (id === "earrings-drop" && direction !== "up") {
    canvas.rect(x - 12, oy + 23 + bob, 2, 6, "#d7b55b");
    canvas.rect(x + 11, oy + 23 + bob, 2, 6, "#d7b55b");
    canvas.pixel(x - 11, oy + 29 + bob, "#8ca9b8");
    canvas.pixel(x + 12, oy + 29 + bob, "#8ca9b8");
  } else if (id === "necklace-simple" && direction === "down") {
    canvas.line(x - 5, oy + 35 + bob, x, oy + 40 + bob, "#d7b55b");
    canvas.line(x, oy + 40 + bob, x + 5, oy + 35 + bob, "#d7b55b");
    canvas.rect(x - 1, oy + 40 + bob, 3, 3, "#f0ddd0");
  } else if (id === "tie-silk" && direction !== "up") {
    canvas.polygon([[x - 2, oy + 38], [x + 2, oy + 38], [x + 3, oy + 51], [x, oy + 55], [x - 3, oy + 51]], "#6f3147");
  } else if (id === "bow-tie-velvet" && direction !== "up") {
    canvas.polygon([[x, oy + 40], [x - 7, oy + 36], [x - 7, oy + 44]], "#3e2330");
    canvas.polygon([[x, oy + 40], [x + 7, oy + 36], [x + 7, oy + 44]], "#3e2330");
    canvas.rect(x - 2, oy + 38, 4, 5, "#765066");
  } else if (id === "brooch-floral" && direction === "down") {
    canvas.rect(x + 6, oy + 39, 5, 5, "#b75d65");
    canvas.pixel(x + 8, oy + 38, "#f1d7a7");
    canvas.pixel(x + 8, oy + 44, "#7b9b68");
  } else if (id === "handbag-formal") {
    const side = direction === "left" ? -12 : 11;
    canvas.rect(x + side, oy + 48, 9, 12, "#6f3e48");
    canvas.line(x + side + 2, oy + 48, x + side + 7, oy + 44, "#c69a55");
  } else if (id === "shoulder-bag-structured") {
    const side = direction === "right" ? -14 : 7;
    canvas.line(x + side, oy + 33, x + side + 8, oy + 54, "#6e4b37", 2);
    canvas.rect(x + side + 3, oy + 50, 10, 11, "#8f6041");
  }
}

async function authorAccessorySheets() {
  for (const accessory of catalog.accessories) {
    const sheet = new PixelCanvas(144, 288);
    DIRECTIONS.forEach((direction, directionIndex) => {
      for (let step = 0; step < 3; step += 1) {
        const { x, y } = frameOrigin(directionIndex, step);
        drawAccessory(sheet, x, y, accessory.id, direction, step);
      }
    });
    await save(sheet, `accessories/${accessory.id}__walk.png`);
  }
}

function drawNpc(canvas, ox, id, blink) {
  const isBride = id === "bride";
  const skin = { light: "#f6c5a4", mid: "#dfa080", shade: "#b86d57" };
  const x = ox + 24;
  canvas.ellipse(x, 19, 11, 13, "#251812");
  canvas.ellipse(x, 19, 10, 12, skin.mid);
  canvas.rect(x - 7, 11, 11, 4, skin.light);
  if (blink) {
    canvas.rect(x - 6, 19, 4, 1, "#251812");
    canvas.rect(x + 3, 19, 4, 1, "#251812");
  } else {
    canvas.rect(x - 6, 18, 3, 3, "#251812");
    canvas.rect(x + 4, 18, 3, 3, "#251812");
    canvas.pixel(x - 5, 18, "#fff4dc");
    canvas.pixel(x + 5, 18, "#fff4dc");
  }
  canvas.rect(x - 9, 24, 3, 2, "#d47777");
  canvas.rect(x + 7, 24, 3, 2, "#d47777");
  canvas.rect(x - 2, 26, 4, 2, "#b75d65");

  if (isBride) {
    canvas.ellipse(x, 11, 13, 9, "#211512");
    canvas.rect(x - 12, 12, 5, 36, "#38251f");
    canvas.rect(x + 8, 12, 5, 36, "#38251f");
    canvas.rect(x - 10, 13, 3, 30, "#78503b");
    canvas.rect(x + 8, 15, 3, 28, "#57372b");
    canvas.rect(x + 6, 5, 5, 4, "#f3e7d2");
    canvas.pixel(x + 8, 4, "#d8c8a8");
    canvas.polygon([[x - 10, 34], [x + 10, 34], [x + 17, 68], [x - 17, 68]], "#f4ead8");
    canvas.polygon([[x - 8, 35], [x - 1, 35], [x - 4, 66], [x - 14, 66]], "#fff8e8");
    canvas.polygon([[x + 2, 35], [x + 8, 35], [x + 14, 66], [x + 4, 66]], "#d9cdbb");
    canvas.rect(x - 9, 43, 18, 2, "#cdbd98");
    for (let row = 0; row < 4; row += 1) {
      canvas.pixel(x - 8 + row * 5, 50 + row * 3, "#fff8e8");
      canvas.pixel(x + 7 - row * 4, 54 + row * 2, "#cdbd98");
    }
    canvas.ellipse(x + 13, 47, 7, 6, "#5f8054");
    canvas.rect(x + 9, 43, 3, 5, "#f2d7db");
    canvas.rect(x + 14, 42, 3, 5, "#fff4dc");
  } else {
    canvas.ellipse(x, 9, 11, 8, "#211512");
    canvas.rect(x - 9, 8, 8, 4, "#78503b");
    canvas.rect(x + 2, 9, 7, 4, "#38251f");
    canvas.polygon([[x - 12, 34], [x + 12, 34], [x + 9, 57], [x - 9, 57]], "#16171a");
    canvas.rect(x - 10, 37, 4, 18, "#303238");
    canvas.rect(x + 6, 37, 4, 18, "#08090a");
    canvas.polygon([[x - 8, 35], [x, 44], [x - 3, 48], [x - 10, 38]], "#474a51");
    canvas.polygon([[x + 8, 35], [x, 44], [x + 3, 48], [x + 10, 38]], "#0b0c0e");
    canvas.rect(x - 3, 35, 6, 13, "#fff8e8");
    canvas.rect(x - 6, 38, 5, 5, "#211512");
    canvas.rect(x + 1, 38, 5, 5, "#211512");
    canvas.rect(x - 8, 56, 7, 13, "#101114");
    canvas.rect(x + 1, 56, 7, 13, "#24262a");
    canvas.rect(x + 8, 37, 4, 4, "#fff4dc");
    canvas.pixel(x + 11, 38, "#d7b55b");
    canvas.pixel(x - 11, 51, "#d7b55b");
  }
}

async function authorNpcSheets() {
  for (const id of ["groom", "bride"]) {
    const sheet = new PixelCanvas(96, 72);
    drawNpc(sheet, 0, id, false);
    drawNpc(sheet, 48, id, true);
    await save(sheet, `npc/${id}-idle.png`);
  }
}

await authorBaseSheets();
await authorHairSheets();
await authorOutfitSheets();
await authorAccessorySheets();
await authorNpcSheets();

console.log("Authored complete marker-color character source catalog");

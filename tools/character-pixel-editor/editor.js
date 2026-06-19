import {
  applyPixel,
  clonePixels,
  frameOffset,
  mirrorFrameHorizontally
} from "./editor-core.mjs";

const FRAME_WIDTH = 48;
const FRAME_HEIGHT = 72;
const ZOOM = 16;

const palettes = {
  base: ["#251812", "#fff4dc", "#b75d65", "#d47777", "#ff0000", "#cc0000", "#990000", "#660000"],
  hair: ["#251812", "#00ff00", "#00cc00", "#009900", "#006600"],
  outfit: ["#251812", "#0000ff", "#0000cc", "#000099", "#000066", "#ffff00", "#cccc00"],
  npc: [
    "#251812", "#fff4dc", "#f7d7bd", "#eeb493", "#c67b65", "#6f3f32",
    "#171516", "#2c292c", "#454047", "#68606a", "#f5eee3", "#d9cabb",
    "#9f6d42", "#f0d8ad", "#9d4f57", "#d9878b", "#6d8b58", "#f6d9cc"
  ],
  accessory: [
    "#251812", "#fff4dc", "#f2d7a6", "#c89c58", "#9d4f57", "#d9878b",
    "#6d8b58", "#456e5e", "#32353b", "#6b7078"
  ]
};

const fileInput = document.querySelector("#source-file");
const assetClass = document.querySelector("#asset-class");
const frameColumn = document.querySelector("#frame-column");
const frameRow = document.querySelector("#frame-row");
const canvas = document.querySelector("#editor-canvas");
const actual = document.querySelector("#actual-size");
const context = canvas.getContext("2d", { willReadFrequently: true });
const actualContext = actual.getContext("2d");
const history = [];
const future = [];
let fileName = "character.png";
let pixels = null;
let width = 0;
let height = 0;
let selectedColor = palettes.npc[0];
let erasing = false;
let painting = false;
let strokeStarted = false;

function selectedFrame() {
  const origin = frameOffset(
    Number(frameColumn.value),
    Number(frameRow.value),
    FRAME_WIDTH,
    FRAME_HEIGHT
  );
  return { ...origin, width: FRAME_WIDTH, height: FRAME_HEIGHT };
}

function renderPalette() {
  const root = document.querySelector("#palette");
  root.replaceChildren(...palettes[assetClass.value].map((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.title = color;
    button.style.background = color;
    button.addEventListener("click", () => {
      selectedColor = color;
      erasing = false;
    });
    return button;
  }));
}

function hexToRgba(hex) {
  const value = hex.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255
  ];
}

function redraw() {
  if (!pixels) return;
  const image = new ImageData(clonePixels(pixels), width, height);
  const frame = selectedFrame();
  const scratch = new OffscreenCanvas(width, height);
  scratch.getContext("2d").putImageData(image, 0, 0);

  canvas.width = FRAME_WIDTH * ZOOM;
  canvas.height = FRAME_HEIGHT * ZOOM;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    scratch,
    frame.x, frame.y, frame.width, frame.height,
    0, 0, canvas.width, canvas.height
  );

  actualContext.imageSmoothingEnabled = false;
  actualContext.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  actualContext.drawImage(
    scratch,
    frame.x, frame.y, frame.width, frame.height,
    0, 0, FRAME_WIDTH, FRAME_HEIGHT
  );

  if (document.querySelector("#show-guides").checked) {
    context.strokeStyle = "rgba(255,0,255,.8)";
    context.lineWidth = 1;
    for (const x of [24]) context.strokeRect(x * ZOOM, 0, 1, canvas.height);
    for (const y of [14, 18, 32, 48, 56, 68]) {
      context.strokeRect(0, y * ZOOM, canvas.width, 1);
    }
  }
}

function paint(event) {
  if (!pixels) return;
  const bounds = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - bounds.left) / ZOOM);
  const y = Math.floor((event.clientY - bounds.top) / ZOOM);
  if (x < 0 || y < 0 || x >= FRAME_WIDTH || y >= FRAME_HEIGHT) return;
  const frame = selectedFrame();
  if (!strokeStarted) {
    history.push(clonePixels(pixels));
    future.length = 0;
    strokeStarted = true;
  }
  applyPixel(
    pixels,
    width,
    frame.x + x,
    frame.y + y,
    erasing ? [0, 0, 0, 0] : hexToRgba(selectedColor)
  );
  redraw();
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  fileName = file.name;
  const bitmap = await createImageBitmap(file);
  width = bitmap.width;
  height = bitmap.height;
  const scratch = new OffscreenCanvas(width, height);
  const scratchContext = scratch.getContext("2d", { willReadFrequently: true });
  scratchContext.drawImage(bitmap, 0, 0);
  pixels = scratchContext.getImageData(0, 0, width, height).data;
  history.length = 0;
  future.length = 0;
  redraw();
});

canvas.addEventListener("pointerdown", (event) => {
  painting = true;
  strokeStarted = false;
  canvas.setPointerCapture(event.pointerId);
  paint(event);
});
canvas.addEventListener("pointermove", (event) => {
  if (painting) paint(event);
});
canvas.addEventListener("pointerup", () => {
  painting = false;
  strokeStarted = false;
});
canvas.addEventListener("pointercancel", () => {
  painting = false;
  strokeStarted = false;
});
frameColumn.addEventListener("change", redraw);
frameRow.addEventListener("change", redraw);
assetClass.addEventListener("change", renderPalette);
document.querySelector("#show-guides").addEventListener("change", redraw);
document.querySelector("#show-reference").addEventListener("change", (event) => {
  document.querySelector("#reference").hidden = !event.currentTarget.checked;
});
document.querySelector("#pencil").addEventListener("click", () => { erasing = false; });
document.querySelector("#eraser").addEventListener("click", () => { erasing = true; });
document.querySelector("#undo").addEventListener("click", () => {
  if (!history.length || !pixels) return;
  future.push(clonePixels(pixels));
  pixels = history.pop();
  redraw();
});
document.querySelector("#redo").addEventListener("click", () => {
  if (!future.length || !pixels) return;
  history.push(clonePixels(pixels));
  pixels = future.pop();
  redraw();
});
document.querySelector("#mirror").addEventListener("click", () => {
  if (!pixels) return;
  history.push(clonePixels(pixels));
  mirrorFrameHorizontally(pixels, width, height, selectedFrame());
  redraw();
});
document.querySelector("#export").addEventListener("click", async () => {
  if (!pixels) return;
  const output = new OffscreenCanvas(width, height);
  output.getContext("2d").putImageData(new ImageData(clonePixels(pixels), width, height), 0, 0);
  const blob = await output.convertToBlob({ type: "image/png" });
  if ("showSaveFilePicker" in window) {
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: "PNG image", accept: { "image/png": [".png"] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  const link = document.createElement("a");
  link.download = fileName;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
});

renderPalette();

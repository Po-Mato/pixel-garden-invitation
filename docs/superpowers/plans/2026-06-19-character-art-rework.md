# Character Art Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every degraded procedural character asset with hand-authored pixel masters faithful to the recovered bride and groom reference while preserving the existing `48x72` renderer, catalog, customization, and realtime behavior.

**Architecture:** Keep the current layered runtime and deterministic palette expansion. Add a local pixel-editing utility, reference integrity checks, source-art quality audits, and richer contact sheets; then replace NPC, base, hair, outfit, and accessory source PNGs in gated groups. Code may validate, recolor, compose, and display art, but no production code may draw character geometry.

**Tech Stack:** Node.js 20, pnpm, Sharp, vanilla browser Canvas for the local authoring utility, React/Vite, Vitest, Cloudflare Worker tests, Playwright-compatible browser verification.

---

## Scope And File Map

### New files

- `character-assets/reference/approved-couple.png` — committed copy of the recovered approved concept.
- `character-assets/reference/approved-couple.json` — source session, dimensions, checksum, and visual requirements.
- `character-assets/quality-rules.json` — explicit source-art audit thresholds.
- `scripts/referenceAsset.test.mjs` — verifies the committed reference.
- `scripts/lib/characterAssetAudit.mjs` — reads source pixels and computes frame metrics.
- `scripts/characterAssetAudit.test.mjs` — unit tests for quality metrics.
- `scripts/audit-character-assets.mjs` — catalog-aware source audit CLI.
- `tools/character-pixel-editor/index.html` — local hand-authoring UI.
- `tools/character-pixel-editor/editor.css` — editor layout and nearest-neighbor presentation.
- `tools/character-pixel-editor/editor-core.mjs` — pixel, undo, mirror, and frame operations.
- `tools/character-pixel-editor/editor-core.test.mjs` — editor core tests.
- `tools/character-pixel-editor/editor.js` — browser file import, drawing, palette, and PNG export.
- `scripts/serve-character-editor.mjs` — localhost-only static server for the editor.
- `character-assets/source/npc/groom-walk.png` — complete groom directional walk master.
- `character-assets/source/npc/bride-walk.png` — complete bride directional walk master.

### Modified files

- `package.json` — add editor, audit, and contact-sheet commands; later include audit in the required test pipeline.
- `scripts/generate-character-assets.mjs` — copy NPC walk sheets in addition to idle sheets.
- `scripts/characterAssetGenerator.test.mjs` — cover NPC source contracts and fixed-color preservation.
- `scripts/render-character-contact-sheet.mjs` — add couple-only and full-catalog review modes with all directions and actual-size previews.
- `character-assets/source/base/*.png` — replace four body source sheets.
- `character-assets/source/hair/*.png` — replace thirty-two hair source sheets.
- `character-assets/source/outfits/*.png` — replace ten outfit source sheets.
- `character-assets/source/accessories/*.png` — replace ten accessory source sheets.
- `README.md` — document hand-authoring, audit, contact-sheet, and editor commands.

### Deleted file

- `scripts/author-character-source-assets.mjs` — remove the procedural geometry generator after all replacements pass.

### Runtime files intentionally unchanged

- `shared/character-catalog.json`.
- `shared/src/characterCatalog.ts`.
- `client/src/character/assets.ts`.
- `client/src/components/CharacterSprite.tsx`.
- `client/src/components/CharacterCustomizer.tsx`.
- `client/src/components/WeddingNpc.tsx`.
- Realtime protocol and Worker state.

Runtime changes are allowed only if verification discovers an actual compatibility defect.

---

## Manual Art Protocol

Every manual PNG task in this plan uses the local editor added in Task 2.

1. Run `pnpm characters:editor`.
2. Open `http://127.0.0.1:41731`.
3. Load the exact source PNG named by the task.
4. Select a frame and edit at 16x or 24x nearest-neighbor zoom.
5. Keep the foot baseline, center line, head band, shoulder band, hand band, and maximum bounds overlays enabled.
6. Use only the palette shown by the editor for that asset class.
7. Export over the same source PNG path.
8. Run `pnpm characters:generate`.
9. Run the focused audit command named by the task.
10. Render the named contact sheet and inspect both enlarged and actual-size rows.

For each walk sheet:

- Row 0: down.
- Row 1: left.
- Row 2: right.
- Row 3: up.
- Column 0: left foot forward.
- Column 1: neutral passing pose.
- Column 2: right foot forward.

Left and right may begin from a mirrored frame, but hair parts, boutonniere, bouquet, bags, brooches, and asymmetrical clothing must be corrected manually.

---

### Task 1: Preserve And Verify The Approved Reference

**Files:**
- Create: `character-assets/reference/approved-couple.png`
- Create: `character-assets/reference/approved-couple.json`
- Create: `scripts/referenceAsset.test.mjs`
- Modify: `package.json:11-15`

- [ ] **Step 1: Copy the recovered reference into the repository**

Run:

```bash
mkdir -p character-assets/reference
cp '/Users/sjlee/Documents/New project 5/.superpowers/brainstorm/69276-1781819877/content/recovered-originals/selected-bride-groom-reference.png' \
  character-assets/reference/approved-couple.png
```

Expected: `character-assets/reference/approved-couple.png` exists and is `1536x1024`.

- [ ] **Step 2: Add immutable reference metadata**

Create `character-assets/reference/approved-couple.json`:

```json
{
  "sourceSessionId": "019eabf9-3872-7d40-9d46-157edc38abc5",
  "width": 1536,
  "height": 1024,
  "sha256": "2b15858e5e16a7210181b79cbf94aa1041df3bc5cb255a76f41a36c1d553458a",
  "artDirection": "ornate romantic fashion pixel art",
  "proportion": "A2 balanced compact",
  "face": "F1 clear and refined",
  "groom": [
    "black fitted tuxedo",
    "satin lapels",
    "white boutonniere",
    "layered dark hair"
  ],
  "bride": [
    "waist-length dark-brown waves",
    "ivory lace gown",
    "pearl and floral ornament",
    "pastel bouquet"
  ]
}
```

- [ ] **Step 3: Write the failing reference integrity test**

Create `scripts/referenceAsset.test.mjs`:

```js
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

const imagePath = new URL("../character-assets/reference/approved-couple.png", import.meta.url);
const metadataPath = new URL("../character-assets/reference/approved-couple.json", import.meta.url);

test("approved couple reference keeps its recovered bytes and dimensions", async () => {
  const [image, metadataSource] = await Promise.all([
    readFile(imagePath),
    readFile(metadataPath, "utf8")
  ]);
  const metadata = JSON.parse(metadataSource);
  const imageMetadata = await sharp(image).metadata();

  assert.equal(createHash("sha256").update(image).digest("hex"), metadata.sha256);
  assert.equal(imageMetadata.width, metadata.width);
  assert.equal(imageMetadata.height, metadata.height);
  assert.equal(metadata.sourceSessionId, "019eabf9-3872-7d40-9d46-157edc38abc5");
});
```

- [ ] **Step 4: Run the reference test**

Run:

```bash
node --test scripts/referenceAsset.test.mjs
```

Expected: 1 test PASS.

- [ ] **Step 5: Include the reference test in character tooling tests**

Change `package.json`:

```json
"characters:test": "node --test scripts/referenceAsset.test.mjs scripts/characterAssetGenerator.test.mjs"
```

- [ ] **Step 6: Commit**

```bash
git add character-assets/reference scripts/referenceAsset.test.mjs package.json
git commit -m "chore: preserve approved character reference"
```

---

### Task 2: Add A Local Hand-Authoring Pixel Editor

**Files:**
- Create: `tools/character-pixel-editor/index.html`
- Create: `tools/character-pixel-editor/editor.css`
- Create: `tools/character-pixel-editor/editor-core.mjs`
- Create: `tools/character-pixel-editor/editor-core.test.mjs`
- Create: `tools/character-pixel-editor/editor.js`
- Create: `scripts/serve-character-editor.mjs`
- Modify: `package.json:11-16`

- [ ] **Step 1: Write editor core tests**

Create `tools/character-pixel-editor/editor-core.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPixel,
  clonePixels,
  frameOffset,
  mirrorFrameHorizontally
} from "./editor-core.mjs";

test("frameOffset maps three columns and four rows", () => {
  assert.deepEqual(frameOffset(2, 3, 48, 72), { x: 96, y: 216 });
});

test("applyPixel records the previous pixel for undo", () => {
  const pixels = new Uint8ClampedArray([0, 0, 0, 0]);
  const undo = applyPixel(pixels, 1, 0, 0, [37, 24, 18, 255]);
  assert.deepEqual([...pixels], [37, 24, 18, 255]);
  assert.deepEqual(undo, { offset: 0, previous: [0, 0, 0, 0] });
});

test("mirrorFrameHorizontally mirrors only the selected frame", () => {
  const pixels = new Uint8ClampedArray([
    1, 0, 0, 255, 2, 0, 0, 255,
    3, 0, 0, 255, 4, 0, 0, 255
  ]);
  mirrorFrameHorizontally(pixels, 4, 1, { x: 0, y: 0, width: 2, height: 1 });
  assert.deepEqual([...pixels.slice(0, 8)], [2, 0, 0, 255, 1, 0, 0, 255]);
  assert.deepEqual([...pixels.slice(8)], [3, 0, 0, 255, 4, 0, 0, 255]);
});

test("clonePixels creates an independent history snapshot", () => {
  const source = new Uint8ClampedArray([1, 2, 3, 4]);
  const copy = clonePixels(source);
  copy[0] = 9;
  assert.equal(source[0], 1);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
node --test tools/character-pixel-editor/editor-core.test.mjs
```

Expected: FAIL because `editor-core.mjs` does not exist.

- [ ] **Step 3: Implement editor core operations**

Create `tools/character-pixel-editor/editor-core.mjs`:

```js
export function frameOffset(column, row, frameWidth = 48, frameHeight = 72) {
  return { x: column * frameWidth, y: row * frameHeight };
}

export function clonePixels(pixels) {
  return new Uint8ClampedArray(pixels);
}

export function applyPixel(pixels, imageWidth, x, y, rgba) {
  const offset = (y * imageWidth + x) * 4;
  const previous = [...pixels.slice(offset, offset + 4)];
  pixels.set(rgba, offset);
  return { offset, previous };
}

export function restorePixel(pixels, change) {
  pixels.set(change.previous, change.offset);
}

export function mirrorFrameHorizontally(pixels, imageWidth, imageHeight, frame) {
  if (
    frame.x < 0 ||
    frame.y < 0 ||
    frame.x + frame.width > imageWidth ||
    frame.y + frame.height > imageHeight
  ) {
    throw new Error("Frame is outside the loaded image");
  }

  for (let row = 0; row < frame.height; row += 1) {
    for (let column = 0; column < Math.floor(frame.width / 2); column += 1) {
      const left = ((frame.y + row) * imageWidth + frame.x + column) * 4;
      const right = (
        (frame.y + row) * imageWidth +
        frame.x +
        frame.width -
        column -
        1
      ) * 4;
      const leftPixel = pixels.slice(left, left + 4);
      const rightPixel = pixels.slice(right, right + 4);
      pixels.set(rightPixel, left);
      pixels.set(leftPixel, right);
    }
  }
}
```

- [ ] **Step 4: Run editor core tests**

Run:

```bash
node --test tools/character-pixel-editor/editor-core.test.mjs
```

Expected: 4 tests PASS.

- [ ] **Step 5: Create the editor document**

Create `tools/character-pixel-editor/index.html` with these exact controls:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Character Pixel Editor</title>
    <link rel="stylesheet" href="./editor.css" />
  </head>
  <body>
    <header>
      <input id="source-file" type="file" accept="image/png" />
      <select id="asset-class" aria-label="Asset class">
        <option value="npc">NPC fixed color</option>
        <option value="base">Base markers</option>
        <option value="hair">Hair markers</option>
        <option value="outfit">Outfit markers</option>
        <option value="accessory">Accessory fixed color</option>
      </select>
      <select id="frame-column" aria-label="Frame column">
        <option value="0">Walk 1 / Idle 1</option>
        <option value="1">Walk 2 / Idle 2</option>
        <option value="2">Walk 3</option>
      </select>
      <select id="frame-row" aria-label="Direction row">
        <option value="0">Down</option>
        <option value="1">Left</option>
        <option value="2">Right</option>
        <option value="3">Up</option>
      </select>
      <button id="pencil" type="button" aria-pressed="true">Pencil</button>
      <button id="eraser" type="button" aria-pressed="false">Eraser</button>
      <button id="undo" type="button">Undo</button>
      <button id="redo" type="button">Redo</button>
      <button id="mirror" type="button">Mirror frame</button>
      <button id="export" type="button">Export PNG</button>
    </header>
    <main>
      <aside>
        <div id="palette" aria-label="Pixel palette"></div>
        <label><input id="show-guides" type="checkbox" checked /> Guides</label>
        <label><input id="show-reference" type="checkbox" checked /> Reference</label>
        <img
          id="reference"
          src="../../character-assets/reference/approved-couple.png"
          alt="Approved bride and groom reference"
        />
      </aside>
      <section id="canvas-shell">
        <canvas id="editor-canvas"></canvas>
      </section>
      <aside>
        <h2>Actual size</h2>
        <canvas id="actual-size" width="48" height="72"></canvas>
        <output id="status"></output>
      </aside>
    </main>
    <script type="module" src="./editor.js"></script>
  </body>
</html>
```

- [ ] **Step 6: Implement the browser editor**

Create `tools/character-pixel-editor/editor.js` using:

```js
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
```

`editor.css` must:

```css
:root {
  color: #241812;
  background: #eee8df;
  font-family: system-ui, sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; }

header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px;
  background: #fff;
  border-bottom: 1px solid #b9aa99;
}

button,
select,
input { min-height: 36px; }

main {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 180px;
  gap: 12px;
  padding: 12px;
}

aside {
  min-width: 0;
  padding: 10px;
  background: #fff;
  border: 1px solid #b9aa99;
}

#palette {
  display: grid;
  grid-template-columns: repeat(4, 32px);
  gap: 6px;
  margin-bottom: 12px;
}

#palette button {
  width: 32px;
  height: 32px;
  min-height: 32px;
  border: 2px solid #6a584b;
}

#reference {
  display: block;
  width: 100%;
  margin-top: 10px;
}

#canvas-shell {
  min-width: 0;
  overflow: auto;
  padding: 12px;
  background-color: #fff;
  background-image:
    linear-gradient(45deg, #ddd 25%, transparent 25%),
    linear-gradient(-45deg, #ddd 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ddd 75%),
    linear-gradient(-45deg, transparent 75%, #ddd 75%);
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-size: 16px 16px;
}

#editor-canvas,
#actual-size,
#reference { image-rendering: pixelated; }

#editor-canvas {
  display: block;
  width: 768px;
  height: 1152px;
  cursor: crosshair;
}

#actual-size {
  display: block;
  width: 48px;
  height: 72px;
  background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 / 8px 8px;
}

#status {
  display: block;
  margin-top: 10px;
  white-space: pre-wrap;
}

@media (max-width: 900px) {
  main { grid-template-columns: 1fr; }
}
```

- [ ] **Step 7: Add the localhost-only editor server**

Create `scripts/serve-character-editor.mjs`:

```js
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const port = 41731;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json"
};

createServer(async (request, response) => {
  const pathname = request.url === "/" ? "/tools/character-pixel-editor/index.html" : request.url;
  const file = normalize(join(root, pathname.split("?")[0]));
  if (!file.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const metadata = await stat(file);
    if (!metadata.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Character pixel editor: http://127.0.0.1:${port}`);
});
```

Add to `package.json`:

```json
"characters:editor": "node scripts/serve-character-editor.mjs",
"characters:test": "node --test scripts/referenceAsset.test.mjs scripts/characterAssetGenerator.test.mjs tools/character-pixel-editor/editor-core.test.mjs"
```

- [ ] **Step 8: Smoke-test the editor**

Run:

```bash
pnpm characters:editor
```

Open `http://127.0.0.1:41731`, load `character-assets/source/npc/groom-idle.png`, draw one pixel, undo it, mirror frame 1 twice, and export.

Expected:

- Exported image remains `96x72`.
- Undo restores the original pixel.
- Double mirror restores the original frame.
- Actual-size preview remains `48x72`.

- [ ] **Step 9: Commit**

```bash
git add tools/character-pixel-editor scripts/serve-character-editor.mjs package.json
git commit -m "feat: add character pixel authoring tool"
```

---

### Task 3: Add Source-Art Quality Audits

**Files:**
- Create: `character-assets/quality-rules.json`
- Create: `scripts/lib/characterAssetAudit.mjs`
- Create: `scripts/characterAssetAudit.test.mjs`
- Create: `scripts/audit-character-assets.mjs`
- Modify: `package.json:11-17`

- [ ] **Step 1: Add explicit quality rules**

Create `character-assets/quality-rules.json`:

```json
{
  "frame": {
    "width": 48,
    "height": 72,
    "footBottomMin": 66,
    "footBottomMax": 70,
    "footBottomSpreadMax": 1
  },
  "npc": {
    "minimumOpaquePixelsPerFrame": 850,
    "minimumUniqueOpaqueColors": 20,
    "minimumColorTransitionsPerFrame": 110
  },
  "base": {
    "minimumOpaquePixelsPerFrame": 650,
    "minimumUniqueOpaqueColors": 8,
    "minimumColorTransitionsPerFrame": 90
  },
  "hair": {
    "minimumOpaquePixelsPerOccupiedFrame": 55,
    "minimumUniqueOpaqueColors": 5,
    "minimumAlphaDifferenceBetweenStyles": 0.01
  },
  "outfit": {
    "minimumOpaquePixelsPerFrame": 260,
    "minimumUniqueOpaqueColors": 7,
    "minimumAlphaDifferenceBetweenStyles": 0.015
  },
  "accessory": {
    "minimumOpaquePixelsPerOccupiedFrame": 4,
    "minimumUniqueOpaqueColors": 2
  }
}
```

- [ ] **Step 2: Write metric tests**

Create `scripts/characterAssetAudit.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  alphaDifference,
  inspectSheet,
  silhouetteHash
} from "./lib/characterAssetAudit.mjs";

async function writeRgba(file, width, height, pixels) {
  await sharp(Buffer.from(pixels), {
    raw: { width, height, channels: 4 }
  }).png().toFile(file);
}

test("inspectSheet reports per-frame bounds, colors, transitions, and foot baseline", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-audit-"));
  const file = join(dir, "sheet.png");
  const pixels = new Uint8Array(4 * 4 * 4);
  for (let y = 1; y < 4; y += 1) {
    for (let x = 1; x < 3; x += 1) {
      const offset = (y * 4 + x) * 4;
      pixels.set(x === 1 ? [255, 0, 0, 255] : [0, 0, 255, 255], offset);
    }
  }
  await writeRgba(file, 4, 4, pixels);

  const metrics = await inspectSheet(file, { frameWidth: 4, frameHeight: 4 });
  assert.equal(metrics.frames.length, 1);
  assert.equal(metrics.frames[0].opaquePixels, 6);
  assert.equal(metrics.frames[0].uniqueOpaqueColors, 2);
  assert.equal(metrics.frames[0].bounds.bottom, 3);
  assert.ok(metrics.frames[0].colorTransitions > 0);
  await rm(dir, { recursive: true });
});

test("silhouetteHash ignores RGB changes but catches alpha changes", () => {
  const first = Uint8Array.from([255, 0, 0, 255, 0, 0, 0, 0]);
  const recolored = Uint8Array.from([0, 0, 255, 255, 0, 0, 0, 0]);
  const shifted = Uint8Array.from([0, 0, 0, 0, 0, 0, 255, 255]);
  assert.equal(silhouetteHash(first), silhouetteHash(recolored));
  assert.notEqual(silhouetteHash(first), silhouetteHash(shifted));
});

test("alphaDifference returns the changed-alpha ratio", () => {
  const first = Uint8Array.from([0, 0, 0, 255, 0, 0, 0, 0]);
  const second = Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 255]);
  assert.equal(alphaDifference(first, second), 1);
});
```

- [ ] **Step 3: Run and verify RED**

Run:

```bash
node --test scripts/characterAssetAudit.test.mjs
```

Expected: FAIL because the audit library does not exist.

- [ ] **Step 4: Implement reusable pixel metrics**

Create `scripts/lib/characterAssetAudit.mjs`:

```js
import { createHash } from "node:crypto";
import sharp from "sharp";

export function silhouetteHash(data) {
  const alpha = Buffer.alloc(data.length / 4);
  for (let offset = 0, index = 0; offset < data.length; offset += 4, index += 1) {
    alpha[index] = data[offset + 3] === 0 ? 0 : 1;
  }
  return createHash("sha256").update(alpha).digest("hex");
}

export function alphaDifference(first, second) {
  if (first.length !== second.length) throw new Error("Images must have equal dimensions");
  let changed = 0;
  let pixels = 0;
  for (let offset = 0; offset < first.length; offset += 4) {
    if ((first[offset + 3] === 0) !== (second[offset + 3] === 0)) changed += 1;
    pixels += 1;
  }
  return changed / pixels;
}

function inspectFrame(data, imageWidth, frame) {
  let opaquePixels = 0;
  let colorTransitions = 0;
  let left = frame.width;
  let right = -1;
  let top = frame.height;
  let bottom = -1;
  const colors = new Set();
  const alpha = Buffer.alloc(frame.width * frame.height * 4);

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const source = ((frame.y + y) * imageWidth + frame.x + x) * 4;
      const target = (y * frame.width + x) * 4;
      data.copy(alpha, target, source, source + 4);
      if (data[source + 3] === 0) continue;
      opaquePixels += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      colors.add(`${data[source]},${data[source + 1]},${data[source + 2]},${data[source + 3]}`);

      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (x + dx >= frame.width || y + dy >= frame.height) continue;
        const neighbor = ((frame.y + y + dy) * imageWidth + frame.x + x + dx) * 4;
        if (
          data[source] !== data[neighbor] ||
          data[source + 1] !== data[neighbor + 1] ||
          data[source + 2] !== data[neighbor + 2] ||
          data[source + 3] !== data[neighbor + 3]
        ) {
          colorTransitions += 1;
        }
      }
    }
  }

  return {
    opaquePixels,
    uniqueOpaqueColors: colors.size,
    colorTransitions,
    bounds: opaquePixels === 0 ? null : { left, right, top, bottom },
    silhouetteHash: silhouetteHash(alpha),
    rgba: alpha
  };
}

export async function inspectSheet(file, { frameWidth = 48, frameHeight = 72 } = {}) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width % frameWidth !== 0 || info.height % frameHeight !== 0) {
    throw new Error(`${file} is not divisible into ${frameWidth}x${frameHeight} frames`);
  }
  const sheetColors = new Set();
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue;
    sheetColors.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]},${data[offset + 3]}`);
  }
  const frames = [];
  for (let row = 0; row < info.height / frameHeight; row += 1) {
    for (let column = 0; column < info.width / frameWidth; column += 1) {
      frames.push(inspectFrame(data, info.width, {
        x: column * frameWidth,
        y: row * frameHeight,
        width: frameWidth,
        height: frameHeight
      }));
    }
  }
  return { width: info.width, height: info.height, uniqueOpaqueColors: sheetColors.size, frames };
}
```

- [ ] **Step 5: Run audit library tests**

Run:

```bash
node --test scripts/characterAssetAudit.test.mjs
```

Expected: 3 tests PASS.

- [ ] **Step 6: Implement the catalog-aware audit CLI**

Create `scripts/audit-character-assets.mjs` with these behaviors:

```js
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  alphaDifference,
  inspectSheet,
  silhouetteHash
} from "./lib/characterAssetAudit.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(root, "character-assets/source");
const catalog = JSON.parse(await readFile(join(root, "shared/character-catalog.json"), "utf8"));
const rules = JSON.parse(await readFile(join(root, "character-assets/quality-rules.json"), "utf8"));
const argument = (name, fallback) =>
  process.argv.find((item) => item.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const scope = argument("scope", "all");
const family = argument("family", "all");
const allowedScopes = new Set(["all", "couple", "base", "hair", "outfits", "accessories"]);
if (!allowedScopes.has(scope)) throw new Error(`Unknown character audit scope: ${scope}`);
if (!new Set(["all", "masculine", "feminine"]).has(family)) {
  throw new Error(`Unknown character audit family: ${family}`);
}

const failures = [];
const wants = (name) => scope === "all" || scope === name;
const familyMatches = (item) => family === "all" || item.family === family;

async function rawRgba(file) {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function combinedAlpha(first, second) {
  if (first.length !== second.length) throw new Error("Layer dimensions differ");
  const output = Buffer.alloc(first.length);
  for (let offset = 0; offset < first.length; offset += 4) {
    output[offset + 3] = first[offset + 3] || second[offset + 3] ? 255 : 0;
  }
  return output;
}

async function auditSheet(file, dimensions, classRules, options = {}) {
  try {
    const metrics = await inspectSheet(file);
    if (metrics.width !== dimensions.width || metrics.height !== dimensions.height) {
      failures.push(`${file}: expected ${dimensions.width}x${dimensions.height}, received ${metrics.width}x${metrics.height}`);
      return metrics;
    }
    if (metrics.uniqueOpaqueColors < classRules.minimumUniqueOpaqueColors) {
      failures.push(
        `${file}: opaque colors ${metrics.uniqueOpaqueColors} < ${classRules.minimumUniqueOpaqueColors}`
      );
    }
    const occupied = metrics.frames.filter((frame) => frame.opaquePixels > 0);
    const minimumOpaque =
      classRules.minimumOpaquePixelsPerFrame ??
      classRules.minimumOpaquePixelsPerOccupiedFrame;
    for (const [index, frame] of occupied.entries()) {
      if (frame.opaquePixels < minimumOpaque) {
        failures.push(`${file}: frame ${index} opaque pixels ${frame.opaquePixels} < ${minimumOpaque}`);
      }
      if (
        classRules.minimumColorTransitionsPerFrame !== undefined &&
        frame.colorTransitions < classRules.minimumColorTransitionsPerFrame
      ) {
        failures.push(
          `${file}: frame ${index} transitions ${frame.colorTransitions} < ${classRules.minimumColorTransitionsPerFrame}`
        );
      }
    }
    if (options.requireEveryFrame && occupied.length !== metrics.frames.length) {
      failures.push(`${file}: expected ${metrics.frames.length} occupied frames, found ${occupied.length}`);
    }
    if (options.footBaseline) {
      const bottoms = occupied.map((frame) => frame.bounds.bottom);
      for (const bottom of bottoms) {
        if (bottom < rules.frame.footBottomMin || bottom > rules.frame.footBottomMax) {
          failures.push(
            `${file}: foot baseline ${bottom} outside ${rules.frame.footBottomMin}..${rules.frame.footBottomMax}`
          );
        }
      }
      if (Math.max(...bottoms) - Math.min(...bottoms) > rules.frame.footBottomSpreadMax) {
        failures.push(`${file}: foot baseline spread exceeds ${rules.frame.footBottomSpreadMax}`);
      }
    }
    return metrics;
  } catch (error) {
    failures.push(`${file}: ${error.message}`);
    return null;
  }
}

async function auditDistinctStyles(items, pathFor, minimumDifference) {
  const entries = [];
  for (const item of items) {
    const files = pathFor(item);
    try {
      const layers = await Promise.all(files.map(rawRgba));
      const combined = layers
        .slice(1)
        .reduce((current, layer) => combinedAlpha(current, layer.data), layers[0].data);
      entries.push({ id: item.id, rgba: combined, hash: silhouetteHash(combined) });
    } catch (error) {
      failures.push(`${item.id}: ${error.message}`);
    }
  }
  for (let first = 0; first < entries.length; first += 1) {
    for (let second = first + 1; second < entries.length; second += 1) {
      const a = entries[first];
      const b = entries[second];
      if (a.hash === b.hash) failures.push(`${a.id} and ${b.id}: duplicate silhouette`);
      const difference = alphaDifference(a.rgba, b.rgba);
      if (difference < minimumDifference) {
        failures.push(
          `${a.id} and ${b.id}: alpha difference ${difference.toFixed(4)} < ${minimumDifference}`
        );
      }
    }
  }
}

if (wants("couple")) {
  for (const npc of catalog.npcs) {
    await auditSheet(
      join(sourceRoot, "npc", `${npc.id}-idle.png`),
      { width: 96, height: 72 },
      rules.npc,
      { requireEveryFrame: true, footBaseline: true }
    );
    await auditSheet(
      join(sourceRoot, "npc", `${npc.id}-walk.png`),
      { width: 144, height: 288 },
      rules.npc,
      { requireEveryFrame: true, footBaseline: true }
    );
  }
  console.log("Audited couple");
}

if (wants("base")) {
  for (const itemFamily of ["masculine", "feminine"]) {
    if (family !== "all" && family !== itemFamily) continue;
    await auditSheet(
      join(sourceRoot, "base", `${itemFamily}-idle.png`),
      { width: 96, height: 72 },
      rules.base,
      { requireEveryFrame: true, footBaseline: true }
    );
    await auditSheet(
      join(sourceRoot, "base", `${itemFamily}-walk.png`),
      { width: 144, height: 288 },
      rules.base,
      { requireEveryFrame: true, footBaseline: true }
    );
  }
  console.log(`Audited base (${family})`);
}

if (wants("hair")) {
  const styles = catalog.hairStyles.filter(familyMatches);
  for (const style of styles) {
    await auditSheet(
      join(sourceRoot, "hair", `${style.id}__back-walk.png`),
      { width: 144, height: 288 },
      rules.hair
    );
    await auditSheet(
      join(sourceRoot, "hair", `${style.id}__front-walk.png`),
      { width: 144, height: 288 },
      rules.hair
    );
  }
  for (const itemFamily of ["masculine", "feminine"]) {
    const familyStyles = styles.filter((style) => style.family === itemFamily);
    await auditDistinctStyles(
      familyStyles,
      (style) => [
        join(sourceRoot, "hair", `${style.id}__back-walk.png`),
        join(sourceRoot, "hair", `${style.id}__front-walk.png`)
      ],
      rules.hair.minimumAlphaDifferenceBetweenStyles
    );
  }
  console.log(`Audited hair (${family})`);
}

if (wants("outfits")) {
  const outfits = catalog.outfits.filter(familyMatches);
  for (const outfit of outfits) {
    await auditSheet(
      join(sourceRoot, "outfits", `${outfit.id}__walk.png`),
      { width: 144, height: 288 },
      rules.outfit,
      { requireEveryFrame: true }
    );
  }
  for (const itemFamily of ["masculine", "feminine"]) {
    await auditDistinctStyles(
      outfits.filter((outfit) => outfit.family === itemFamily),
      (outfit) => [join(sourceRoot, "outfits", `${outfit.id}__walk.png`)],
      rules.outfit.minimumAlphaDifferenceBetweenStyles
    );
  }
  console.log(`Audited outfits (${family})`);
}

if (wants("accessories")) {
  for (const accessory of catalog.accessories) {
    await auditSheet(
      join(sourceRoot, "accessories", `${accessory.id}__walk.png`),
      { width: 144, height: 288 },
      rules.accessory
    );
  }
  console.log("Audited accessories");
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Character asset audit passed");
}
```

The implementation above must:

- Read `shared/character-catalog.json` and `character-assets/quality-rules.json`.
- Audit only the selected scope.
- Accept `--family=all`, `--family=masculine`, or `--family=feminine` for hair and outfit scopes.
- Require `96x72` NPC idle, `144x288` NPC walk, `96x72` base idle, and `144x288` all walk sheets.
- Apply NPC rules to all nonempty NPC frames.
- Apply base rules and foot-baseline rules to base frames.
- Apply hair rules to nonempty hair frames.
- Apply outfit rules to outfit frames; the base layer owns the composed foot baseline.
- Apply accessory rules to nonempty accessory frames.
- Combine front and back alpha masks when comparing hairstyles.
- Reject equal silhouette hashes between different style IDs.
- Reject alpha differences below the configured hair or outfit threshold.
- Print one line per audited group and finish with `Character asset audit passed`.
- Collect all failures and print them together before setting `process.exitCode = 1`.

Add:

```json
"characters:audit": "node scripts/audit-character-assets.mjs",
"characters:contact-sheet": "node scripts/render-character-contact-sheet.mjs",
"characters:test": "node --test scripts/referenceAsset.test.mjs scripts/characterAssetGenerator.test.mjs scripts/characterAssetAudit.test.mjs tools/character-pixel-editor/editor-core.test.mjs"
```

Do not add `characters:audit` to the root `test` command yet; current legacy assets are expected to fail.

- [ ] **Step 7: Verify unit tests and confirm legacy rejection**

Run:

```bash
pnpm characters:test
pnpm characters:audit -- --scope=base
pnpm characters:audit -- --scope=couple
```

Expected:

- Character tooling unit tests PASS.
- Base audit FAILS because legacy base sheets use only 7 opaque colors.
- Couple audit FAILS because legacy NPC sheets use only 17 opaque colors and NPC walk sheets do not exist.

- [ ] **Step 8: Commit the audit tooling**

```bash
git add character-assets/quality-rules.json scripts/lib/characterAssetAudit.mjs \
  scripts/characterAssetAudit.test.mjs scripts/audit-character-assets.mjs package.json
git commit -m "test: add character art quality gates"
```

---

### Task 4: Hand-Author The Groom Master

**Files:**
- Create: `character-assets/source/npc/groom-walk.png`
- Modify: `character-assets/source/npc/groom-idle.png`

- [ ] **Step 1: Author the neutral front groom frame**

Use the Manual Art Protocol and the approved reference.

Required geometry:

- Head top between y=4 and y=7.
- Chin between y=20 and y=23.
- Shoulder line between y=26 and y=30.
- Jacket waist between y=42 and y=46.
- Shoe bottom between y=67 and y=69.
- Total visible width between 24 and 34 pixels.

Required details:

- F1 eyes with one controlled highlight cluster per eye.
- Layered side-parted hair using at least four dark values.
- Narrow neck and visible shirt collar.
- Black tuxedo body distinct from satin lapels.
- White shirt, black bow tie, boutonniere, jacket buttons, trouser crease, shoe highlight.

- [ ] **Step 2: Author the front blink frame**

Duplicate the neutral front frame into idle frame 2. Change only the eye pixels required to close the eyes. Hair, boutonniere, lapels, hands, trousers, and shoes must remain pixel-identical.

- [ ] **Step 3: Author side and rear neutral frames**

Create left, right, and rear passing poses in `groom-walk.png`.

- Side profile keeps a readable nose, brow, lapel edge, cuff, trouser break, and shoe toe.
- Rear view includes hair crown clusters, jacket center seam, shoulder fit, trouser separation, and heel shapes.
- Correct the boutonniere side after mirroring.

- [ ] **Step 4: Author six walking extremes**

For each direction:

- Column 0 moves the left leg forward and right arm forward.
- Column 2 moves the right leg forward and left arm forward.
- Hands remain attached to sleeves.
- Head vertical movement is at most one pixel.
- Shoe bottoms remain within y=67..69.

- [ ] **Step 5: Verify groom files**

Run:

```bash
node -e 'import("sharp").then(async ({default:s}) => { for (const f of ["character-assets/source/npc/groom-idle.png","character-assets/source/npc/groom-walk.png"]) console.log(f, await s(f).metadata()) })'
pnpm characters:audit -- --scope=couple
```

Expected:

- Groom idle is `96x72`.
- Groom walk is `144x288`.
- Couple audit may still fail only for missing or legacy bride requirements; no groom-specific failures remain.

- [ ] **Step 6: Commit the groom master**

```bash
git add character-assets/source/npc/groom-idle.png character-assets/source/npc/groom-walk.png
git commit -m "art: author refined groom sprite"
```

---

### Task 5: Hand-Author The Bride Master

**Files:**
- Create: `character-assets/source/npc/bride-walk.png`
- Modify: `character-assets/source/npc/bride-idle.png`

- [ ] **Step 1: Author the neutral front bride frame**

Use the Manual Art Protocol and approved reference.

Required geometry:

- Head top between y=3 and y=6.
- Chin between y=19 and y=22.
- Shoulder line between y=25 and y=29.
- Waist between y=38 and y=42.
- Gown and train bottom between y=67 and y=70.
- Hair extends to at least y=49.
- Front silhouette width is 30 to 44 pixels, including skirt.

Required details:

- F1 eyes, small mouth, restrained blush.
- Waist-length dark-brown waves with separated left, center, and right highlight flows.
- Floral or pearl hair ornament.
- Ivory bodice, lace sleeves, waist definition, multi-layer skirt folds, lace edge.
- Pearl detail and pastel bouquet with ribbon or stems.

- [ ] **Step 2: Author the front blink frame**

Duplicate the neutral front frame into idle frame 2. Change only eye pixels. Hair, ornament, bouquet, lace, and train remain pixel-identical.

- [ ] **Step 3: Author side and rear neutral frames**

- Side view keeps the face profile, bodice, bouquet projection, skirt volume, and trailing hair.
- Rear view shows wave grouping, ornament, ribbon, waist seam, rear skirt folds, lace, and train.
- Correct bouquet and ornament asymmetry after mirroring.

- [ ] **Step 4: Author walking frames**

- Move feet subtly beneath the gown without making the dress jump.
- Shift skirt folds, hair tips, bouquet ribbon, and train by one or two pixels.
- Keep the head vertical movement at most one pixel.
- Keep the gown baseline within y=67..70.

- [ ] **Step 5: Verify bride and complete couple audit**

Run:

```bash
pnpm characters:audit -- --scope=couple
```

Expected: `Character asset audit passed`.

- [ ] **Step 6: Commit the bride master**

```bash
git add character-assets/source/npc/bride-idle.png character-assets/source/npc/bride-walk.png
git commit -m "art: author refined bride sprite"
```

---

### Task 6: Generate And Review The Couple In Every Direction

**Files:**
- Modify: `scripts/generate-character-assets.mjs:113-119`
- Modify: `scripts/characterAssetGenerator.test.mjs`
- Modify: `scripts/render-character-contact-sheet.mjs`

- [ ] **Step 1: Add a failing NPC output contract test**

Extend `scripts/characterAssetGenerator.test.mjs`:

```js
test("npc source contract includes idle and four-direction walk sheets", async () => {
  await assert.doesNotReject(() =>
    validateDimensions("character-assets/source/npc/groom-idle.png", { width: 96, height: 72 })
  );
  await assert.doesNotReject(() =>
    validateDimensions("character-assets/source/npc/groom-walk.png", { width: 144, height: 288 })
  );
  await assert.doesNotReject(() =>
    validateDimensions("character-assets/source/npc/bride-idle.png", { width: 96, height: 72 })
  );
  await assert.doesNotReject(() =>
    validateDimensions("character-assets/source/npc/bride-walk.png", { width: 144, height: 288 })
  );
});
```

- [ ] **Step 2: Update NPC generation**

Replace the NPC loop in `scripts/generate-character-assets.mjs`:

```js
for (const npc of catalog.npcs) {
  await copyFixed(
    join(sourceRoot, "npc", `${npc.id}-idle.png`),
    `npc/${npc.id}__idle.png`,
    { width: 96, height: 72 }
  );
  await copyFixed(
    join(sourceRoot, "npc", `${npc.id}-walk.png`),
    `npc/${npc.id}__walk.png`,
    { width: 144, height: 288 }
  );
}
```

Expected generated asset count changes from 264 to 266.

- [ ] **Step 3: Add couple and catalog contact-sheet modes**

Update `scripts/render-character-contact-sheet.mjs` to accept:

```text
--mode=couple
--mode=catalog
--output=<absolute-or-relative-png>
```

`couple` mode must render, for both groom and bride:

- Idle neutral and blink at 4x.
- Down walk frames 0, 1, 2 at 4x.
- Left walk frames 0, 1, 2 at 4x.
- Right walk frames 0, 1, 2 at 4x.
- Up walk frames 0, 1, 2 at 4x.
- A bottom strip containing all fourteen frames at actual size.

`catalog` mode must retain existing catalog coverage and add canonical down, left, right, and up passing poses for every hair and outfit.

Render labels as SVG text composited by Sharp so reviewers can identify each row.

Use this argument and frame extraction contract:

```js
const option = (name, fallback) =>
  process.argv.find((argument) => argument.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const mode = option("mode", "catalog");
const output = resolve(option("output", "/tmp/pixel-character-contact-sheet.png"));
if (!new Set(["couple", "catalog"]).has(mode)) {
  throw new Error(`Unknown contact-sheet mode: ${mode}`);
}

async function frame(relative, column, row) {
  return sharp(join(generatedRoot, relative))
    .extract({
      left: column * 48,
      top: row * 72,
      width: 48,
      height: 72
    })
    .png()
    .toBuffer();
}

async function label(text, width) {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return Buffer.from(
    `<svg width="${width}" height="22" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#fffaf2"/>` +
      `<text x="6" y="15" font-family="Arial,sans-serif" font-size="12" fill="#241812">${escaped}</text>` +
    `</svg>`
  );
}
```

Build couple samples with:

```js
const directions = [
  { id: "down", row: 0 },
  { id: "left", row: 1 },
  { id: "right", row: 2 },
  { id: "up", row: 3 }
];

async function coupleSamples() {
  const samples = [];
  for (const npc of catalog.npcs) {
    samples.push({
      label: `${npc.id} / idle`,
      frames: [
        await frame(`npc/${npc.id}__idle.png`, 0, 0),
        await frame(`npc/${npc.id}__idle.png`, 1, 0)
      ]
    });
    for (const direction of directions) {
      samples.push({
        label: `${npc.id} / ${direction.id}`,
        frames: await Promise.all(
          [0, 1, 2].map((column) =>
            frame(`npc/${npc.id}__walk.png`, column, direction.row)
          )
        )
      });
    }
  }
  return samples;
}
```

For each sample row:

- Composite each frame at `192x288` using `kernel: "nearest"`.
- Composite the same frames at `48x72` in a right-hand actual-size strip.
- Add the SVG label above the row.
- Use `#f4efe7` as the sheet background and a checkerboard only behind sprite cells.

- [ ] **Step 4: Run generation and couple audit**

Run:

```bash
pnpm characters:generate
pnpm characters:audit -- --scope=couple
```

Expected:

- `Generated 266 character assets`.
- Audit PASS.

- [ ] **Step 5: Render the couple review sheet**

Run:

```bash
mkdir -p .superpowers/character-review
pnpm characters:contact-sheet -- \
  --mode=couple \
  --output=.superpowers/character-review/couple-master.png
```

Expected: `.superpowers/character-review/couple-master.png` contains enlarged and actual-size views for all required frames.

- [ ] **Step 6: Perform the mandatory visual approval checkpoint**

Show the user:

```text
/Users/sjlee/Documents/New project 5/.superpowers/character-review/couple-master.png
```

Compare directly with:

```text
/Users/sjlee/Documents/New project 5/character-assets/reference/approved-couple.png
```

Do not begin guest source art until the user approves the couple sheet. Apply requested pixel corrections to the two NPC sheets and repeat Steps 4-6 until approved.

- [ ] **Step 7: Commit the approved couple pipeline**

```bash
git add scripts/generate-character-assets.mjs scripts/characterAssetGenerator.test.mjs \
  scripts/render-character-contact-sheet.mjs character-assets/source/npc
git commit -m "feat: generate and review complete couple sprites"
```

---

### Task 7: Rebuild Masculine And Feminine Base Bodies

**Files:**
- Modify: `character-assets/source/base/masculine-walk.png`
- Modify: `character-assets/source/base/masculine-idle.png`
- Modify: `character-assets/source/base/feminine-walk.png`
- Modify: `character-assets/source/base/feminine-idle.png`

- [ ] **Step 1: Author the masculine neutral frame**

Use the groom's approved compact frame as the proportion guide.

- Keep the body unclothed only where outfit layers require exposed skin.
- Use all four skin markers and all four fixed face colors.
- Maintain F1 eye, brow, mouth, ear, neck, hand, and foot placement.
- Keep shoulders slightly broader than the feminine base without creating a block torso.

- [ ] **Step 2: Complete masculine directions, walk frames, and blink**

- Side and rear heads must be authored, not copied from front.
- Arms and legs form natural tapered silhouettes.
- Idle frame 2 changes only eye pixels.

- [ ] **Step 3: Author the feminine neutral frame**

Use the bride's approved compact frame as the proportion guide.

- Keep the same head scale and facial language as masculine.
- Use a narrower shoulder and torso line without shrinking the face.
- Keep arms, hands, knees, and feet aligned with all feminine outfits.

- [ ] **Step 4: Complete feminine directions, walk frames, and blink**

Apply the same animation constraints as the masculine base.

- [ ] **Step 5: Run focused generation and audit**

Run:

```bash
pnpm characters:generate
pnpm characters:audit -- --scope=base
pnpm --filter @wedding-game/client test -- CharacterSprite.test.tsx CharacterCustomizer.test.tsx
```

Expected: audit and focused client tests PASS.

- [ ] **Step 6: Render representative base combinations**

Run:

```bash
pnpm characters:contact-sheet -- \
  --mode=catalog \
  --output=.superpowers/character-review/base-bodies.png
```

Inspect actual-size masculine and feminine faces in at least three skin tones.

- [ ] **Step 7: Commit**

```bash
git add character-assets/source/base
git commit -m "art: rebuild balanced guest base bodies"
```

---

### Task 8: Rebuild Eight Masculine Hairstyles

**Files:**
- Modify: `character-assets/source/hair/masculine-side-part__back-walk.png`
- Modify: `character-assets/source/hair/masculine-side-part__front-walk.png`
- Modify: `character-assets/source/hair/masculine-comma__back-walk.png`
- Modify: `character-assets/source/hair/masculine-comma__front-walk.png`
- Modify: `character-assets/source/hair/masculine-short-crop__back-walk.png`
- Modify: `character-assets/source/hair/masculine-short-crop__front-walk.png`
- Modify: `character-assets/source/hair/masculine-textured-fringe__back-walk.png`
- Modify: `character-assets/source/hair/masculine-textured-fringe__front-walk.png`
- Modify: `character-assets/source/hair/masculine-swept-back__back-walk.png`
- Modify: `character-assets/source/hair/masculine-swept-back__front-walk.png`
- Modify: `character-assets/source/hair/masculine-wavy-medium__back-walk.png`
- Modify: `character-assets/source/hair/masculine-wavy-medium__front-walk.png`
- Modify: `character-assets/source/hair/masculine-low-ponytail__back-walk.png`
- Modify: `character-assets/source/hair/masculine-low-ponytail__front-walk.png`
- Modify: `character-assets/source/hair/masculine-natural-curl__back-walk.png`
- Modify: `character-assets/source/hair/masculine-natural-curl__front-walk.png`

- [ ] **Step 1: Author four short styles**

Complete side part, comma, short crop, and textured fringe.

Distinct silhouette contracts:

- Side part: raised volume and visible part line.
- Comma: curved forehead lock and controlled opposite side.
- Short crop: close sides and textured crown.
- Textured fringe: broken forward fringe with irregular lower edge.

- [ ] **Step 2: Generate, audit, and inspect short styles**

Run:

```bash
pnpm characters:generate
pnpm characters:audit -- --scope=hair --family=masculine
pnpm characters:contact-sheet -- \
  --mode=catalog \
  --output=.superpowers/character-review/masculine-hair-short.png
```

Expected: no duplicate silhouette or alpha-difference failure among completed styles.

- [ ] **Step 3: Author four medium and long styles**

Complete swept back, wavy medium, low ponytail, and natural curl.

Distinct silhouette contracts:

- Swept back: exposed forehead, rear volume, clean side contour.
- Wavy medium: side and rear waves with alternating highlight clusters.
- Low ponytail: tied rear length visible in side and back views.
- Natural curl: rounded curl clusters with a nonuniform outline.

- [ ] **Step 4: Add controlled one-pixel motion**

- Apply one-pixel tip motion to `masculine-wavy-medium`, `masculine-low-ponytail`, and `masculine-natural-curl`.
- Short hair crown remains stable.
- No style may detach from the head during bobbing.

- [ ] **Step 5: Run complete hair audit**

Run:

```bash
pnpm characters:generate
pnpm characters:audit -- --scope=hair --family=masculine
```

Expected: PASS for all eight masculine styles.

- [ ] **Step 6: Commit**

```bash
git add character-assets/source/hair/masculine-*
git commit -m "art: rebuild masculine guest hairstyles"
```

---

### Task 9: Rebuild Eight Feminine Hairstyles

**Files:**
- Modify all sixteen `character-assets/source/hair/feminine-*` front/back sheets.

- [ ] **Step 1: Author long wave and long straight**

- Long wave inherits the bride's wave language at reduced detail and excludes bridal ornaments.
- Long straight has a narrow, clean fall and distinct straight highlight bands.
- Both extend below the shoulders in side and back views.

- [ ] **Step 2: Author low bun and half-up wave**

- Low bun has a rear circular mass at a stable vertical position.
- Half-up wave shows a tied crown section and loose lower waves.

- [ ] **Step 3: Generate and inspect long styles**

Run:

```bash
pnpm characters:generate
pnpm characters:audit -- --scope=hair
pnpm characters:contact-sheet -- \
  --mode=catalog \
  --output=.superpowers/character-review/feminine-hair-long.png
```

Inspect black and dark-brown variants at enlarged and actual sizes.

- [ ] **Step 4: Author medium bob and short bob**

- Medium bob reaches below the jaw with inward tips.
- Short bob has a higher rear line and exposed neck.

- [ ] **Step 5: Author braided ponytail and natural curl**

- Braided ponytail uses alternating braid clusters and a visible tie.
- Natural curl uses larger rounded clusters than the masculine curl and a distinct side silhouette.

- [ ] **Step 6: Run full hair audit**

Run:

```bash
pnpm characters:generate
pnpm characters:audit -- --scope=hair
```

Expected: all sixteen hairstyle IDs pass distinct-hash and minimum-difference checks.

- [ ] **Step 7: Commit**

```bash
git add character-assets/source/hair/feminine-*
git commit -m "art: rebuild feminine guest hairstyles"
```

---

### Task 10: Rebuild Five Masculine Outfits

**Files:**
- Modify: `character-assets/source/outfits/masculine-classic-suit__walk.png`
- Modify: `character-assets/source/outfits/masculine-slim-suit__walk.png`
- Modify: `character-assets/source/outfits/masculine-blazer-slacks__walk.png`
- Modify: `character-assets/source/outfits/masculine-knit-jacket__walk.png`
- Modify: `character-assets/source/outfits/masculine-formal-hanbok__walk.png`

- [ ] **Step 1: Author classic and slim suits**

- Classic suit: broader lapels, conventional jacket length, straight trouser silhouette.
- Slim suit: narrow lapels, fitted waist, tapered trousers.
- Neither may copy the groom's pure-black satin lapel treatment or boutonniere.

- [ ] **Step 2: Author blazer and knit-jacket sets**

- Blazer set: contrasting shirt or trouser region and a softer open-jacket outline.
- Knit jacket: textured marker clusters, softer shoulder, no formal lapel.

- [ ] **Step 3: Author masculine formal hanbok**

- Distinct jeogori overlap, belt or tie, roomy sleeve, and baji silhouette.
- Side and rear views preserve garment volume.

- [ ] **Step 4: Run outfit audit and palette generation**

Run:

```bash
pnpm characters:generate
pnpm characters:audit -- --scope=outfits --family=masculine
pnpm characters:contact-sheet -- \
  --mode=catalog \
  --output=.superpowers/character-review/masculine-outfits.png
```

Inspect every canonical palette at actual size and confirm marker boundaries do not create stray colors.

- [ ] **Step 5: Commit**

```bash
git add character-assets/source/outfits/masculine-*
git commit -m "art: rebuild masculine wedding guest outfits"
```

---

### Task 11: Rebuild Five Feminine Outfits

**Files:**
- Modify: `character-assets/source/outfits/feminine-midi-dress__walk.png`
- Modify: `character-assets/source/outfits/feminine-long-dress__walk.png`
- Modify: `character-assets/source/outfits/feminine-blouse-skirt__walk.png`
- Modify: `character-assets/source/outfits/feminine-jacket-slacks__walk.png`
- Modify: `character-assets/source/outfits/feminine-formal-hanbok__walk.png`

- [ ] **Step 1: Author midi and long dresses**

- Midi dress: visible waist, knee or calf-length skirt, smaller hem movement.
- Long dress: ankle-length silhouette, longer fold lines, one-pixel hem motion.
- Neither may use the bride's ivory lace composition, train, or bridal bodice.

- [ ] **Step 2: Author blouse-skirt and jacket-slacks**

- Blouse-skirt: separate blouse and waistband, softer sleeve, distinct skirt volume.
- Jacket-slacks: fitted jacket, lapel or collar, straight trouser separation.

- [ ] **Step 3: Author feminine formal hanbok**

- Authored jeogori, ribbon, rounded sleeve, high waist, and chima volume.
- Pattern accents use the two accent markers.

- [ ] **Step 4: Run full outfit audit**

Run:

```bash
pnpm characters:generate
pnpm characters:audit -- --scope=outfits
pnpm characters:contact-sheet -- \
  --mode=catalog \
  --output=.superpowers/character-review/all-outfits.png
```

Expected: all ten outfit IDs have distinct silhouettes and pass minimum alpha difference.

- [ ] **Step 5: Commit**

```bash
git add character-assets/source/outfits/feminine-*
git commit -m "art: rebuild feminine wedding guest outfits"
```

---

### Task 12: Rebuild Ten Accessories

**Files:**
- Modify all ten `character-assets/source/accessories/*__walk.png` sheets.

- [ ] **Step 1: Author face and jewelry accessories**

Complete:

- `glasses-round-gold`.
- `glasses-square-black`.
- `earrings-pearl`.
- `earrings-drop`.
- `necklace-simple`.

Requirements:

- Glasses follow front and side face contours without covering eye highlights.
- Earrings align to ears and remain visible in side view.
- Necklace sits inside outfit necklines and does not replace outfit pixels.

- [ ] **Step 2: Author neckwear and brooch accessories**

Complete:

- `tie-silk`.
- `bow-tie-velvet`.
- `brooch-floral`.

Requirements:

- Tie and bow tie remain centered through walking frames.
- Brooch retains its selected side after left/right mirroring.

- [ ] **Step 3: Author bags**

Complete:

- `handbag-formal`.
- `shoulder-bag-structured`.

Requirements:

- Handbag moves with the carrying hand.
- Shoulder bag separates rear strap and front bag body according to its catalog layer.
- Bag silhouettes remain readable against dark and light outfits.

- [ ] **Step 4: Run accessory audit and compatibility contact sheet**

Run:

```bash
pnpm characters:generate
pnpm characters:audit -- --scope=accessories
pnpm characters:contact-sheet -- \
  --mode=catalog \
  --output=.superpowers/character-review/accessories.png
```

Inspect each accessory on one masculine and one feminine compatible outfit.

- [ ] **Step 5: Run customizer and layer tests**

Run:

```bash
pnpm --filter @wedding-game/client test -- assets.test.ts CharacterSprite.test.tsx CharacterCustomizer.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add character-assets/source/accessories
git commit -m "art: rebuild wedding guest accessories"
```

---

### Task 13: Remove Procedural Character Drawing And Enforce Audits

**Files:**
- Delete: `scripts/author-character-source-assets.mjs`
- Modify: `package.json:11-17`
- Modify: `README.md:48-60`

- [ ] **Step 1: Confirm every source group passes**

Run:

```bash
pnpm characters:audit
```

Expected: `Character asset audit passed`.

- [ ] **Step 2: Delete the procedural generator**

Delete:

```text
scripts/author-character-source-assets.mjs
```

- [ ] **Step 3: Add the audit to required test and build preparation**

Set root scripts to:

```json
"characters:generate": "node scripts/generate-character-assets.mjs",
"characters:audit": "node scripts/audit-character-assets.mjs",
"characters:contact-sheet": "node scripts/render-character-contact-sheet.mjs",
"characters:editor": "node scripts/serve-character-editor.mjs",
"characters:test": "node --test scripts/referenceAsset.test.mjs scripts/characterAssetGenerator.test.mjs scripts/characterAssetAudit.test.mjs tools/character-pixel-editor/editor-core.test.mjs",
"build": "pnpm characters:audit && pnpm characters:generate && pnpm --filter @wedding-game/shared build && pnpm --filter @wedding-game/client build && pnpm --filter @wedding-game/worker build",
"test": "pnpm characters:test && pnpm characters:audit && pnpm characters:generate && pnpm --filter @wedding-game/shared test && pnpm --filter @wedding-game/client test && pnpm --filter @wedding-game/worker test"
```

- [ ] **Step 4: Replace README workflow documentation**

Replace the old generator sentence with:

````md
Character source sheets are hand-authored PNGs. Do not generate character geometry from code.

Use the local editor and review tools:

```bash
pnpm characters:editor
pnpm characters:audit
pnpm characters:generate
pnpm characters:contact-sheet -- --mode=catalog --output=/tmp/character-catalog.png
```

The editor runs only on `127.0.0.1:41731`. Palette generation may recolor exact marker pixels, but it must not create body, face, hair, outfit, or NPC geometry.
````

- [ ] **Step 5: Prove no procedural invocation remains**

Run:

```bash
rg -n 'author-character-source-assets|PixelCanvas|drawBaseFrame|drawHairFront|drawNpc' \
  scripts package.json README.md .github
```

Expected: no matches.

- [ ] **Step 6: Run character tooling pipeline**

Run:

```bash
pnpm characters:test
pnpm characters:audit
pnpm characters:generate
```

Expected: all PASS and `Generated 266 character assets`.

- [ ] **Step 7: Commit**

```bash
git add package.json README.md scripts character-assets
git commit -m "chore: retire procedural character drawing"
```

---

### Task 14: Full Functional And Visual Verification

**Files:**
- Modify after a failing focused test identifies a compatibility defect: the client or test file implicated by that test.

- [ ] **Step 1: Run complete automated verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Render the final full contact sheet**

Run:

```bash
pnpm characters:contact-sheet -- \
  --mode=catalog \
  --output=.superpowers/character-review/final-catalog.png
```

Verify:

- Bride and groom match the approved reference's face, hair, and formalwear hierarchy.
- All sixteen hairstyles have distinct silhouettes.
- All ten outfits are visibly distinct without relying on color.
- Accessories remain readable.
- Actual-size row remains attractive and legible.

- [ ] **Step 3: Start the client**

Run:

```bash
pnpm dev -- --host 127.0.0.1
```

Record the actual Vite URL from the terminal.

- [ ] **Step 4: Verify the 390px mobile entry customizer**

Using browser automation:

- Set viewport to `390x844`.
- Open the client.
- Inspect masculine and feminine defaults.
- Cycle every hairstyle, outfit, skin tone, and accessory category.
- Confirm no horizontal page overflow.
- Confirm the character remains crisp and does not overlap the entry action.
- Save screenshots to `.superpowers/character-review/mobile-customizer.png`.

- [ ] **Step 5: Verify garden NPCs and movement**

- Enter the garden.
- Walk down, left, right, and up.
- Confirm guest frame anchoring and no vertical jitter.
- Inspect bride and groom at actual world scale.
- Click both NPCs and confirm their panels still open.
- Confirm D-pad and NPC labels remain visible.
- Save `.superpowers/character-review/mobile-garden.png`.

- [ ] **Step 6: Verify two-session realtime appearance**

Open two sessions:

- Session A: masculine classic suit, side-part hair, tie.
- Session B: feminine formal hanbok, half-up wave, earrings.

Verify each session renders the other's exact:

- Family.
- Skin tone.
- Hairstyle and color.
- Outfit and palette.
- Accessories.
- Direction and walk frame.

Reload one session and verify local appearance restoration.

- [ ] **Step 7: Review browser console and network**

Expected:

- No missing generated PNG requests.
- No `Character asset failed:` logs.
- No React errors.
- No horizontal overflow.

- [ ] **Step 8: Fix only verified defects and rerun focused tests**

For each defect:

1. Add or update a focused failing test.
2. Run it and verify failure.
3. Apply the smallest fix.
4. Run focused tests.
5. Repeat Step 1. Repeat mobile Steps 3-5 when UI or CSS changed. Repeat realtime Step 6 when asset resolution, appearance data, or layer ordering changed.

- [ ] **Step 9: Commit verified integration fixes**

```bash
git add client shared worker scripts character-assets
git commit -m "fix: resolve character art integration defects"
```

Skip this commit when there are no code or asset changes.

---

### Task 15: Publish And Verify Production

**Files:**
- No expected source changes.

- [ ] **Step 1: Confirm clean release state**

Run:

```bash
git status -sb
git log --oneline --decorate -12
```

Expected: no uncommitted source changes. Ignored `.superpowers/character-review` files are allowed.

- [ ] **Step 2: Push the current branch**

Run:

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 3: Watch GitHub Pages**

Run:

```bash
gh run list --repo Po-Mato/pixel-garden-invitation --limit 5
gh run watch "$(gh run list --repo Po-Mato/pixel-garden-invitation --workflow pages.yml --limit 1 --json databaseId --jq '.[0].databaseId')" \
  --repo Po-Mato/pixel-garden-invitation \
  --exit-status
```

Expected: Pages workflow succeeds.

- [ ] **Step 4: Verify production**

Open:

```text
https://po-mato.github.io/pixel-garden-invitation/
```

Repeat:

- 390px entry/customizer check.
- One guest walk in all directions.
- Bride and groom inspection.
- NPC panel clicks.
- One two-session realtime appearance check.
- Console and network error check.

- [ ] **Step 5: Record final evidence**

Save:

```text
.superpowers/character-review/production-customizer.png
.superpowers/character-review/production-garden.png
```

Report:

- Final commit SHA.
- Test, typecheck, and build results.
- Pages workflow run URL.
- Production URL.
- Couple and final-catalog contact-sheet paths.

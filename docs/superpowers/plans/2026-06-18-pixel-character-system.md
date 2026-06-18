# Pixel Character System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CSS block avatar with detailed layered pixel guests, a tabbed character customizer, exclusive bride/groom NPCs, four-direction sprite animation, and a validated realtime appearance protocol.

**Architecture:** A shared JSON catalog defines every selectable ID and compatibility rule. A Node/Sharp asset pipeline converts authored marker-color sprite sheets into deterministic transparent PNG variants. React composes aligned sprite layers, while the Worker validates and broadcasts compact `CharacterAppearance` objects.

**Tech Stack:** TypeScript, React 18, Vite 8, Vitest, Testing Library, Node.js 24, Sharp, Cloudflare Workers/Durable Objects, pnpm 10.

---

## File Structure

### Shared catalog and protocol

- Create: `shared/character-catalog.json` — single catalog source for IDs, labels, compatibility, palettes, defaults, and NPC metadata.
- Create: `shared/src/characterCatalog.ts` — typed catalog loader, appearance validation, defaults, and layer resolution metadata.
- Create: `shared/src/characterCatalog.test.ts` — catalog counts, compatibility, fallback, and invalid-ID tests.
- Modify: `shared/src/protocol.ts` — replace `AvatarType`/`AvatarColor` with `CharacterAppearance`.
- Modify: `shared/src/validation.ts` — validate join appearances.
- Modify: `shared/src/validation.test.ts` — new protocol tests and legacy rejection.
- Modify: `shared/src/index.ts` — export character APIs.

### Asset pipeline

- Create: `character-assets/source/base/` — masculine/feminine base walk and idle marker sheets.
- Create: `character-assets/source/hair/` — 16 front/back hairstyle walk sheets.
- Create: `character-assets/source/outfits/` — 10 wedding-guest outfit marker sheets.
- Create: `character-assets/source/accessories/` — 10 accessory sheets.
- Create: `character-assets/source/npc/` — bride/groom exclusive idle assets.
- Create: `character-assets/palettes/skin.json`
- Create: `character-assets/palettes/hair.json`
- Create: `character-assets/palettes/outfits.json`
- Create: `scripts/lib/characterAssetGenerator.mjs` — palette replacement, dimension checks, and deterministic output.
- Create: `scripts/generate-character-assets.mjs` — CLI entry point.
- Create: `scripts/characterAssetGenerator.test.mjs` — Node tests for palette generation failures and output.
- Create: `scripts/render-character-contact-sheet.mjs` — QA montage generator.
- Modify: `package.json` — add Sharp and generation scripts.
- Modify: `.gitignore` — ignore generated PNG output.

### Client character system

- Create: `client/src/character/frame.ts` — direction/frame-to-background-position math.
- Create: `client/src/character/frame.test.ts`
- Create: `client/src/character/assets.ts` — deterministic generated asset URL and layer resolution.
- Create: `client/src/character/assets.test.ts`
- Create: `client/src/character/appearanceState.ts` — family changes, option changes, reset, and randomization.
- Create: `client/src/character/appearanceState.test.ts`
- Create: `client/src/character/storage.ts` — validated local-storage persistence.
- Create: `client/src/character/storage.test.ts`
- Create: `client/src/components/CharacterSprite.tsx` — layered sprite renderer.
- Create: `client/src/components/CharacterSprite.test.tsx`
- Create: `client/src/components/CharacterCustomizer.tsx` — top preview and category tabs.
- Create: `client/src/components/CharacterCustomizer.test.tsx`
- Create: `client/src/components/WeddingNpc.tsx`
- Create: `client/src/components/WeddingNpc.test.tsx`
- Modify: `client/src/components/EntryScreen.tsx`
- Modify: `client/src/components/EntryScreen.test.tsx`
- Delete: `client/src/components/PixelAvatar.tsx`
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/components/GameWorld.test.tsx`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/realtime/realtimeClient.ts`
- Modify: `client/src/realtime/realtimeClient.test.ts`
- Modify: `client/src/styles.css`

### Worker

- Modify: `worker/src/GardenRoom.ts`
- Modify: `worker/src/GardenRoom.test.ts`

---

### Task 1: Add The Typed Character Catalog

**Files:**
- Create: `shared/character-catalog.json`
- Create: `shared/src/characterCatalog.ts`
- Create: `shared/src/characterCatalog.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Write catalog contract tests**

Create `shared/src/characterCatalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  characterCatalog,
  defaultCharacterAppearance,
  parseCharacterAppearance,
  resolveAppearanceOptions
} from "./characterCatalog";

describe("character catalog", () => {
  it("contains the approved initial catalog counts", () => {
    expect(characterCatalog.skinTones).toHaveLength(5);
    expect(characterCatalog.hairColors).toHaveLength(6);
    expect(characterCatalog.hairStyles.filter((item) => item.family === "masculine")).toHaveLength(8);
    expect(characterCatalog.hairStyles.filter((item) => item.family === "feminine")).toHaveLength(8);
    expect(characterCatalog.outfits.filter((item) => item.family === "masculine")).toHaveLength(5);
    expect(characterCatalog.outfits.filter((item) => item.family === "feminine")).toHaveLength(5);
    expect(characterCatalog.accessories).toHaveLength(10);
    expect(characterCatalog.npcs.map((item) => item.id)).toEqual(["groom", "bride"]);
    expect(characterCatalog.outfits.every((item) => item.palettes.length === 4)).toBe(true);
  });

  it("accepts the default appearance", () => {
    expect(parseCharacterAppearance(defaultCharacterAppearance)).toEqual(defaultCharacterAppearance);
  });

  it("rejects unknown and incompatible ids", () => {
    expect(parseCharacterAppearance({
      ...defaultCharacterAppearance,
      hairStyle: "missing-hair"
    })).toBeNull();

    expect(parseCharacterAppearance({
      ...defaultCharacterAppearance,
      family: "masculine",
      hairStyle: "feminine-long-wave"
    })).toBeNull();
  });

  it("resolves only compatible options for a family", () => {
    const options = resolveAppearanceOptions("masculine");
    expect(options.hairStyles).toHaveLength(8);
    expect(options.outfits).toHaveLength(5);
    expect(options.hairStyles.every((item) => item.family === "masculine")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm --filter @wedding-game/shared test -- characterCatalog.test.ts
```

Expected: FAIL because `characterCatalog.ts` does not exist.

- [ ] **Step 3: Create the complete JSON catalog**

Create `shared/character-catalog.json` with these exact IDs:

```json
{
  "version": 1,
  "skinTones": [
    { "id": "skin-01-light", "label": "라이트" },
    { "id": "skin-02-fair", "label": "페어" },
    { "id": "skin-03-medium", "label": "미디엄" },
    { "id": "skin-04-tan", "label": "탄" },
    { "id": "skin-05-deep", "label": "딥" }
  ],
  "hairColors": [
    { "id": "black", "label": "검정" },
    { "id": "dark-brown", "label": "짙은 갈색" },
    { "id": "brown", "label": "갈색" },
    { "id": "light-brown", "label": "밝은 갈색" },
    { "id": "gray", "label": "회색" },
    { "id": "platinum", "label": "백금색" }
  ],
  "hairStyles": [
    { "id": "masculine-side-part", "family": "masculine", "label": "단정한 가르마" },
    { "id": "masculine-comma", "family": "masculine", "label": "소프트 쉼표머리" },
    { "id": "masculine-short-crop", "family": "masculine", "label": "쇼트 크롭" },
    { "id": "masculine-textured-fringe", "family": "masculine", "label": "텍스처 프린지" },
    { "id": "masculine-swept-back", "family": "masculine", "label": "미디엄 올백" },
    { "id": "masculine-wavy-medium", "family": "masculine", "label": "웨이브 미디엄" },
    { "id": "masculine-low-ponytail", "family": "masculine", "label": "로우 포니테일" },
    { "id": "masculine-natural-curl", "family": "masculine", "label": "내추럴 컬" },
    { "id": "feminine-long-wave", "family": "feminine", "label": "롱 웨이브" },
    { "id": "feminine-long-straight", "family": "feminine", "label": "롱 스트레이트" },
    { "id": "feminine-low-bun", "family": "feminine", "label": "로우 번" },
    { "id": "feminine-half-up-wave", "family": "feminine", "label": "하프업 웨이브" },
    { "id": "feminine-medium-bob", "family": "feminine", "label": "미디엄 보브" },
    { "id": "feminine-short-bob", "family": "feminine", "label": "쇼트 보브" },
    { "id": "feminine-braided-ponytail", "family": "feminine", "label": "브레이드 포니테일" },
    { "id": "feminine-natural-curl", "family": "feminine", "label": "내추럴 컬" }
  ],
  "outfits": [
    { "id": "masculine-classic-suit", "family": "masculine", "label": "클래식 수트", "palettes": ["navy", "charcoal", "sage", "burgundy"] },
    { "id": "masculine-slim-suit", "family": "masculine", "label": "슬림 수트", "palettes": ["midnight-blue", "graphite", "muted-blue", "plum"] },
    { "id": "masculine-blazer-slacks", "family": "masculine", "label": "블레이저와 슬랙스", "palettes": ["navy-beige", "brown-cream", "sage-charcoal", "blue-gray"] },
    { "id": "masculine-knit-jacket", "family": "masculine", "label": "포멀 니트 재킷", "palettes": ["oat-charcoal", "forest-navy", "dusty-blue", "wine-gray"] },
    { "id": "masculine-formal-hanbok", "family": "masculine", "label": "남성 한복", "palettes": ["navy-ivory", "sage-cream", "plum-gray", "blue-silver"] },
    { "id": "feminine-midi-dress", "family": "feminine", "label": "미디 하객 원피스", "palettes": ["dusty-rose", "muted-blue", "sage", "plum"] },
    { "id": "feminine-long-dress", "family": "feminine", "label": "롱 하객 원피스", "palettes": ["wine", "navy", "forest", "mauve"] },
    { "id": "feminine-blouse-skirt", "family": "feminine", "label": "블라우스와 스커트", "palettes": ["cream-rose", "ivory-navy", "sky-gray", "sage-brown"] },
    { "id": "feminine-jacket-slacks", "family": "feminine", "label": "재킷과 슬랙스", "palettes": ["beige-brown", "navy-cream", "gray-blue", "sage-charcoal"] },
    { "id": "feminine-formal-hanbok", "family": "feminine", "label": "여성 한복", "palettes": ["rose-cream", "jade-ivory", "plum-pink", "blue-lilac"] }
  ],
  "accessories": [
    { "id": "glasses-round-gold", "slot": "face", "layer": "face", "label": "골드 원형 안경" },
    { "id": "glasses-square-black", "slot": "face", "layer": "face", "label": "블랙 사각 안경" },
    { "id": "earrings-pearl", "slot": "jewelry", "layer": "jewelry", "label": "진주 귀걸이" },
    { "id": "earrings-drop", "slot": "jewelry", "layer": "jewelry", "label": "드롭 귀걸이" },
    { "id": "necklace-simple", "slot": "jewelry", "layer": "jewelry", "label": "심플 목걸이" },
    { "id": "tie-silk", "slot": "neckwear", "layer": "neckwear", "label": "실크 넥타이" },
    { "id": "bow-tie-velvet", "slot": "neckwear", "layer": "neckwear", "label": "벨벳 보타이" },
    { "id": "brooch-floral", "slot": "neckwear", "layer": "neckwear", "label": "플라워 브로치" },
    { "id": "handbag-formal", "slot": "carry", "layer": "carry", "label": "포멀 핸드백" },
    { "id": "shoulder-bag-structured", "slot": "carry", "layer": "back-accessory", "label": "미니 숄더백" }
  ],
  "defaults": {
    "masculine": {
      "skinTone": "skin-02-fair",
      "hairStyle": "masculine-side-part",
      "hairColor": "dark-brown",
      "outfit": "masculine-classic-suit",
      "outfitPalette": "navy"
    },
    "feminine": {
      "skinTone": "skin-02-fair",
      "hairStyle": "feminine-long-wave",
      "hairColor": "dark-brown",
      "outfit": "feminine-midi-dress",
      "outfitPalette": "dusty-rose"
    }
  },
  "npcs": [
    { "id": "groom", "label": "신랑 이서준" },
    { "id": "bride", "label": "신부 김하린" }
  ]
}
```

- [ ] **Step 4: Implement typed catalog validation**

Create `shared/src/characterCatalog.ts`:

```ts
import rawCatalog from "../character-catalog.json";

export type CharacterFamily = "masculine" | "feminine";
export type AccessorySlot = "face" | "jewelry" | "neckwear" | "carry";

export type CharacterAppearance = {
  family: CharacterFamily;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  outfit: string;
  outfitPalette: string;
  accessories: Record<AccessorySlot, string | null>;
};

type FamilyItem = { id: string; family: CharacterFamily; label: string };
type OutfitItem = FamilyItem & { palettes: string[] };
export type CharacterLayerSlot =
  | "back-accessory"
  | "back-hair"
  | "base"
  | "outfit"
  | "front-hair"
  | "face"
  | "jewelry"
  | "neckwear"
  | "carry";

type AccessoryItem = {
  id: string;
  slot: AccessorySlot;
  layer: CharacterLayerSlot;
  label: string;
};

export const characterCatalog = rawCatalog as {
  version: number;
  skinTones: Array<{ id: string; label: string }>;
  hairColors: Array<{ id: string; label: string }>;
  hairStyles: FamilyItem[];
  outfits: OutfitItem[];
  accessories: AccessoryItem[];
  defaults: Record<CharacterFamily, Omit<CharacterAppearance, "family" | "accessories">>;
  npcs: Array<{ id: "groom" | "bride"; label: string }>;
};

const emptyAccessories = (): CharacterAppearance["accessories"] => ({
  face: null,
  jewelry: null,
  neckwear: null,
  carry: null
});

export function getDefaultAppearance(family: CharacterFamily): CharacterAppearance {
  return {
    family,
    ...characterCatalog.defaults[family],
    accessories: emptyAccessories()
  };
}

export const defaultCharacterAppearance = getDefaultAppearance("feminine");

export function resolveAppearanceOptions(family: CharacterFamily) {
  return {
    skinTones: characterCatalog.skinTones,
    hairColors: characterCatalog.hairColors,
    hairStyles: characterCatalog.hairStyles.filter((item) => item.family === family),
    outfits: characterCatalog.outfits.filter((item) => item.family === family),
    accessories: characterCatalog.accessories
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseCharacterAppearance(value: unknown): CharacterAppearance | null {
  if (!isRecord(value) || (value.family !== "masculine" && value.family !== "feminine")) return null;

  const options = resolveAppearanceOptions(value.family);
  const outfit = options.outfits.find((item) => item.id === value.outfit);
  if (!options.skinTones.some((item) => item.id === value.skinTone)) return null;
  if (!options.hairColors.some((item) => item.id === value.hairColor)) return null;
  if (!options.hairStyles.some((item) => item.id === value.hairStyle)) return null;
  if (!outfit || !outfit.palettes.includes(value.outfitPalette as string)) return null;
  if (!isRecord(value.accessories)) return null;

  const accessories = emptyAccessories();
  for (const slot of Object.keys(accessories) as AccessorySlot[]) {
    const selected = value.accessories[slot];
    if (selected === null) continue;
    if (typeof selected !== "string") return null;
    if (!options.accessories.some((item) => item.id === selected && item.slot === slot)) return null;
    accessories[slot] = selected;
  }

  return {
    family: value.family,
    skinTone: value.skinTone as string,
    hairStyle: value.hairStyle as string,
    hairColor: value.hairColor as string,
    outfit: value.outfit as string,
    outfitPalette: value.outfitPalette as string,
    accessories
  };
}
```

Modify `shared/src/index.ts`:

```ts
export * from "./characterCatalog";
```

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
pnpm --filter @wedding-game/shared test -- characterCatalog.test.ts
pnpm --filter @wedding-game/shared typecheck
```

Expected: all catalog tests PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/character-catalog.json shared/src/characterCatalog.ts shared/src/characterCatalog.test.ts shared/src/index.ts
git commit -m "feat: add character appearance catalog"
```

---

### Task 2: Build The Palette Asset Generator

**Files:**
- Create: `scripts/lib/characterAssetGenerator.mjs`
- Create: `scripts/generate-character-assets.mjs`
- Create: `scripts/characterAssetGenerator.test.mjs`
- Create: `character-assets/palettes/skin.json`
- Create: `character-assets/palettes/hair.json`
- Create: `character-assets/palettes/outfits.json`
- Create: `character-assets/source/fixtures/base-walk.png`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add Sharp as a direct development dependency**

Run:

```bash
pnpm add -D sharp@^0.34.5
```

Expected: root `package.json` contains `sharp` in `devDependencies`.

- [ ] **Step 2: Write generator tests**

Create `scripts/characterAssetGenerator.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { generateVariant, validateDimensions } from "./lib/characterAssetGenerator.mjs";

test("validateDimensions accepts 144x288 walk sheets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-"));
  const file = join(dir, "walk.png");
  await sharp({ create: { width: 144, height: 288, channels: 4, background: "#ff00ffff" } }).png().toFile(file);
  await assert.doesNotReject(() => validateDimensions(file, { width: 144, height: 288 }));
  await rm(dir, { recursive: true });
});

test("generateVariant replaces exact marker colors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-"));
  const source = join(dir, "source.png");
  const output = join(dir, "output.png");
  await sharp({
    create: { width: 1, height: 1, channels: 4, background: "#ff0000ff" }
  }).png().toFile(source);

  await generateVariant(source, output, { "#ff0000": "#123456" });
  const { data } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data], [0x12, 0x34, 0x56, 0xff]);
  await rm(dir, { recursive: true });
});

test("generateVariant rejects unknown opaque marker colors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-"));
  const source = join(dir, "source.png");
  await sharp({
    create: { width: 1, height: 1, channels: 4, background: "#00ff00ff" }
  }).png().toFile(source);

  await assert.rejects(
    () => generateVariant(source, join(dir, "output.png"), { "#ff0000": "#123456" }),
    /Unknown marker color/
  );
  await rm(dir, { recursive: true });
});

test("generateVariant preserves explicitly allowed fixed colors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-"));
  const source = join(dir, "source.png");
  const output = join(dir, "output.png");
  await sharp({
    create: { width: 1, height: 1, channels: 4, background: "#251812ff" }
  }).png().toFile(source);

  await generateVariant(source, output, {}, { allowedFixedColors: ["#251812"] });
  const { data } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data], [0x25, 0x18, 0x12, 0xff]);
  await rm(dir, { recursive: true });
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
node --test scripts/characterAssetGenerator.test.mjs
```

Expected: FAIL because the generator module does not exist.

- [ ] **Step 4: Implement palette replacement**

Create `scripts/lib/characterAssetGenerator.mjs`:

```js
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

const normalizeHex = (value) => value.toLowerCase().replace("#", "");

export async function validateDimensions(file, expected) {
  const metadata = await sharp(file).metadata();
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    throw new Error(
      `${file} must be ${expected.width}x${expected.height}; received ${metadata.width}x${metadata.height}`
    );
  }
}

export async function generateVariant(source, output, replacements, options = {}) {
  const image = sharp(source);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const palette = new Map(
    Object.entries(replacements).map(([from, to]) => [normalizeHex(from), normalizeHex(to)])
  );
  const allowedFixedColors = new Set(
    (options.allowedFixedColors ?? []).map(normalizeHex)
  );

  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue;
    const key = [data[offset], data[offset + 1], data[offset + 2]]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("");
    const replacement = palette.get(key);
    if (!replacement) {
      if (allowedFixedColors.has(key)) continue;
      throw new Error(`Unknown marker color #${key} in ${source}`);
    }
    data[offset] = Number.parseInt(replacement.slice(0, 2), 16);
    data[offset + 1] = Number.parseInt(replacement.slice(2, 4), 16);
    data[offset + 2] = Number.parseInt(replacement.slice(4, 6), 16);
  }

  await mkdir(dirname(output), { recursive: true });
  await sharp(data, { raw: info }).png({ palette: true }).toFile(output);
}
```

- [ ] **Step 5: Add exact palettes**

Create palette JSON files with marker keys:

```json
// character-assets/palettes/skin.json
{
  "skin-01-light": { "#ff0000": "#ffe0c7", "#cc0000": "#efb99a", "#990000": "#c98268", "#660000": "#754334" },
  "skin-02-fair": { "#ff0000": "#f6c5a4", "#cc0000": "#dfa080", "#990000": "#b86d57", "#660000": "#68382c" },
  "skin-03-medium": { "#ff0000": "#dca07b", "#cc0000": "#c17e5e", "#990000": "#92513e", "#660000": "#542d25" },
  "skin-04-tan": { "#ff0000": "#b97655", "#cc0000": "#9b5b40", "#990000": "#713b2f", "#660000": "#42241f" },
  "skin-05-deep": { "#ff0000": "#865039", "#cc0000": "#693a2c", "#990000": "#48271f", "#660000": "#2c1916" }
}
```

```json
// character-assets/palettes/hair.json
{
  "black": { "#00ff00": "#181414", "#00cc00": "#2d2524", "#009900": "#463a37", "#006600": "#090808" },
  "dark-brown": { "#00ff00": "#38251f", "#00cc00": "#57372b", "#009900": "#78503b", "#006600": "#211512" },
  "brown": { "#00ff00": "#674331", "#00cc00": "#895d42", "#009900": "#ad7b57", "#006600": "#3c281f" },
  "light-brown": { "#00ff00": "#9b714e", "#00cc00": "#bc9066", "#009900": "#d8b084", "#006600": "#654832" },
  "gray": { "#00ff00": "#5b5a5b", "#00cc00": "#7c7b7d", "#009900": "#aaa9aa", "#006600": "#363537" },
  "platinum": { "#00ff00": "#b9aa9d", "#00cc00": "#d6cbc0", "#009900": "#f0e8df", "#006600": "#81756c" }
}
```

Create `character-assets/palettes/outfits.json`. Array values map in order to
`#0000ff`, `#0000cc`, `#000099`, `#000066`, `#ffff00`, and `#cccc00`:

```json
{
  "markers": ["#0000ff", "#0000cc", "#000099", "#000066", "#ffff00", "#cccc00"],
  "palettes": {
    "navy": ["#1b263a", "#293a55", "#405475", "#101827", "#f7efe1", "#d9cdbb"],
    "charcoal": ["#303238", "#474a51", "#656972", "#1d1f23", "#f5eee2", "#d4c7b6"],
    "sage": ["#526b58", "#6f8a72", "#91aa8f", "#34463a", "#f4ead8", "#d4c3a9"],
    "burgundy": ["#5b2430", "#7b3443", "#a04f5e", "#38161e", "#f5eadc", "#d5c2aa"],
    "midnight-blue": ["#131f38", "#203252", "#354d72", "#0b1324", "#f4eee3", "#d3c7b6"],
    "graphite": ["#282c32", "#3c424b", "#5c646f", "#171a1e", "#f3ecdf", "#d0c3b1"],
    "muted-blue": ["#536a82", "#6f879f", "#91a6ba", "#364657", "#f3eadc", "#d1c1aa"],
    "plum": ["#56364f", "#76506e", "#987493", "#342130", "#f5e9dc", "#d5bfa9"],
    "navy-beige": ["#1d2d47", "#314867", "#506986", "#111c2e", "#c9ad82", "#8e714b"],
    "brown-cream": ["#5a4032", "#775746", "#9b7760", "#38281f", "#f2dfbd", "#c7aa7c"],
    "sage-charcoal": ["#56705d", "#718c77", "#94ab96", "#35483b", "#4a4c52", "#292b2f"],
    "blue-gray": ["#4e6474", "#687f91", "#899dab", "#32414c", "#777c82", "#4d5157"],
    "oat-charcoal": ["#b49b76", "#cdb691", "#e2cfad", "#7f6b4d", "#4a4b50", "#292a2e"],
    "forest-navy": ["#294d3a", "#3b6950", "#5b896b", "#193225", "#283c5d", "#17243a"],
    "dusty-blue": ["#6f8397", "#8da0b2", "#acbbc8", "#4a5c6b", "#f0e6d6", "#cdbca6"],
    "wine-gray": ["#672e3f", "#874458", "#aa6579", "#401c27", "#777a80", "#4c4e53"],
    "navy-ivory": ["#1d2b45", "#304467", "#4c6385", "#111b2d", "#f4ead1", "#cdbd98"],
    "sage-cream": ["#5e7a62", "#7b967c", "#9db29a", "#3c503f", "#f3dfb5", "#c8aa78"],
    "plum-gray": ["#5d3958", "#7d5376", "#a07898", "#392234", "#88888d", "#56565b"],
    "blue-silver": ["#476783", "#6384a0", "#86a3b9", "#2d4356", "#c8ccd0", "#8e949b"],
    "dusty-rose": ["#9f5d68", "#bf7883", "#d99aa3", "#683b44", "#f2ded8", "#cdaaa2"],
    "wine": ["#662938", "#873d4f", "#ac5c6d", "#3d1821", "#e9d6d1", "#c4a19b"],
    "forest": ["#294c38", "#3d684e", "#60886c", "#183024", "#eadfca", "#c3ad88"],
    "mauve": ["#735062", "#946d7f", "#b6909f", "#49333e", "#f0ddd8", "#cba9a1"],
    "cream-rose": ["#efe0c4", "#f5ead4", "#fff5e6", "#c9b38e", "#a35f6b", "#70404a"],
    "ivory-navy": ["#f0e6cf", "#f7efdd", "#fff9eb", "#c8b998", "#243753", "#142238"],
    "sky-gray": ["#9eb9ca", "#b7cbd7", "#d3e0e7", "#6d8797", "#696d75", "#41444a"],
    "sage-brown": ["#819a7d", "#9fb39a", "#bdc9b5", "#566953", "#6c4d3a", "#432f25"],
    "beige-brown": ["#b89d78", "#d0b892", "#e5d1ae", "#806b4d", "#654737", "#3e2b23"],
    "navy-cream": ["#273a59", "#3c5476", "#597093", "#17243a", "#f1dfbd", "#c9aa79"],
    "gray-blue": ["#666b73", "#858b94", "#a5abb2", "#41454a", "#5c7892", "#3a5065"],
    "rose-cream": ["#a9606d", "#c77d89", "#df9da5", "#6d3d47", "#f2dfbd", "#c9aa79"],
    "jade-ivory": ["#397866", "#51a084", "#78bea5", "#244c40", "#f2e7ce", "#cbb997"],
    "plum-pink": ["#623a5b", "#845478", "#a8799c", "#3b2337", "#d993a9", "#a66077"],
    "blue-lilac": ["#4d6f91", "#698dad", "#8eacc4", "#30465c", "#ab92bd", "#786789"]
  }
}
```

The generator must assert that the set of palette IDs referenced by outfits exactly equals the set of keys in `outfits.json`.

- [ ] **Step 6: Implement the generation CLI**

Create `scripts/generate-character-assets.mjs`:

```js
import { access, copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateVariant, validateDimensions } from "./lib/characterAssetGenerator.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "shared/character-catalog.json"), "utf8"));
const skinPalettes = JSON.parse(await readFile(join(root, "character-assets/palettes/skin.json"), "utf8"));
const hairPalettes = JSON.parse(await readFile(join(root, "character-assets/palettes/hair.json"), "utf8"));
const outfitConfig = JSON.parse(await readFile(join(root, "character-assets/palettes/outfits.json"), "utf8"));
const sourceRoot = join(root, "character-assets/source");
const outputRoot = join(root, "client/public/characters/generated");
const outputs = new Set();
const fixedPixelColors = ["#251812", "#fff4dc", "#b75d65", "#d47777"];

function outputPath(relative) {
  const target = join(outputRoot, relative);
  if (outputs.has(target)) throw new Error(`Duplicate character output: ${relative}`);
  outputs.add(target);
  return target;
}

function paletteFromArray(values) {
  return Object.fromEntries(outfitConfig.markers.map((marker, index) => [marker, values[index]]));
}

async function requireFile(file, dimensions) {
  await access(file);
  await validateDimensions(file, dimensions);
}

async function copyFixed(source, relative, dimensions) {
  await requireFile(source, dimensions);
  const target = outputPath(relative);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

await rm(outputRoot, { recursive: true, force: true });

for (const family of ["masculine", "feminine"]) {
  const walkSource = join(sourceRoot, "base", `${family}-walk.png`);
  const idleSource = join(sourceRoot, "base", `${family}-idle.png`);
  await requireFile(walkSource, { width: 144, height: 288 });
  await requireFile(idleSource, { width: 96, height: 72 });

  for (const skin of catalog.skinTones) {
    const palette = skinPalettes[skin.id];
    if (!palette) throw new Error(`Missing skin palette: ${skin.id}`);
    await generateVariant(
      walkSource,
      outputPath(`base/${family}__${skin.id}__walk.png`),
      palette,
      { allowedFixedColors: fixedPixelColors }
    );
    await generateVariant(
      idleSource,
      outputPath(`base/${family}__${skin.id}__idle.png`),
      palette,
      { allowedFixedColors: fixedPixelColors }
    );
  }
}

for (const hair of catalog.hairStyles) {
  const backSource = join(sourceRoot, "hair", `${hair.id}__back-walk.png`);
  const frontSource = join(sourceRoot, "hair", `${hair.id}__front-walk.png`);
  await requireFile(backSource, { width: 144, height: 288 });
  await requireFile(frontSource, { width: 144, height: 288 });

  for (const color of catalog.hairColors) {
    const palette = hairPalettes[color.id];
    if (!palette) throw new Error(`Missing hair palette: ${color.id}`);
    await generateVariant(
      backSource,
      outputPath(`hair/${hair.id}__${color.id}__back-walk.png`),
      palette,
      { allowedFixedColors: ["#251812"] }
    );
    await generateVariant(
      frontSource,
      outputPath(`hair/${hair.id}__${color.id}__front-walk.png`),
      palette,
      { allowedFixedColors: ["#251812"] }
    );
  }
}

const referencedOutfitPalettes = new Set(catalog.outfits.flatMap((outfit) => outfit.palettes));
const declaredOutfitPalettes = new Set(Object.keys(outfitConfig.palettes));
if (
  referencedOutfitPalettes.size !== declaredOutfitPalettes.size ||
  [...referencedOutfitPalettes].some((id) => !declaredOutfitPalettes.has(id))
) {
  throw new Error("Outfit palette IDs do not match the catalog");
}

for (const outfit of catalog.outfits) {
  const source = join(sourceRoot, "outfits", `${outfit.id}__walk.png`);
  await requireFile(source, { width: 144, height: 288 });
  for (const paletteId of outfit.palettes) {
    await generateVariant(
      source,
      outputPath(`outfits/${outfit.id}__${paletteId}__walk.png`),
      paletteFromArray(outfitConfig.palettes[paletteId]),
      { allowedFixedColors: ["#251812"] }
    );
  }
}

for (const accessory of catalog.accessories) {
  await copyFixed(
    join(sourceRoot, "accessories", `${accessory.id}__walk.png`),
    `accessories/${accessory.id}__walk.png`,
    { width: 144, height: 288 }
  );
}

for (const npc of catalog.npcs) {
  await copyFixed(
    join(sourceRoot, "npc", `${npc.id}-idle.png`),
    `npc/${npc.id}__idle.png`,
    { width: 96, height: 72 }
  );
}

console.log(`Generated ${outputs.size} character assets`);
```

Add root scripts:

```json
{
  "scripts": {
    "characters:generate": "node scripts/generate-character-assets.mjs",
    "characters:test": "node --test scripts/characterAssetGenerator.test.mjs",
    "build": "pnpm characters:generate && pnpm --filter @wedding-game/shared build && pnpm --filter @wedding-game/client build && pnpm --filter @wedding-game/worker build",
    "test": "pnpm characters:test && pnpm characters:generate && pnpm --filter @wedding-game/shared test && pnpm --filter @wedding-game/client test && pnpm --filter @wedding-game/worker test"
  }
}
```

Add to `.gitignore`:

```gitignore
client/public/characters/generated/
```

- [ ] **Step 7: Run tests and verify GREEN**

Run:

```bash
node --test scripts/characterAssetGenerator.test.mjs
```

Expected: 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore scripts character-assets/palettes character-assets/source/fixtures
git commit -m "build: add pixel character asset pipeline"
```

---

### Task 3: Produce The Complete Pixel Asset Catalog

**Files:**
- Create: all PNG files under `character-assets/source/base/`
- Create: all PNG files under `character-assets/source/hair/`
- Create: all PNG files under `character-assets/source/outfits/`
- Create: all PNG files under `character-assets/source/accessories/`
- Create: all PNG files under `character-assets/source/npc/`
- Create: `scripts/render-character-contact-sheet.mjs`

- [ ] **Step 1: Generate art references**

Use the image generation skill with this exact art brief:

```text
Production pixel-art sprite reference for a romantic Korean wedding invitation RPG.
Compact detailed guest proportions, 48x72 final frame, crisp hard pixel edges,
expressive eyes, blush, layered hair highlights, wedding guest formalwear,
front/back/left/right silhouettes, no anti-aliasing, no blur, no gradients,
transparent or flat checker background. Guests must be elegant and attractive,
at about 85% of the detail level of the exclusive bride and groom.
```

Generate separate reference boards for:

- 8 masculine hairstyles.
- 8 feminine hairstyles.
- 5 masculine outfits.
- 5 feminine outfits.
- 10 accessories.
- Groom in black tuxedo.
- Bride with long wavy hair and ivory lace gown.

Save references outside committed source at:

```text
/tmp/pixel-character-references/
```

- [ ] **Step 2: Author base marker sheets**

Create these exact `144x288` walking sheets and `96x72` idle sheets:

```text
character-assets/source/base/masculine-walk.png
character-assets/source/base/masculine-idle.png
character-assets/source/base/feminine-walk.png
character-assets/source/base/feminine-idle.png
```

Use transparent pixels, the four skin markers from `skin.json`, and only these fixed colors:

```text
#251812 outline/eyes
#fff4dc eye highlight
#b75d65 mouth
#d47777 blush
```

Include eyes, mouth, blush, ears, hands, and legs in the base layer.

- [ ] **Step 3: Author hairstyle marker sheets**

For each of the 16 hair IDs from Task 1, create:

```text
character-assets/source/hair/<hair-id>__back-walk.png
character-assets/source/hair/<hair-id>__front-walk.png
```

Each file is `144x288` and uses only transparent pixels, the four hair markers from `hair.json`, and fixed outline color `#251812`. Long styles must use the back layer; short styles may keep the back layer fully transparent.

- [ ] **Step 4: Author outfit marker sheets**

For each of the 10 outfit IDs from Task 1, create:

```text
character-assets/source/outfits/<outfit-id>__walk.png
```

Each file is `144x288` and uses only transparent pixels, the six outfit markers from `outfits.json`, and fixed outline color `#251812`. Preserve the approved distinctions:

- Suits: lapels, shirt, tie area, jacket shading.
- Dresses: neckline, waist, folds, hem movement.
- Blouse/skirt: separate material shading.
- Jacket/slacks: tailored silhouette.
- Hanbok: jeogori, goreum, baji or chima silhouette.

- [ ] **Step 5: Author accessory sheets**

Create one `144x288` transparent PNG for each accessory ID:

```text
glasses-round-gold
glasses-square-black
earrings-pearl
earrings-drop
necklace-simple
tie-silk
bow-tie-velvet
brooch-floral
handbag-formal
shoulder-bag-structured
```

Use final fixed colors rather than marker colors. Align every frame to the same body anchor.

- [ ] **Step 6: Author exclusive NPC idle assets**

Create:

```text
character-assets/source/npc/groom-idle.png
character-assets/source/npc/bride-idle.png
```

Each is a `96x72` two-frame sheet:

- Groom: black tuxedo, satin lapels, black bow tie, white boutonniere, gold cufflinks.
- Bride: long dark-brown waves, ivory lace dress, pearl details, hair ornament, bouquet.

The first frame is neutral and the second frame is a blink. The bride's hair and gown must remain readable against the garden background.

- [ ] **Step 7: Generate and validate all output**

Run:

```bash
pnpm characters:generate
```

Expected:

- No unknown marker errors.
- All walking outputs are `144x288`.
- All idle outputs are `96x72`.
- Generated counts match the catalog.

- [ ] **Step 8: Create and inspect a contact sheet**

Create `scripts/render-character-contact-sheet.mjs` using Sharp to composite:

- All 16 hairstyles in all 6 colors.
- All 10 outfits in all 4 palettes.
- Five skin tones.
- All accessories.
- Bride and groom NPCs.

Run:

```bash
node scripts/render-character-contact-sheet.mjs /tmp/pixel-character-contact-sheet.png
```

Inspect `/tmp/pixel-character-contact-sheet.png` with the image viewer and reject any asset with:

- Blurred scaling.
- Broken layer alignment.
- Missing directional silhouette.
- Muddy contrast.
- Guest tuxedo or dress too similar to the NPC-exclusive designs.

- [ ] **Step 9: Commit**

```bash
git add character-assets/source scripts/render-character-contact-sheet.mjs character-assets/palettes/outfits.json
git commit -m "feat: add detailed pixel character assets"
```

---

### Task 4: Migrate Shared Realtime Types

**Files:**
- Modify: `shared/src/protocol.ts`
- Modify: `shared/src/validation.ts`
- Modify: `shared/src/validation.test.ts`

- [ ] **Step 1: Replace protocol tests with appearance data**

Use `defaultCharacterAppearance`:

```ts
import { defaultCharacterAppearance } from "./characterCatalog";

it("accepts a valid appearance join", () => {
  expect(parseClientMessage({
    type: "join",
    nickname: "민지",
    appearance: defaultCharacterAppearance
  })).toEqual({
    type: "join",
    nickname: "민지",
    appearance: defaultCharacterAppearance
  });
});

it("rejects the legacy avatar join shape", () => {
  expect(parseClientMessage({
    type: "join",
    nickname: "민지",
    avatar: "classic",
    color: "rose"
  })).toBeNull();
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @wedding-game/shared test -- validation.test.ts
```

Expected: valid appearance join fails and legacy join still passes.

- [ ] **Step 3: Replace protocol types**

Modify `shared/src/protocol.ts`:

```ts
import type { CharacterAppearance } from "./characterCatalog";

export type Direction = "up" | "down" | "left" | "right";

export type GuestProfile = {
  guestId: string;
  nickname: string;
  appearance: CharacterAppearance;
};

export type ClientMessage =
  | { type: "join"; nickname: string; appearance: CharacterAppearance }
  | { type: "move"; x: number; y: number; direction: Direction; moving: boolean; seq: number }
  | { type: "ping" }
  | { type: "leave" };
```

Delete `AvatarType` and `AvatarColor`.

- [ ] **Step 4: Validate join appearances**

Modify `shared/src/validation.ts`:

```ts
import { parseCharacterAppearance } from "./characterCatalog";

if (value.type === "join") {
  const nickname = sanitizeText(value.nickname, 16);
  const appearance = parseCharacterAppearance(value.appearance);
  if (!nickname || !appearance) return null;
  return { type: "join", nickname, appearance };
}
```

- [ ] **Step 5: Run tests and typecheck**

```bash
pnpm --filter @wedding-game/shared test
pnpm --filter @wedding-game/shared typecheck
```

Expected: shared tests PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/src/protocol.ts shared/src/validation.ts shared/src/validation.test.ts
git commit -m "feat: migrate realtime character protocol"
```

---

### Task 5: Update Durable Object Guest State

**Files:**
- Modify: `worker/src/GardenRoom.ts`
- Modify: `worker/src/GardenRoom.test.ts`

- [ ] **Step 1: Update Worker tests**

Define:

```ts
import { defaultCharacterAppearance } from "@wedding-game/shared";

function joinMessage(nickname: string): string {
  return JSON.stringify({
    type: "join",
    nickname,
    appearance: defaultCharacterAppearance
  });
}
```

Assert snapshots contain `appearance` and do not contain `avatar` or `color`.

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @wedding-game/worker test -- GardenRoom.test.ts
```

Expected: snapshot tests fail because `GardenRoom` still reads legacy fields.

- [ ] **Step 3: Store validated appearance**

Modify `createGuestSnapshot`:

```ts
return {
  guestId,
  nickname: message.nickname,
  appearance: message.appearance,
  x: spawn.x,
  y: spawn.y,
  direction: "down",
  moving: false,
  seq: 0,
  lastSeenAt: now
};
```

Also change Worker spawn to the current grid center:

```ts
const spawn = { x: 195, y: 525 };
```

- [ ] **Step 4: Verify Worker**

```bash
pnpm --filter @wedding-game/worker test
pnpm --filter @wedding-game/worker typecheck
pnpm --filter @wedding-game/worker exec wrangler deploy --dry-run --outdir /tmp/pixel-character-worker
```

Expected: tests, typecheck, and dry-run PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/GardenRoom.ts worker/src/GardenRoom.test.ts
git commit -m "feat: store realtime character appearance"
```

---

### Task 6: Add Sprite Frame Math And Layer Renderer

**Files:**
- Create: `client/src/character/frame.ts`
- Create: `client/src/character/frame.test.ts`
- Create: `client/src/character/assets.ts`
- Create: `client/src/character/assets.test.ts`
- Create: `client/src/components/CharacterSprite.tsx`
- Create: `client/src/components/CharacterSprite.test.tsx`

- [ ] **Step 1: Write frame tests**

Create `client/src/character/frame.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getWalkFrameStyle } from "./frame";

describe("getWalkFrameStyle", () => {
  it("maps direction and step to exact 48x72 sheet offsets", () => {
    expect(getWalkFrameStyle("down", 0)).toEqual({ x: 0, y: 0 });
    expect(getWalkFrameStyle("left", 1)).toEqual({ x: -48, y: -72 });
    expect(getWalkFrameStyle("right", 2)).toEqual({ x: -96, y: -144 });
    expect(getWalkFrameStyle("up", 1)).toEqual({ x: -48, y: -216 });
  });

  it("normalizes arbitrary step values", () => {
    expect(getWalkFrameStyle("down", 4)).toEqual({ x: -48, y: 0 });
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @wedding-game/client test -- frame.test.ts
```

Expected: FAIL because `frame.ts` does not exist.

- [ ] **Step 3: Implement frame math**

Create `client/src/character/frame.ts`:

```ts
import type { Direction } from "@wedding-game/shared";

const directionRow: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3
};

export function getWalkFrameStyle(direction: Direction, stepFrame: number) {
  const frame = ((stepFrame % 3) + 3) % 3;
  return { x: frame * -48, y: directionRow[direction] * -72 };
}
```

- [ ] **Step 4: Write deterministic asset resolution tests**

Create `client/src/character/assets.test.ts`:

```ts
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { resolveCharacterLayers } from "./assets";

it("resolves generated guest layer paths in render order", () => {
  expect(resolveCharacterLayers(defaultCharacterAppearance, "./")).toEqual([
    {
      slot: "back-hair",
      walkUrl: "./characters/generated/hair/feminine-long-wave__dark-brown__back-walk.png"
    },
    {
      slot: "base",
      walkUrl: "./characters/generated/base/feminine__skin-02-fair__walk.png",
      idleUrl: "./characters/generated/base/feminine__skin-02-fair__idle.png"
    },
    {
      slot: "outfit",
      walkUrl: "./characters/generated/outfits/feminine-midi-dress__dusty-rose__walk.png"
    },
    {
      slot: "front-hair",
      walkUrl: "./characters/generated/hair/feminine-long-wave__dark-brown__front-walk.png"
    }
  ]);
});

it("places accessories in catalog-defined layers", () => {
  expect(resolveCharacterLayers({
    ...defaultCharacterAppearance,
    accessories: {
      face: "glasses-round-gold",
      jewelry: "earrings-pearl",
      neckwear: "brooch-floral",
      carry: "shoulder-bag-structured"
    }
  }, "./").map((layer) => layer.slot)).toEqual([
    "back-accessory",
    "back-hair",
    "base",
    "outfit",
    "front-hair",
    "face",
    "jewelry",
    "neckwear"
  ]);
});
```

- [ ] **Step 5: Run asset tests and verify RED**

```bash
pnpm --filter @wedding-game/client test -- assets.test.ts
```

Expected: FAIL because `assets.ts` does not exist.

- [ ] **Step 6: Implement deterministic layer resolution**

Create `client/src/character/assets.ts`:

```ts
import {
  characterCatalog,
  type CharacterAppearance,
  type CharacterLayerSlot
} from "@wedding-game/shared";

export type ResolvedCharacterLayer = {
  slot: CharacterLayerSlot;
  walkUrl: string;
  idleUrl?: string;
};

const layerOrder: CharacterLayerSlot[] = [
  "back-accessory",
  "back-hair",
  "base",
  "outfit",
  "front-hair",
  "face",
  "jewelry",
  "neckwear",
  "carry"
];

const assetUrl = (baseUrl: string, path: string) =>
  `${baseUrl}characters/generated/${path}`;

export function resolveCharacterLayers(
  appearance: CharacterAppearance,
  baseUrl = import.meta.env.BASE_URL
): ResolvedCharacterLayer[] {
  const selectedAccessories = Object.values(appearance.accessories)
    .filter((id): id is string => id !== null)
    .map((id) => characterCatalog.accessories.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  const layers: ResolvedCharacterLayer[] = [
    ...selectedAccessories
      .filter((item) => item.layer === "back-accessory")
      .map((item) => ({
        slot: item.layer,
        walkUrl: assetUrl(baseUrl, `accessories/${item.id}__walk.png`)
      })),
    {
      slot: "back-hair",
      walkUrl: assetUrl(
        baseUrl,
        `hair/${appearance.hairStyle}__${appearance.hairColor}__back-walk.png`
      )
    },
    {
      slot: "base",
      walkUrl: assetUrl(
        baseUrl,
        `base/${appearance.family}__${appearance.skinTone}__walk.png`
      ),
      idleUrl: assetUrl(
        baseUrl,
        `base/${appearance.family}__${appearance.skinTone}__idle.png`
      )
    },
    {
      slot: "outfit",
      walkUrl: assetUrl(
        baseUrl,
        `outfits/${appearance.outfit}__${appearance.outfitPalette}__walk.png`
      )
    },
    {
      slot: "front-hair",
      walkUrl: assetUrl(
        baseUrl,
        `hair/${appearance.hairStyle}__${appearance.hairColor}__front-walk.png`
      )
    },
    ...selectedAccessories
      .filter((item) => item.layer !== "back-accessory")
      .map((item) => ({
        slot: item.layer,
        walkUrl: assetUrl(baseUrl, `accessories/${item.id}__walk.png`)
      }))
  ];

  return layers.sort(
    (first, second) => layerOrder.indexOf(first.slot) - layerOrder.indexOf(second.slot)
  );
}
```

- [ ] **Step 7: Write layered renderer tests**

Create `client/src/components/CharacterSprite.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { CharacterSprite } from "./CharacterSprite";

it("renders layers in stable back-to-front order", () => {
  const appearance = {
    ...defaultCharacterAppearance,
    accessories: {
      face: "glasses-round-gold",
      jewelry: "earrings-pearl",
      neckwear: "brooch-floral",
      carry: "shoulder-bag-structured"
    }
  };

  render(
    <CharacterSprite
      appearance={appearance}
      direction="right"
      moving={true}
      stepFrame={2}
      label="하객 캐릭터"
    />
  );

  const sprite = screen.getByLabelText("하객 캐릭터");
  expect([...sprite.querySelectorAll("[data-character-layer]")].map((node) => node.getAttribute("data-character-layer")))
    .toEqual(["back-accessory", "back-hair", "base", "outfit", "front-hair", "face", "jewelry", "neckwear"]);
});

it("uses the two-frame idle class only when facing down and stopped", () => {
  const { rerender } = render(
    <CharacterSprite appearance={defaultCharacterAppearance} direction="down" moving={false} label="캐릭터" />
  );
  expect(screen.getByLabelText("캐릭터")).toHaveClass("character-sprite--idle-front");

  rerender(<CharacterSprite appearance={defaultCharacterAppearance} direction="left" moving={false} label="캐릭터" />);
  expect(screen.getByLabelText("캐릭터")).not.toHaveClass("character-sprite--idle-front");
});
```

- [ ] **Step 8: Implement `CharacterSprite`**

Create `client/src/components/CharacterSprite.tsx`:

```tsx
import {
  defaultCharacterAppearance,
  parseCharacterAppearance,
  type CharacterAppearance,
  type Direction
} from "@wedding-game/shared";
import { resolveCharacterLayers } from "../character/assets";
import { getWalkFrameStyle } from "../character/frame";

type Props = {
  appearance: CharacterAppearance;
  direction: Direction;
  moving: boolean;
  stepFrame?: number;
  label?: string;
};

export function CharacterSprite({ appearance, direction, moving, stepFrame = 1, label }: Props) {
  const safeAppearance = parseCharacterAppearance(appearance) ?? defaultCharacterAppearance;
  const frame = getWalkFrameStyle(direction, moving ? stepFrame : 1);
  const useFrontIdle = !moving && direction === "down";
  const layers = resolveCharacterLayers(safeAppearance);

  return (
    <span
      className={`character-sprite ${useFrontIdle ? "character-sprite--idle-front" : ""}`}
      aria-label={label}
    >
      {layers.map((layer) => (
        <span
          key={`${layer.slot}:${layer.walkUrl}`}
          data-character-layer={layer.slot}
          className={`character-layer character-layer--${layer.slot}`}
          style={{
            backgroundImage: `url("${useFrontIdle && layer.idleUrl ? layer.idleUrl : layer.walkUrl}")`,
            backgroundPosition: useFrontIdle && layer.idleUrl ? "0 0" : `${frame.x}px ${frame.y}px`
          }}
        />
      ))}
    </span>
  );
}
```

- [ ] **Step 9: Run tests**

```bash
pnpm --filter @wedding-game/client test -- frame.test.ts assets.test.ts CharacterSprite.test.tsx
pnpm --filter @wedding-game/client typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add client/src/character/frame.ts client/src/character/frame.test.ts client/src/character/assets.ts client/src/character/assets.test.ts client/src/components/CharacterSprite.tsx client/src/components/CharacterSprite.test.tsx
git commit -m "feat: render layered pixel characters"
```

---

### Task 7: Add Customizer State, Randomization, And Storage

**Files:**
- Create: `client/src/character/appearanceState.ts`
- Create: `client/src/character/appearanceState.test.ts`
- Create: `client/src/character/storage.ts`
- Create: `client/src/character/storage.test.ts`

- [ ] **Step 1: Write family-reset and randomizer tests**

```ts
import { defaultCharacterAppearance, getDefaultAppearance, parseCharacterAppearance } from "@wedding-game/shared";
import { changeFamily, randomizeAppearance } from "./appearanceState";

it("resets incompatible fields when family changes", () => {
  expect(changeFamily(defaultCharacterAppearance, "masculine")).toEqual(getDefaultAppearance("masculine"));
});

it("randomizer always returns valid appearances", () => {
  for (let index = 0; index < 100; index += 1) {
    expect(parseCharacterAppearance(randomizeAppearance(index / 100))).not.toBeNull();
  }
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @wedding-game/client test -- appearanceState.test.ts
```

Expected: FAIL because state functions do not exist.

- [ ] **Step 3: Implement state operations**

Create `appearanceState.ts` with:

```ts
export function changeFamily(current: CharacterAppearance, family: CharacterFamily) {
  return current.family === family ? current : getDefaultAppearance(family);
}

export function updateAppearance(
  current: CharacterAppearance,
  patch: Partial<CharacterAppearance>
): CharacterAppearance {
  return parseCharacterAppearance({ ...current, ...patch }) ?? current;
}

export function randomizeAppearance(random = Math.random()): CharacterAppearance {
  const family: CharacterFamily = random < 0.5 ? "masculine" : "feminine";
  const options = resolveAppearanceOptions(family);
  const pick = <T>(items: T[], salt: number) => items[Math.floor(((random + salt) % 1) * items.length)];
  const outfit = pick(options.outfits, 0.37);

  return {
    family,
    skinTone: pick(options.skinTones, 0.11).id,
    hairStyle: pick(options.hairStyles, 0.23).id,
    hairColor: pick(options.hairColors, 0.31).id,
    outfit: outfit.id,
    outfitPalette: pick(outfit.palettes, 0.43),
    accessories: {
      face: null,
      jewelry: null,
      neckwear: null,
      carry: null
    }
  };
}
```

- [ ] **Step 4: Write storage tests**

```ts
it("loads a valid saved appearance", () => {
  localStorage.setItem("pixel-garden-character-v1", JSON.stringify(defaultCharacterAppearance));
  expect(loadAppearance()).toEqual(defaultCharacterAppearance);
});

it("deletes invalid saved appearance", () => {
  localStorage.setItem("pixel-garden-character-v1", JSON.stringify({ family: "bad" }));
  expect(loadAppearance()).toBeNull();
  expect(localStorage.getItem("pixel-garden-character-v1")).toBeNull();
});
```

- [ ] **Step 5: Implement storage**

```ts
const storageKey = "pixel-garden-character-v1";

export function loadAppearance(): CharacterAppearance | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = parseCharacterAppearance(JSON.parse(raw));
    if (!parsed) localStorage.removeItem(storageKey);
    return parsed;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

export function saveAppearance(appearance: CharacterAppearance) {
  localStorage.setItem(storageKey, JSON.stringify(appearance));
}
```

- [ ] **Step 6: Run and commit**

```bash
pnpm --filter @wedding-game/client test -- appearanceState.test.ts storage.test.ts
git add client/src/character
git commit -m "feat: add character customization state"
```

---

### Task 8: Replace Entry Screen With The Approved Customizer

**Files:**
- Create: `client/src/components/CharacterCustomizer.tsx`
- Create: `client/src/components/CharacterCustomizer.test.tsx`
- Modify: `client/src/components/EntryScreen.tsx`
- Modify: `client/src/components/EntryScreen.test.tsx`
- Delete: `client/src/components/PixelAvatar.tsx`

- [ ] **Step 1: Write customizer interaction tests**

Cover:

```tsx
it("shows the large live preview and category tabs", () => {
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  expect(screen.getByLabelText("선택한 하객 캐릭터")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "헤어" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "의상" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "액세서리" })).toBeInTheDocument();
});

it("changes the preview from an image option tile", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("tab", { name: "헤어" }));
  fireEvent.click(screen.getByRole("button", { name: "롱 스트레이트" }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hairStyle: "feminine-long-straight" }));
});

it("supports randomize and reset", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "무작위 꾸미기" }));
  expect(onChange).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "초기화" }));
  expect(onChange).toHaveBeenLastCalledWith(defaultCharacterAppearance);
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @wedding-game/client test -- CharacterCustomizer.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the top-preview tabbed customizer**

`CharacterCustomizer` state:

```ts
type CustomizerTab = "family" | "hair" | "hair-color" | "outfit" | "outfit-palette" | "accessories";
```

Required UI:

- A `CharacterSprite` preview facing down and idle.
- Tabs with `role="tablist"`, `role="tab"`, and `aria-selected`.
- Image option buttons with Korean accessible names.
- Color options with both swatch and text.
- Randomize and reset buttons.
- Fixed preview height to prevent layout shift.

- [ ] **Step 4: Update `EntryProfile` and `EntryScreen`**

Replace:

```ts
export type EntryProfile = {
  nickname: string;
  avatar: AvatarType;
  color: AvatarColor;
};
```

with:

```ts
export type EntryProfile = {
  nickname: string;
  appearance: CharacterAppearance;
};
```

Initialize with:

```ts
const [appearance, setAppearance] = useState(
  () => loadAppearance() ?? defaultCharacterAppearance
);
```

On entry:

```ts
saveAppearance(appearance);
onEnter({ nickname: nickname.trim(), appearance });
```

- [ ] **Step 5: Remove the legacy avatar**

Delete `client/src/components/PixelAvatar.tsx` and remove all `.pixel-avatar*` CSS in Task 11, after no imports remain.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @wedding-game/client test -- CharacterCustomizer.test.tsx EntryScreen.test.tsx
pnpm --filter @wedding-game/client typecheck
git add client/src/components/CharacterCustomizer.tsx client/src/components/CharacterCustomizer.test.tsx client/src/components/EntryScreen.tsx client/src/components/EntryScreen.test.tsx client/src/components/PixelAvatar.tsx
git commit -m "feat: add wedding guest character customizer"
```

---

### Task 9: Integrate Appearance And Walk Frames Into The World

**Files:**
- Modify: `client/src/realtime/realtimeClient.ts`
- Modify: `client/src/realtime/realtimeClient.test.ts`
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/components/GameWorld.test.tsx`

- [ ] **Step 1: Update realtime tests**

Replace the test join fixture:

```ts
const joinMessage = {
  type: "join",
  nickname: "하객1",
  appearance: defaultCharacterAppearance
} as const;
```

Add:

```ts
it("rejects room guests with invalid appearances", () => {
  // emit welcome with appearance: { family: "bad" }
  expect(onMessage).toHaveBeenCalledWith({ type: "error", code: "bad_message" });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @wedding-game/client test -- realtimeClient.test.ts
```

Expected: server parser still expects legacy avatar/color.

- [ ] **Step 3: Validate appearance in server messages**

In `isRoomGuest`:

```ts
const appearance = parseCharacterAppearance(value.appearance);
return (
  typeof value.guestId === "string" &&
  typeof value.nickname === "string" &&
  appearance !== null &&
  typeof value.lastSeenAt === "number" &&
  Number.isFinite(value.lastSeenAt)
);
```

- [ ] **Step 4: Add local animation state**

In `GameWorld`:

```ts
const [direction, setDirection] = useState<Direction>("down");
const [moving, setMoving] = useState(false);
const [stepFrame, setStepFrame] = useState(1);
```

On every successful tile step:

```ts
setDirection(nextDirection);
setMoving(true);
setStepFrame((currentFrame) => (currentFrame + 1) % 3);
```

On stop or blocked movement:

```ts
setMoving(false);
setStepFrame(1);
```

Use:

```tsx
<CharacterSprite
  appearance={profile.appearance}
  direction={direction}
  moving={moving}
  stepFrame={stepFrame}
  label={`${profile.nickname} 캐릭터`}
/>
```

Remote guests use:

```tsx
<CharacterSprite
  appearance={guest.appearance}
  direction={guest.direction}
  moving={guest.moving}
  stepFrame={guest.seq % 3}
  label={`${guest.nickname} 캐릭터`}
/>
```

- [ ] **Step 5: Send new join data**

Replace:

```ts
avatar: profile.avatar,
color: profile.color
```

with:

```ts
appearance: profile.appearance
```

Change effect dependencies to:

```ts
[profile.appearance, profile.nickname]
```

- [ ] **Step 6: Update component tests**

Assertions must verify:

- Local character layers render.
- One tile step advances the sprite frame.
- Stopping returns to neutral frame.
- Remote appearance renders.
- Join payload contains `appearance`.
- No join payload contains `avatar` or `color`.

- [ ] **Step 7: Run tests and commit**

```bash
pnpm --filter @wedding-game/client test -- realtimeClient.test.ts GameWorld.test.tsx
pnpm --filter @wedding-game/client typecheck
git add client/src/realtime client/src/components/GameWorld.tsx client/src/components/GameWorld.test.tsx
git commit -m "feat: animate customized guests in realtime"
```

---

### Task 10: Add Exclusive Bride And Groom NPCs

**Files:**
- Modify: `client/src/game/world.ts`
- Create: `client/src/components/WeddingNpc.tsx`
- Create: `client/src/components/WeddingNpc.test.tsx`
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/components/GameWorld.test.tsx`

- [ ] **Step 1: Write NPC interaction tests**

```tsx
it("renders exclusive bride and groom npc characters", () => {
  render(<GameWorld profile={profile} />);
  expect(screen.getByRole("button", { name: "신랑 이서준 소개 보기" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "신부 김하린 소개 보기" })).toBeInTheDocument();
});

it("opens the couple panel when an npc is selected", () => {
  render(<GameWorld profile={profile} />);
  fireEvent.click(screen.getByRole("button", { name: "신부 김하린 소개 보기" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("신랑신부 정원");
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @wedding-game/client test -- WeddingNpc.test.tsx GameWorld.test.tsx
```

Expected: NPC buttons do not exist.

- [ ] **Step 3: Add NPC world coordinates**

Modify `world.ts`:

```ts
export type WorldNpc = {
  id: "groom" | "bride";
  label: string;
  x: number;
  y: number;
};

npcs: [
  { id: "groom", label: "신랑 이서준", x: 255, y: 255 },
  { id: "bride", label: "신부 김하린", x: 315, y: 255 }
]
```

Both coordinates are tile centers and remain below the couple booth obstacle.

- [ ] **Step 4: Implement `WeddingNpc`**

```tsx
type Props = {
  id: "groom" | "bride";
  label: string;
  onSelect: () => void;
};

export function WeddingNpc({ id, label, onSelect }: Props) {
  return (
    <button type="button" className="wedding-npc" aria-label={`${label} 소개 보기`} onClick={onSelect}>
      <span
        className={`wedding-npc__sprite wedding-npc__sprite--${id}`}
        aria-hidden="true"
      />
      <span className="wedding-npc__label">{label}</span>
    </button>
  );
}
```

NPC CSS uses the exclusive `96x72` idle sheet and the same blink keyframes as guests.

- [ ] **Step 5: Render NPCs in `GameWorld`**

Map `gardenWorld.npcs` to absolutely positioned `WeddingNpc` components. `onSelect` sets `activeSpotId` to `"couple"`.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @wedding-game/client test -- WeddingNpc.test.tsx GameWorld.test.tsx
git add client/src/game/world.ts client/src/components/WeddingNpc.tsx client/src/components/WeddingNpc.test.tsx client/src/components/GameWorld.tsx client/src/components/GameWorld.test.tsx
git commit -m "feat: add bride and groom garden npcs"
```

---

### Task 11: Finish Pixel Styling, Accessibility, And Reduced Motion

**Files:**
- Modify: `client/src/styles.css`
- Modify: `client/src/components/CharacterCustomizer.test.tsx`
- Modify: `client/src/components/CharacterSprite.test.tsx`

- [ ] **Step 1: Add style contract tests**

Tests should assert stable classes and ARIA behavior rather than computed CSS:

```tsx
expect(screen.getByRole("tablist", { name: "캐릭터 꾸미기" })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: "헤어" })).toHaveAttribute("aria-selected", "true");
expect(screen.getByRole("button", { name: "짙은 갈색" })).toHaveTextContent("짙은 갈색");
```

- [ ] **Step 2: Replace legacy avatar CSS**

Delete `.pixel-avatar*` rules and add:

```css
.character-sprite {
  position: relative;
  display: block;
  width: 48px;
  height: 72px;
  image-rendering: pixelated;
  transform: translateZ(0);
}

.character-layer {
  position: absolute;
  inset: 0;
  width: 48px;
  height: 72px;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  pointer-events: none;
}

.character-sprite--idle-front .character-layer--base {
  animation: character-blink 2.4s steps(1, end) infinite;
}

@keyframes character-blink {
  0%, 91%, 97%, 100% { background-position: 0 0; }
  93%, 95% { background-position: -48px 0; }
}

@media (prefers-reduced-motion: reduce) {
  .character-sprite--idle-front .character-layer--base,
  .wedding-npc__sprite {
    animation: none;
  }
}
```

- [ ] **Step 3: Add approved customizer layout**

Required CSS behavior:

- Preview remains at least `220px` high.
- Character is shown at `96x144` in the entry preview by exact 2x scaling.
- World characters remain `48x72`.
- Tabs are horizontally scrollable without page overflow.
- Option tiles use a minimum 44px touch target.
- Selected tiles use border, check marker, and `aria-pressed`; color is not the sole signal.
- Mobile 390px layout has no horizontal page overflow.

- [ ] **Step 4: Add layer load failure behavior**

In `CharacterSprite`, add `onError` handling through preloaded `Image` objects or use `<img>` layers. On a failed layer:

- Hide only the failed layer.
- Keep the outer `48x72` size.
- Log `Character asset failed: <url>` in development.

Add a test that dispatches an image error and verifies sibling layers remain.

- [ ] **Step 5: Run focused tests**

```bash
pnpm --filter @wedding-game/client test -- CharacterCustomizer.test.tsx CharacterSprite.test.tsx
pnpm --filter @wedding-game/client typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/styles.css client/src/components/CharacterCustomizer.test.tsx client/src/components/CharacterSprite.test.tsx client/src/components/CharacterSprite.tsx
git commit -m "style: polish detailed pixel character experience"
```

---

### Task 12: Full Verification And Production Deployment

**Files:**
- Modify if needed: `README.md`
- Modify if needed: `.github/workflows/pages.yml`

- [ ] **Step 1: Document the asset workflow**

Add to `README.md`:

```md
## Character Assets

Source pixel sheets live in `character-assets/source`.
Generate palette variants before local development or production builds:

```bash
pnpm characters:generate
```

The generated files in `client/public/characters/generated` are ignored and rebuilt in CI.
Catalog IDs and compatibility rules live in `shared/character-catalog.json`.
```

- [ ] **Step 2: Verify CI generates assets**

Ensure `.github/workflows/pages.yml` still calls:

```bash
pnpm test
pnpm build
```

The root scripts must generate assets before tests and build. Do not duplicate generation commands in the workflow.

- [ ] **Step 3: Run complete automated verification**

```bash
pnpm install --frozen-lockfile
pnpm audit --audit-level moderate
pnpm test
pnpm typecheck
VITE_WORKER_URL=https://wedding-game-invitation.happyugn.workers.dev \
VITE_INVITATION_ID=sample-garden \
pnpm build
pnpm --filter @wedding-game/worker exec wrangler deploy --dry-run --outdir /tmp/pixel-character-worker-final
```

Expected:

- Asset generator tests PASS.
- Shared/client/worker tests PASS.
- Audit reports no known vulnerabilities.
- Production client includes generated character PNGs.
- Worker dry-run succeeds.

- [ ] **Step 4: Run desktop Browser verification**

Start:

```bash
VITE_WORKER_URL=https://wedding-game-invitation.happyugn.workers.dev \
VITE_INVITATION_ID=sample-garden \
pnpm dev
```

Browser flow:

1. Load entry screen.
2. Switch masculine/feminine family.
3. Verify incompatible options reset.
4. Change skin, hair style, hair color, outfit, palette, and every accessory slot.
5. Use randomize and reset.
6. Enter with a nickname.
7. Move in all four directions.
8. Confirm three-frame animation changes once per tile.
9. Select bride and groom NPCs.
10. Confirm no console errors or framework overlays.

- [ ] **Step 5: Run mobile Browser verification**

Use viewport `390x760`:

- No horizontal page overflow.
- Preview remains fully visible.
- Tabs and option tiles remain operable.
- Character does not overlap the entry button.
- D-pad remains visible.
- World sprite remains crisp.

- [ ] **Step 6: Verify realtime with two sessions**

Open two browser tabs with different appearances:

- Tab A joins with a masculine suit.
- Tab B joins with a feminine hanbok.
- Each tab renders the other's exact appearance.
- Movement direction and animation update remotely.
- Reload one tab and verify local-storage restoration.

- [ ] **Step 7: Commit final documentation**

```bash
git add README.md .github/workflows/pages.yml
git commit -m "docs: document pixel character workflow"
```

Skip the commit if neither file changed.

- [ ] **Step 8: Push and watch Pages deployment**

```bash
git push
gh run list --repo Po-Mato/pixel-garden-invitation --limit 3
gh run watch <latest-run-id> --repo Po-Mato/pixel-garden-invitation --exit-status
```

Expected: Pages workflow succeeds.

- [ ] **Step 9: Verify production**

Open:

```text
https://po-mato.github.io/pixel-garden-invitation/
```

Repeat entry, customization, tile movement, NPC, and two-session realtime smoke checks against the deployed Worker.

---

## Final Acceptance Checklist

- [ ] Five skin tones are available.
- [ ] Eight masculine and eight feminine hairstyles are available.
- [ ] Six natural hair colors are available.
- [ ] Five outfit sets per family are available.
- [ ] Every outfit has four authored palettes.
- [ ] Ten accessories are available in compatible slots.
- [ ] Guest characters render at exact `48x72` world size.
- [ ] Entry preview renders at exact 2x scale without blur.
- [ ] Four-direction walking uses three frames.
- [ ] Down-facing idle uses the two-frame blink sheet.
- [ ] Bride and groom NPCs use exclusive detailed assets.
- [ ] Legacy `avatar/color` messages are rejected.
- [ ] Realtime guests preserve exact appearance objects.
- [ ] Invalid IDs cannot enter the room.
- [ ] Mobile and desktop Browser QA pass.
- [ ] Tests, typecheck, build, audit, Wrangler dry-run, and Pages deployment pass.

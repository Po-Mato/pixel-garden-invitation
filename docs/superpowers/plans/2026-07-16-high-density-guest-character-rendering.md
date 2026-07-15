# 하객 캐릭터 고밀도 렌더링 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 12개 하객의 디자인과 `48×72` 월드 크기를 유지하면서 `96×144` 원안을 직접 렌더링해 얼굴·헤어·의상 디테일을 새 맵 수준에 맞춘다.

**Architecture:** 캐릭터 원안·프리셋·이동 계약은 유지하고 월드 자산 선택만 고밀도 시트로 전환한다. CSS는 월드 레이어에만 부드러운 축소 합성과 절제된 림·그림자를 적용하며, 자산 감사가 144개 보행 프레임의 정확한 바운딩 박스와 동일 배율을 검증한다. 접촉 시트와 실제 맵 브라우저 검수는 자동 검사로 잡기 어려운 얼굴 형태와 배경 가독성을 확인한다.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, CSS, Node.js, Sharp, Vite, agent-browser

## 전역 제약

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이며 현재 `main`·현재 워크트리를 사용한다.
- 새 worktree를 만들지 않는다.
- 사용자의 별도 요청 전에는 커밋·푸시·배포하지 않는다. 아래 커밋 체크포인트는 승인된 경우에만 실행한다.
- 기존 미추적 `character-assets/reference/guest-walk-ratio-redraw-sources/v1`, `v2`, `guest-walk-ratio-sources` 디렉터리를 수정·스테이징·삭제하지 않는다.
- 12명의 얼굴·헤어·의상·색상과 프리셋 ID를 유지한다.
- 원안 프레임은 `96×144`, 월드 표시 크기는 `48×72`, 가로·세로 배율은 모두 `0.5`로 유지한다.
- 상하좌우 3컷, 총 144개 보행 프레임을 모두 검수한다.
- 이동·충돌·포털·카메라·미니맵·실시간 동기화 로직은 변경하지 않는다.
- 새 런타임 의존성을 추가하지 않는다.

## 파일 구조

- `client/src/character/assets.ts`: 월드·썸네일·프리뷰가 사용할 스프라이트 URL과 원본·표시 크기 계약을 제공한다.
- `client/src/character/assets.test.ts`: 월드가 고밀도 시트를 선택하고 알 수 없는 프리셋도 동일 계약으로 폴백하는지 검증한다.
- `client/src/components/CharacterSprite.test.tsx`: 실제 CSS 변수, 동일 축척과 방향별 배경 좌표를 검증한다.
- `client/src/styles.css`: 월드 하객에만 고밀도 축소 합성과 림·그림자를 적용한다.
- `client/src/styles.test.ts`: 월드 하객 스타일이 거친 네 방향 흰 테두리를 제거했는지 검증한다.
- `scripts/lib/characterAssetAudit.mjs`: 프레임 상단·하단·높이의 최소·최대 계약을 검사한다.
- `scripts/characterAssetAudit.test.mjs`: 새 바운딩 규칙과 144프레임 총량을 검증한다.
- `scripts/audit-character-assets.mjs`: 하객 발 기준선과 고밀도 바운딩 규칙을 실행한다.
- `character-assets/quality-rules.json`: 현재 승인 원안의 `y=5~6`, `bottom=132`, `height=127~128` 계약을 선언한다.
- `scripts/render-character-contact-sheet.mjs`: 12명 × 4방향 × 3컷 리뷰 모드를 추가한다.
- `scripts/characterAssetGenerator.test.mjs`: 리뷰 샘플 수·순서·출력 크기를 검증한다.
- `.superpowers/character-review/high-density-guest-v1-*.png`: 실제 표시 크기, 확대 보기와 맵 브라우저 검수 산출물이다.
- `.superpowers/sdd/high-density-guest-rendering-report.md`: 검증 명령, 프레임 수, 스크린샷과 남은 위험을 기록한다.

---

### Task 1: 월드 자산 선택을 고밀도 원안으로 전환

**Files:**
- Modify: `client/src/character/assets.test.ts`
- Modify: `client/src/components/CharacterSprite.test.tsx`
- Modify: `client/src/character/assets.ts`

**Interfaces:**
- Consumes: `guestPresetFrame.source`, `guestPresetFrame.display`, `resolveGuestPreset(appearance)`
- Produces: `resolveCharacterLayers(..., displayMode)`가 모든 모드에서 고밀도 URL과 `sourceSize: { width: 96, height: 144 }`를 반환하는 계약

- [ ] **Step 1: 월드 고밀도 자산 계약 테스트를 작성한다**

`client/src/character/assets.test.ts`의 월드 테스트와 폴백 기대값을 다음처럼 변경한다.

```ts
it("월드에서도 96x144 고밀도 generated 경로를 48x72로 표시한다", () => {
  const layers = resolveCharacterLayers(defaultCharacterAppearance, "./");

  expect(layers).toEqual([
    {
      slot: "base",
      walkUrl: "./characters/generated/guests/feminine-long-wave-dress__walk.png",
      idleUrl: "./characters/generated/guests/feminine-long-wave-dress__idle.png",
      sourceSize: { width: 96, height: 144 },
      displaySize: {
        world: { width: 48, height: 72 },
        thumbnail: { width: 48, height: 72 },
        preview: { width: 96, height: 144 }
      }
    }
  ]);
});

it("알 수 없는 프리셋은 고밀도 기본 프리셋 경로로 대체한다", () => {
  expect(resolveCharacterLayers({ presetId: "missing" }, "./")[0].walkUrl)
    .toBe("./characters/generated/guests/feminine-long-wave-dress__walk.png");
});
```

`client/src/components/CharacterSprite.test.tsx`의 월드 프레임 테스트를 다음 계약으로 변경한다.

```ts
it("월드에서 96x144 프레임을 동일 비율로 48x72에 렌더링한다", () => {
  render(
    <CharacterSprite
      appearance={defaultCharacterAppearance}
      direction="right"
      moving={true}
      stepFrame={2}
      label="고밀도 하객"
    />
  );

  const sprite = screen.getByLabelText("고밀도 하객");
  const baseLayer = sprite.querySelector('[data-character-layer="base"]');

  expect(sprite).toHaveClass("character-sprite--world");
  expect(sprite).toHaveStyle({
    "--character-source-width": "96px",
    "--character-source-height": "144px",
    "--character-display-width": "48px",
    "--character-display-height": "72px",
    "--character-display-scale-x": "0.5",
    "--character-display-scale-y": "0.5"
  });
  expect(baseLayer).toHaveStyle({ backgroundPosition: "-192px -288px" });
});
```

- [ ] **Step 2: 새 테스트가 기존 거친 월드 경로 때문에 실패하는지 확인한다**

Run:

```bash
pnpm --filter @wedding-game/client test -- src/character/assets.test.ts src/components/CharacterSprite.test.tsx
```

Expected: 기존 `guests/world/*` URL, `48×72` sourceSize와 `-96px -144px` 배경 좌표 때문에 FAIL.

- [ ] **Step 3: 월드에서도 고밀도 원안 경로를 반환한다**

`client/src/character/assets.ts`의 `resolveCharacterLayers` 반환부를 다음처럼 단순화한다.

```ts
export function resolveCharacterLayers(
  appearance: CharacterAppearance,
  baseUrl = import.meta.env.BASE_URL,
  _displayMode: CharacterDisplayMode = "world"
): ResolvedCharacterLayer[] {
  const preset = resolveGuestPreset(appearance);
  return [{
    slot: "base",
    walkUrl: assetUrl(baseUrl, preset.generated.walk),
    idleUrl: assetUrl(baseUrl, preset.generated.idle),
    sourceSize: guestPresetFrame.source,
    displaySize: guestPresetFrame.display
  }];
}
```

매개변수 이름을 `_displayMode`로 유지해 호출 인터페이스는 바꾸지 않는다.

- [ ] **Step 4: 자산 선택과 스프라이트 테스트를 통과시킨다**

Run:

```bash
pnpm --filter @wedding-game/client test -- src/character/assets.test.ts src/components/CharacterSprite.test.tsx src/character/frame.test.ts
```

Expected: 관련 테스트 모두 PASS. 월드 sourceSize가 `96×144`, 표시 크기가 `48×72`, 배율이 `0.5`로 확인됨.

- [ ] **Step 5: 승인된 경우에만 체크포인트 커밋을 만든다**

```bash
git add client/src/character/assets.ts client/src/character/assets.test.ts client/src/components/CharacterSprite.test.tsx
git commit -m "feat: render high-density guest sprites"
```

사용자 커밋 승인이 없으면 실행하지 않고 다음 Task로 진행한다.

---

### Task 2: 월드 전용 축소 합성과 외곽선 정리

**Files:**
- Modify: `client/src/styles.test.ts`
- Modify: `client/src/styles.css`

**Interfaces:**
- Consumes: `CharacterSprite`가 붙이는 `.character-sprite--world`, `.character-layer`
- Produces: 월드 레이어 전용 `image-rendering: auto`와 두 단계 림·그림자 스타일

- [ ] **Step 1: 월드 합성 스타일의 실패 테스트를 작성한다**

`client/src/styles.test.ts`의 `world character separation` 블록을 다음으로 교체한다.

```ts
describe("world character separation", () => {
  it("downscales high-density sprites smoothly with a restrained rim and shadow", () => {
    const worldSpriteRule = styles.match(/\.character-sprite--world\s*{([^}]*)}/s)?.[1] ?? "";
    const worldLayerRule = styles.match(
      /\.character-sprite--world \.character-layer\s*{([^}]*)}/s
    )?.[1] ?? "";

    expect(worldLayerRule).toContain("image-rendering: auto;");
    expect(worldSpriteRule).toContain("drop-shadow(0 0 1px rgba(255, 246, 224, 0.72))");
    expect(worldSpriteRule).toContain("drop-shadow(1px 2px 1px rgba(36, 24, 18, 0.52))");
    expect(worldSpriteRule).not.toContain("drop-shadow(-1px 0 0");
    expect(worldSpriteRule).not.toContain("drop-shadow(1px 0 0");
  });
});
```

- [ ] **Step 2: 기존 네 방향 흰 외곽선 때문에 테스트가 실패하는지 확인한다**

Run:

```bash
pnpm --filter @wedding-game/client test -- src/styles.test.ts
```

Expected: 월드 레이어의 `image-rendering: auto`와 새 필터가 없어 FAIL.

- [ ] **Step 3: 월드에만 고밀도 축소 합성과 절제된 필터를 적용한다**

`client/src/styles.css`의 `.character-sprite--world` 규칙을 다음으로 교체하고 바로 뒤에 월드 레이어 규칙을 추가한다.

```css
.character-sprite--world {
  image-rendering: auto;
  filter:
    drop-shadow(0 0 1px rgba(255, 246, 224, 0.72))
    drop-shadow(1px 2px 1px rgba(36, 24, 18, 0.52));
}

.character-sprite--world .character-layer {
  image-rendering: auto;
}
```

기본 `.character-layer`의 `image-rendering: pixelated`는 프리뷰와 썸네일 호환성을 위해 유지한다.

- [ ] **Step 4: CSS와 컴포넌트 테스트를 통과시킨다**

Run:

```bash
pnpm --filter @wedding-game/client test -- src/styles.test.ts src/components/CharacterSprite.test.tsx
```

Expected: PASS. 월드 외의 미리보기·썸네일 테스트도 기존 크기 계약을 유지함.

- [ ] **Step 5: 승인된 경우에만 체크포인트 커밋을 만든다**

```bash
git add client/src/styles.css client/src/styles.test.ts
git commit -m "style: refine world guest rendering"
```

사용자 커밋 승인이 없으면 실행하지 않는다.

---

### Task 3: 144개 프레임 바운딩 계약 강화

**Files:**
- Modify: `scripts/lib/characterAssetAudit.mjs`
- Modify: `scripts/characterAssetAudit.test.mjs`
- Modify: `scripts/audit-character-assets.mjs`
- Modify: `character-assets/quality-rules.json`

**Interfaces:**
- Consumes: `inspectSheet(file, { frameWidth: 96, frameHeight: 144 })`
- Produces: `collectFrameRuleFailures`가 `minimumBoundsTop`, `maximumBoundsHeight`까지 검사하는 계약과 144프레임 총량 검사

- [ ] **Step 1: 상단 최소값과 높이 최대값 실패 테스트를 추가한다**

`scripts/characterAssetAudit.test.mjs`에 다음 테스트를 추가한다.

```js
test("frame rules reject a guest that is too tall or starts above the approved top", async () => {
  const pixels = Buffer.alloc(96 * 144 * 4);
  for (let y = 3; y <= 132; y += 1) {
    for (let x = 30; x <= 65; x += 1) {
      pixels.set([37, 24, 18, 255], (y * 96 + x) * 4);
    }
  }

  await withTemporaryPng(96, 144, pixels, async (file) => {
    const inspection = await inspectSheet(file, { frameWidth: 96, frameHeight: 144 });
    const failures = collectFrameRuleFailures(inspection, {
      minimumBoundsTop: 5,
      maximumBoundsHeight: 128
    });

    assert.deepEqual(failures.map((failure) => failure.message), [
      "frame 1 bounds height 130 exceeds 128",
      "frame 1 bounds top 3 is below 5"
    ]);
  });
});
```

144컷 총량과 현재 승인 범위도 다음 테스트로 고정한다.

```js
test("all guest walk sheets contain 144 approved high-density frames", async () => {
  let frameCount = 0;

  for (const preset of guestPresetCatalog.presets) {
    const relative = preset.source.walk.replace(/^character-assets\/source\//, "");
    const inspection = await inspectSheet(join(root, "character-assets/source", relative), {
      frameWidth: 96,
      frameHeight: 144
    });

    assert.equal(inspection.frames.length, 12, preset.id);
    for (const frame of inspection.frames) {
      assert.ok(frame.bounds, preset.id);
      assert.ok(frame.bounds.top >= 5 && frame.bounds.top <= 6, preset.id);
      assert.equal(frame.bounds.bottom, 132, preset.id);
      assert.ok(frame.bounds.height >= 127 && frame.bounds.height <= 128, preset.id);
    }
    frameCount += inspection.frames.length;
  }

  assert.equal(frameCount, 144);
});
```

- [ ] **Step 2: 지원되지 않는 바운딩 규칙 때문에 첫 테스트가 실패하는지 확인한다**

Run:

```bash
node --test --test-name-pattern="too tall|144 approved" scripts/characterAssetAudit.test.mjs
```

Expected: 첫 테스트가 빈 실패 목록 때문에 FAIL하고, 144컷 현황 테스트는 PASS.

- [ ] **Step 3: 감사 라이브러리에 두 바운딩 검사를 추가한다**

`scripts/lib/characterAssetAudit.mjs`의 `checks` 배열에 다음 항목을 추가한다.

```js
{
  key: "maximumBoundsHeight",
  message: (index, actual, expected) =>
    `frame ${index} bounds height ${actual} exceeds ${expected}`,
  measure: (bounds) => bounds.height,
  fails: (actual, expected) => actual > expected
},
{
  key: "minimumBoundsTop",
  message: (index, actual, expected) =>
    `frame ${index} bounds top ${actual} is below ${expected}`,
  measure: (bounds) => bounds.top,
  fails: (actual, expected) => actual < expected
},
```

각 항목은 기존 `minimumBoundsHeight`, `maximumBoundsTop`과 인접하게 배치해 오류 순서를 테스트 기대값과 맞춘다.

- [ ] **Step 4: 품질 규칙과 발 기준선을 승인 원안 값으로 고정한다**

`character-assets/quality-rules.json`의 `guestPreset`에 다음 값을 반영한다.

```json
{
  "minimumBoundsHeight": 127,
  "maximumBoundsHeight": 128,
  "minimumBoundsTop": 5,
  "maximumBoundsTop": 6,
  "minimumBoundsBottom": 132,
  "maximumBoundsBottom": 132
}
```

기존 불투명 픽셀·색상·너비 규칙은 그대로 유지한다. `scripts/audit-character-assets.mjs`의 발 기준선을 다음처럼 강화한다.

```js
const guestPresetFootBaseline = {
  footBottomMin: 132,
  footBottomMax: 132,
  footBottomSpreadMax: 0
};
```

- [ ] **Step 5: 감사 단위 테스트와 실제 144컷 감사를 통과시킨다**

Run:

```bash
node --test scripts/characterAssetAudit.test.mjs
pnpm characters:audit -- --scope=guest-presets
```

Expected: 모든 감사 테스트 PASS, `Auditing character source group: guest-presets`와 `Character asset audit passed` 출력.

- [ ] **Step 6: 승인된 경우에만 체크포인트 커밋을 만든다**

```bash
git add scripts/lib/characterAssetAudit.mjs scripts/characterAssetAudit.test.mjs scripts/audit-character-assets.mjs character-assets/quality-rules.json
git commit -m "test: lock guest frame geometry"
```

사용자 커밋 승인이 없으면 실행하지 않는다.

---

### Task 4: 상하좌우 3컷 전체 리뷰 시트 생성

**Files:**
- Modify: `scripts/render-character-contact-sheet.mjs`
- Modify: `scripts/characterAssetGenerator.test.mjs`
- Create output: `.superpowers/character-review/high-density-guest-v1-all-frames.png`

**Interfaces:**
- Consumes: 각 프리셋의 `preset.generated.walk`, 방향 행 `down/left/right/up`, 열 `0/1/2`
- Produces: `guestPresetWalkSamples(): 48 samples`, 각 샘플에 3개 보행컷과 원안·실제 크기 비교

- [ ] **Step 1: 48개 방향 샘플 계약 테스트를 추가한다**

`scripts/characterAssetGenerator.test.mjs`에 다음 테스트를 추가한다.

```js
test("high-density guest review includes all 144 walk frames", async () => {
  const { guestPresetWalkSamples } = await import("./render-character-contact-sheet.mjs");
  const samples = await guestPresetWalkSamples();

  assert.equal(samples.length, 48);
  assert.equal(samples.reduce((total, sample) => total + sample.frames.length, 0), 144);
  assert.deepEqual(samples[0].frames.map((frame) => frame.step), ["step-01", "step-02", "step-03"]);
  assert.equal(samples[0].direction, "down");
  assert.equal(samples[47].direction, "up");
});
```

파서가 새 모드를 받는지도 추가한다.

```js
test("contact-sheet parser accepts high-density guest review mode", async () => {
  const { parseArguments } = await import("./render-character-contact-sheet.mjs");
  assert.deepEqual(parseArguments(["--mode=guest-walk-review", "--output=review.png"]), {
    mode: "guest-walk-review",
    output: "review.png"
  });
});
```

- [ ] **Step 2: 새 함수와 모드가 없어 테스트가 실패하는지 확인한다**

Run:

```bash
node --test --test-name-pattern="144 walk frames|high-density guest review mode" scripts/characterAssetGenerator.test.mjs
```

Expected: `guestPresetWalkSamples is not a function`과 unknown mode로 FAIL.

- [ ] **Step 3: 48개 방향 샘플을 만든다**

`scripts/render-character-contact-sheet.mjs`에 다음 함수를 추가한다.

```js
export async function guestPresetWalkSamples() {
  return guestPresetCatalog.presets.flatMap((preset) =>
    directions.map((direction) => ({
      label: `${preset.id} / ${preset.label} / ${direction.id}`,
      presetId: preset.id,
      direction: direction.id,
      frames: [0, 1, 2].map((column) => ({
        step: `step-${String(column + 1).padStart(2, "0")}`,
        relative: preset.generated.walk,
        column,
        row: direction.row
      }))
    }))
  );
}
```

`parseArguments` 허용 모드에 `guest-walk-review`를 추가한다.

```js
const allowedModes = new Set(["couple", "guest-presets", "guest-walk-review"]);
if (!allowedModes.has(resolvedMode)) {
  throw new Error(`Unknown contact-sheet mode: ${resolvedMode}`);
}
```

- [ ] **Step 4: 원안과 실제 크기를 함께 보여주는 리뷰 렌더러를 추가한다**

각 3컷을 `96×144` 원안과 `48×72` 실제 크기로 같은 타일에 배치한다. 실제 크기는 브라우저의 고밀도 축소에 가까운 `lanczos3`로 만든다.

```js
async function renderGuestWalkReviewTile(sample, output, sourceChecker, actualChecker) {
  const tileWidth = 452;
  const tileHeight = 198;
  const composites = [{ input: await label(sample.label, tileWidth - 8), left: 4, top: 4 }];
  const ratioGuide = Buffer.from(
    `<svg width="96" height="144" xmlns="http://www.w3.org/2000/svg">` +
      `<line x1="0" y1="48" x2="96" y2="48" stroke="#d1495b" stroke-opacity="0.72"/>` +
      `<line x1="0" y1="90" x2="96" y2="90" stroke="#2a9d8f" stroke-opacity="0.72"/>` +
    `</svg>`
  );

  for (let index = 0; index < sample.frames.length; index += 1) {
    const sampleFrame = sample.frames[index];
    const source = await renderCatalogFrame(sampleFrame);
    const sourceLeft = 4 + index * 148;
    const actual = await sharp(source)
      .resize(48, 72, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();

    composites.push(
      { input: await label(sampleFrame.step, 144), left: sourceLeft, top: 28 },
      { input: sourceChecker, left: sourceLeft, top: 50 },
      { input: source, left: sourceLeft, top: 50 },
      { input: ratioGuide, left: sourceLeft, top: 50 },
      { input: actualChecker, left: sourceLeft + 96, top: 86 },
      { input: actual, left: sourceLeft + 96, top: 86 }
    );
  }

  await sharp({
    create: { width: tileWidth, height: tileHeight, channels: 4, background: sheetBackground }
  }).composite(composites).png({ compressionLevel: 9 }).toFile(output);
}
```

48개 타일은 다음 함수로 3열 × 16행 조합해 최종 크기 `1356×3168`로 저장한다.

```js
async function renderGuestWalkReview(samples, output) {
  const tileWidth = 452;
  const tileHeight = 198;
  const columns = 3;
  const rows = Math.ceil(samples.length / columns);
  const sourceChecker = await checkerboard(96, 144, 8);
  const actualChecker = await checkerboard(48, 72, 4);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "guest-walk-review-"));
  const composites = [];

  try {
    for (let index = 0; index < samples.length; index += 1) {
      const tilePath = join(temporaryDirectory, `tile-${index}.png`);
      await renderGuestWalkReviewTile(samples[index], tilePath, sourceChecker, actualChecker);
      composites.push({
        input: tilePath,
        left: (index % columns) * tileWidth,
        top: Math.floor(index / columns) * tileHeight
      });
    }

    await mkdir(dirname(output), { recursive: true });
    await sharp({
      create: {
        width: columns * tileWidth,
        height: rows * tileHeight,
        channels: 4,
        background: sheetBackground
      }
    }).composite(composites).png({ compressionLevel: 9 }).toFile(output);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
```

`main()`의 샘플 선택과 렌더링 분기를 다음처럼 확장한다.

```js
const samples = mode === "couple"
  ? await coupleSamples()
  : mode === "guest-walk-review"
    ? await guestPresetWalkSamples()
    : await guestPresetSamples();

if (mode === "couple") {
  await renderCouple(samples, output);
} else if (mode === "guest-walk-review") {
  await renderGuestWalkReview(samples, output);
} else {
  await renderCatalog(samples, output);
}
console.log(`Rendered ${samples.length} ${mode} samples to ${output}`);
```

- [ ] **Step 5: 리뷰 렌더러 테스트와 실제 시트 생성을 통과시킨다**

새 CLI 테스트는 출력 크기와 샘플 수를 확인한다.

```js
test("guest walk review renders 48 direction rows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guest-walk-review-"));
  const output = join(dir, "review.png");
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [join(root, "scripts/render-character-contact-sheet.mjs"), "--mode=guest-walk-review", `--output=${output}`],
      { cwd: root }
    );
    const metadata = await sharp(output).metadata();
    assert.match(stdout, /Rendered 48 guest-walk-review samples/);
    assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 1356, height: 3168 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

Run:

```bash
node --test --test-name-pattern="144 walk frames|guest review|48 direction rows" scripts/characterAssetGenerator.test.mjs
pnpm characters:generate
node scripts/render-character-contact-sheet.mjs --mode=guest-walk-review --output=.superpowers/character-review/high-density-guest-v1-all-frames.png
```

Expected: 테스트 PASS, `1356×3168` 리뷰 시트 생성, 144컷 모두 표시.

- [ ] **Step 6: 리뷰 시트를 눈으로 검사한다**

`view_image`로 다음을 확인한다.

- 머리·얼굴이 방향별로 납작하거나 길어지지 않음
- `step-01` 오른발 전진, `step-02` 중립, `step-03` 왼발 전진
- 동일 캐릭터의 키·머리 크기·발 기준선이 일정함
- 48×72 실제 크기에서도 눈·입·헤어와 의상 경계가 구분됨

결함이 없으면 원안은 수정하지 않는다. 결함이 있으면 해당 프레임만 별도 후보 경로에서 보정하고 같은 리뷰를 다시 생성한다.

- [ ] **Step 7: 승인된 경우에만 체크포인트 커밋을 만든다**

```bash
git add scripts/render-character-contact-sheet.mjs scripts/characterAssetGenerator.test.mjs
git commit -m "feat: render full guest walk review"
```

`.superpowers` 리뷰 이미지는 커밋하지 않는다. 사용자 커밋 승인이 없으면 코드도 커밋하지 않는다.

---

### Task 5: 실제 맵 검수와 전체 회귀 확인

**Files:**
- Create local report: `.superpowers/sdd/high-density-guest-rendering-report.md`
- Create review images:
  - `.superpowers/character-review/high-density-guest-v1-mobile-home.png`
  - `.superpowers/character-review/high-density-guest-v1-mobile-ceremony.png`
  - `.superpowers/character-review/high-density-guest-v1-mobile-banquet.png`
  - `.superpowers/character-review/high-density-guest-v1-desktop-home.png`
  - `.superpowers/character-review/high-density-guest-v1-desktop-banquet.png`

**Interfaces:**
- Consumes: Tasks 1~4의 고밀도 런타임·CSS·감사·리뷰 시트
- Produces: 모바일·데스크톱 승인 증거와 전체 테스트 결과

- [ ] **Step 1: 캐릭터 관련 검증을 먼저 실행한다**

Run:

```bash
pnpm characters:audit
pnpm characters:test
pnpm --filter @wedding-game/client test -- src/character/assets.test.ts src/character/frame.test.ts src/components/CharacterSprite.test.tsx src/styles.test.ts
```

Expected: 144프레임 감사와 모든 관련 테스트 PASS.

- [ ] **Step 2: 전체 회귀 검증을 실행한다**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Expected: 전체 테스트·타입 검사·프로덕션 빌드 PASS, 공백 오류 없음.

- [ ] **Step 3: 기존 포트와 충돌하지 않는 로컬 서버를 실행한다**

Run:

```bash
pnpm --filter @wedding-game/client exec vite --host 127.0.0.1 --port 4173
```

Expected: `4173`이 사용 중이면 Vite가 다음 빈 포트를 선택하고 로컬 URL을 출력함.

- [ ] **Step 4: 모바일 실제 맵을 검수한다**

agent-browser에서 `390×844`로 입장한 뒤 우리 집 → 동네 → 지하철 역사 → 지하철 차량 → 예식장 앞 → 로비 → 예식홀 → 연회장을 포털로 이동한다. 우리 집·예식홀·연회장 스크린샷을 지정 경로에 저장하고 다음 표현식을 각 대표 구역에서 검사한다.

```js
JSON.stringify({
  zone: document.querySelector(".world-map__stage")?.dataset.zone,
  sourceWidth: getComputedStyle(document.querySelector(".character-sprite--world"))
    .getPropertyValue("--character-source-width").trim(),
  sourceHeight: getComputedStyle(document.querySelector(".character-sprite--world"))
    .getPropertyValue("--character-source-height").trim(),
  displayWidth: getComputedStyle(document.querySelector(".character-sprite--world"))
    .getPropertyValue("--character-display-width").trim(),
  displayHeight: getComputedStyle(document.querySelector(".character-sprite--world"))
    .getPropertyValue("--character-display-height").trim()
})
```

Expected: `sourceWidth=96px`, `sourceHeight=144px`, `displayWidth=48px`, `displayHeight=72px`. 밝은·어두운·복잡한 배경 모두에서 얼굴과 의상이 구분되고 포털 보행과 페이드가 정상임.

- [ ] **Step 5: 데스크톱 실제 맵을 검수한다**

새 세션에서 `1440×1000`으로 우리 집과 연회장을 확인하고 스크린샷을 저장한다. 캐릭터 크기가 모바일과 동일하고 중앙 프레임·미니맵·조이스틱·메뉴와 겹치지 않아야 한다.

- [ ] **Step 6: 네트워크·콘솔·입력 회귀를 확인한다**

- 고밀도 guest `walk.png`, `idle.png` 요청이 HTTP 200인지 확인한다.
- 런타임 요청에 `/guests/world/` 경로가 없는지 확인한다.
- 이미지 디코딩 오류와 React 콘솔 오류가 없는지 확인한다.
- 미니맵·조이스틱·초대장 메뉴 클릭이 포털 목표 이동을 잘못 발생시키지 않는지 확인한다.

- [ ] **Step 7: 검증 보고서를 작성한다**

`.superpowers/sdd/high-density-guest-rendering-report.md`에 다음 형식으로 기록한다.

```md
# 하객 캐릭터 고밀도 렌더링 검증

- 원안: 12명, 96×144
- 보행 프레임: 144/144
- 월드 표시: 48×72, scale 0.5/0.5
- 자산 감사: PASS
- 캐릭터 테스트: PASS
- 전체 테스트: PASS
- 타입 검사: PASS
- 빌드: PASS
- 모바일 검수: 우리 집/예식홀/연회장 PASS
- 데스크톱 검수: 우리 집/연회장 PASS
- 런타임 `/guests/world/` 요청: 0
- 콘솔 이미지 오류: 0
- 원안 보정: 없음 또는 수정한 정확한 프레임 목록
```

- [ ] **Step 8: 최종 diff 범위와 미추적 원안 보존을 확인한다**

Run:

```bash
git status -sb
git diff --stat
git diff --check
```

Expected: 계획에 명시한 코드·테스트·문서만 변경되고 기존 미추적 캐릭터 원안은 여전히 미추적 상태로 보존됨.

- [ ] **Step 9: 사용자에게 결과를 보고하고 커밋·배포 여부를 확인한다**

보고에는 변경된 런타임 경로, 144컷 감사 결과, 전체 테스트 수, 스크린샷 경로와 남은 시각 위험을 포함한다. 별도 승인 전에는 커밋·푸시·배포하지 않는다.

# 연회장 재생성과 화장실 동선 재배치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로비 오른쪽에서 연회장으로 들어가 화장실까지 이어지는 순차 동선을 만들고, 접합 없는 완전한 원형 테이블 4개를 사용하는 새 연회장 맵을 생성·배포한다.

**Architecture:** 공유 `worldZoneIds`와 realtime 계약을 여정 순서의 단일 기준으로 유지하고, `gardenWorld`·맵 매니페스트를 같은 순서로 맞춘다. 연회장 배경에는 벽·바닥·뷔페만 포함하고, 완전한 테이블 2종을 투명 전경으로 렌더링해 `depthY`로 캐릭터 앞뒤를 결정한다. 포털 그래프는 `예식홀 ↔ 로비 ↔ 연회장 ↔ 화장실`로 바꾸되 기존 3타일 진입, 최단 보행, fade 전환을 재사용한다.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Node.js test runner, Sharp, built-in `image_gen`, PNG/WebP, GitHub Actions Pages

## Global Constraints

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 새 worktree를 만들지 않고 현재 `main` 브랜치와 현재 워크트리에서 순차 실행한다.
- 이미지 생성에는 내장 `image_gen`만 사용하고 CLI/API 이미지 생성으로 전환하지 않는다.
- 이미지 생성은 배경, 꽃 테이블, 식사 테이블 순으로 한 번에 한 자산만 진행한다.
- 기존 연회장 배경이나 잘린 `table-front`를 잘라 붙이거나 부분 보정하지 않는다.
- 연회장 크기 `1200x930`, 화장실 크기 `660x660`을 유지한다.
- 연회장에는 완전한 원형 테이블 4개만 배치하고 좌우 포털 사이의 중앙 가로 통로를 비운다.
- 기존 포털의 3타일 진입, 클릭 최단 경로, 조이스틱 진입과 fade 전환 계약을 유지한다.
- 새 테이블은 완전한 한 개의 원형 테이블과 모든 의자를 포함하고 상하로 분할하지 않는다.
- 이미지 결과에 인물, 글자, 로고, UI, 잘린 가구, 다른 원근이 있으면 저장하지 않고 같은 자산만 재생성한다.
- 관련 없는 미추적 캐릭터 원안 디렉터리는 변경하거나 스테이징하지 않는다.
- 전체 테스트·타입 검사·빌드 후 `origin/main`에 푸시하고 GitHub Pages와 공개 URL을 검증한다.

---

### Task 1: 공유 여정 순서와 realtime 스폰 계약 변경

**Files:**
- Modify: `shared/src/protocol.ts:4-15`
- Modify: `shared/src/validation.test.ts:90-104`
- Modify: `shared/src/realtimeWorld.ts:5-19`
- Modify: `shared/src/realtimeWorld.test.ts:5-18`

**Interfaces:**
- Consumes: `worldZoneIds`, `WorldZoneId`, `RealtimeWorldZoneContract`.
- Produces: `ceremony-hall → banquet → restroom` 순서와 로비에서 들어오는 연회장 기본 스폰 `{ x: 135, y: 465 }`.

- [ ] **Step 1: 새 공유 순서를 요구하는 실패 테스트 작성**

`shared/src/validation.test.ts`의 전체 구역 기대값 마지막 세 항목을 다음으로 바꾼다.

```ts
"ceremony-hall",
"banquet",
"restroom"
```

`shared/src/realtimeWorld.test.ts`의 기대 계약 마지막 세 항목을 다음 순서와 값으로 바꾼다.

```ts
"ceremony-hall": { spawn: { x: 375, y: 1785 }, bounds: { width: 780, height: 1920 } },
banquet: { spawn: { x: 135, y: 465 }, bounds: { width: 1200, height: 930 } },
restroom: { spawn: { x: 135, y: 345 }, bounds: { width: 660, height: 660 } }
```

- [ ] **Step 2: 공유 테스트가 기존 순서와 스폰 때문에 실패하는지 확인**

Run:

```bash
pnpm --filter @wedding-game/shared test
```

Expected: `accepts every guest-route world zone`과 realtime `banquet` 계약이 기존 `restroom → banquet`, `{ x: 585, y: 795 }` 때문에 FAIL.

- [ ] **Step 3: 공유 순서와 realtime 계약 구현**

`shared/src/protocol.ts`의 마지막 세 구역을 다음 순서로 바꾼다.

```ts
"ceremony-hall",
"banquet",
"restroom"
```

`shared/src/realtimeWorld.ts`의 마지막 세 계약을 다음으로 바꾼다.

```ts
"ceremony-hall": { spawn: { x: 375, y: 1785 }, bounds: { width: 780, height: 1920 } },
banquet: { spawn: { x: 135, y: 465 }, bounds: { width: 1200, height: 930 } },
restroom: { spawn: { x: 135, y: 345 }, bounds: { width: 660, height: 660 } }
```

- [ ] **Step 4: 공유 테스트와 타입 검사 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/shared test
pnpm --filter @wedding-game/shared typecheck
```

Expected: shared 34개 테스트와 TypeScript 검사 PASS.

- [ ] **Step 5: 공유 계약 커밋**

```bash
git add shared/src/protocol.ts shared/src/validation.test.ts shared/src/realtimeWorld.ts shared/src/realtimeWorld.test.ts
git commit -m "feat: reorder banquet and restroom journey"
```

---

### Task 2: 연회장 배경과 완전한 테이블 원본 생성

**Files:**
- Replace: `map-assets/reference/v2/banquet/pixel-background-source.png`
- Create: `map-assets/reference/v2/banquet/table-floral-source.png`
- Create: `map-assets/reference/v2/banquet/table-dining-source.png`
- Working files, ignored: `.superpowers/imagegen/banquet/`

**Interfaces:**
- Consumes: Task 1과 무관한 순수 이미지 생성 단계, 최종 배경 비율 `1400x1085`, 마젠타 크로마 제거 helper.
- Produces: Task 3 매니페스트가 빌드할 배경 1개와 투명 테이블 소스 2개.

- [ ] **Step 1: 이미지 생성 작업 디렉터리 준비와 기존 결함 재확인**

Run:

```bash
mkdir -p .superpowers/imagegen/banquet
```

`view_image`로 다음 두 이미지를 표시한다.

```text
.superpowers/map-review/v2/banquet-mobile.png
map-assets/reference/v2/banquet/pixel-background-source.png
```

Expected: 기존 배경의 반원 테이블과 `table-front`의 접합선·잘린 의자를 확인한다. 이 이미지는 생성 입력이나 합성 재료로 사용하지 않는다.

- [ ] **Step 2: 새 연회장 배경을 내장 `image_gen`으로 생성**

다음 프롬프트를 사용하고 `referenced_image_paths`와 `num_last_images_to_include`는 모두 생략한다.

```text
고밀도 모바일 게임 픽셀 아트 웨딩 연회장 전체 맵. 가로 40:31 캔버스, 정사영 탑다운 3/4 시점. 밝은 샴페인 타일 바닥과 민트·코랄 꽃 포인트, 위쪽 벽의 큰 창과 자연광, 긴 뷔페와 음료 코너, 간접 조명과 가랜드. 왼쪽 중앙과 오른쪽 중앙에 서로 같은 높이의 넓은 출입구. 두 출입구 사이에 가구 없는 넓은 가로 통로. 아래 오른쪽 벽에는 작은 축하 메시지 콘솔. 테이블과 의자는 전혀 없음. 인물, 글자, 숫자, 로고, UI 없음. 휘어진 벽, 잘린 가구, 겹친 물체 없음. 모든 핵심 구조는 가장자리에서 충분히 안쪽에 배치.
```

결과를 `view_image`로 확인한다. 다음 중 하나라도 있으면 저장하지 않고 같은 프롬프트에서 문제 항목만 짧게 강조해 재생성한다.

```text
인물 또는 글자 존재
테이블 또는 의자 존재
좌우 출입구 높이 불일치
중앙 가로 통로 단절
뷔페나 창이 프레임에서 잘림
탑다운 3/4가 아닌 시점
```

통과 결과의 도구 응답 `output_hint`가 가리키는 실제 파일을 `.superpowers/imagegen/banquet/background-generated.png`로 복사한다.

- [ ] **Step 3: 배경 소스를 정확한 비율로 정규화하고 검사**

Run:

```bash
node --input-type=module -e 'import sharp from "sharp"; await sharp(".superpowers/imagegen/banquet/background-generated.png").resize({ width: 1400, height: 1085, fit: "cover", position: "centre", kernel: sharp.kernel.nearest }).png().toFile("map-assets/reference/v2/banquet/pixel-background-source.next.png")'
mv map-assets/reference/v2/banquet/pixel-background-source.next.png map-assets/reference/v2/banquet/pixel-background-source.png
```

`view_image`로 정규화된 배경을 다시 확인한다. 좌우 출입구, 위쪽 뷔페, 아래 우측 콘솔과 중앙 통로가 크롭 후에도 온전해야 한다.

- [ ] **Step 4: 꽃 중심 완전 테이블을 내장 `image_gen`으로 생성**

다음 프롬프트를 사용한다.

```text
고밀도 모바일 게임 픽셀 아트 자산 하나. 정사영 탑다운 3/4 시점의 완전한 원형 웨딩 연회 테이블 1개와 금색 의자 8개 전체. 아이보리 테이블보, 세이지와 코랄 꽃 센터피스, 촛대, 흰 접시와 투명 잔. 테이블과 모든 의자 다리가 프레임 안에 완전히 보이고 넉넉한 여백. 바닥과 그림자 없음. 배경은 완전히 균일한 단색 #ff00ff 마젠타이며 그라데이션, 질감, 반사 없음. 피사체에는 네온 마젠타 사용 금지. 인물, 글자, 로고, UI, 추가 테이블 없음.
```

결과를 `view_image`로 확인한다. 테이블이 정확히 1개이고 원형 전체, 의자 8개, 테이블보와 다리가 잘리지 않았으며 배경이 평면 마젠타일 때만 `.superpowers/imagegen/banquet/table-floral-chroma.png`로 복사한다.

- [ ] **Step 5: 식사 중심 완전 테이블을 내장 `image_gen`으로 생성**

다음 프롬프트를 사용한다.

```text
고밀도 모바일 게임 픽셀 아트 자산 하나. 정사영 탑다운 3/4 시점의 완전한 원형 웨딩 연회 테이블 1개와 금색 의자 8개 전체. 샴페인 아이보리 테이블보, 과일과 작은 요리 플래터, 접시, 커트러리, 투명 유리잔, 낮은 흰 꽃 장식. 테이블과 모든 의자 다리가 프레임 안에 완전히 보이고 넉넉한 여백. 바닥과 그림자 없음. 배경은 완전히 균일한 단색 #ff00ff 마젠타이며 그라데이션, 질감, 반사 없음. 피사체에는 네온 마젠타 사용 금지. 인물, 글자, 로고, UI, 추가 테이블 없음.
```

결과를 `view_image`로 확인한다. 꽃 테이블과 같은 시점·크기감이고 테이블 1개와 의자 8개가 모두 온전할 때만 `.superpowers/imagegen/banquet/table-dining-chroma.png`로 복사한다.

- [ ] **Step 6: 두 테이블의 크로마를 투명 알파로 변환**

Run:

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input .superpowers/imagegen/banquet/table-floral-chroma.png --out map-assets/reference/v2/banquet/table-floral-source.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input .superpowers/imagegen/banquet/table-dining-chroma.png --out map-assets/reference/v2/banquet/table-dining-source.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

`view_image`로 두 투명 소스를 표시한다. 가장자리에 마젠타가 남으면 해당 파일만 다음 명령으로 한 번 다시 만든다.

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input .superpowers/imagegen/banquet/table-floral-chroma.png --out map-assets/reference/v2/banquet/table-floral-source.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --edge-contract 1
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input .superpowers/imagegen/banquet/table-dining-chroma.png --out map-assets/reference/v2/banquet/table-dining-source.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --edge-contract 1
```

두 번째 검사에서도 의자나 테이블보가 지워졌거나 마젠타 테두리가 남으면 후처리를 강화하지 않고 해당 테이블을 다시 생성한다.

- [ ] **Step 7: 생성 소스의 크기와 알파 품질 검사**

Run:

```bash
node --input-type=module -e 'import sharp from "sharp"; const background = await sharp("map-assets/reference/v2/banquet/pixel-background-source.png").metadata(); if (background.width !== 1400 || background.height !== 1085) throw new Error(`background ${background.width}x${background.height}`); for (const name of ["table-floral-source.png", "table-dining-source.png"]) { const image = sharp(`map-assets/reference/v2/banquet/${name}`).ensureAlpha(); const { data, info } = await image.raw().toBuffer({ resolveWithObject: true }); const alpha = Array.from({ length: info.width * info.height }, (_, index) => data[index * 4 + 3]); const visible = alpha.filter((value) => value > 0).length / alpha.length; if (!info.channels || alpha[0] !== 0 || alpha.at(-1) !== 0 || visible < 0.12 || visible > 0.85) throw new Error(`${name} alpha coverage ${visible}`); } console.log("banquet source quality passed")'
```

Expected: `banquet source quality passed`.

- [ ] **Step 8: 신규 원본 커밋**

```bash
git add map-assets/reference/v2/banquet/pixel-background-source.png map-assets/reference/v2/banquet/table-floral-source.png map-assets/reference/v2/banquet/table-dining-source.png
git commit -m "art: regenerate banquet map sources"
```

---

### Task 3: 새 연회장 자산 매니페스트와 전경 빌드 통합

**Files:**
- Modify: `scripts/lib/mapAssetAudit.mjs:5-16`
- Modify: `scripts/mapAssetAudit.test.mjs:418-486`
- Modify: `scripts/lib/mapForegroundAuditRenderer.mjs:5-32`
- Modify: `scripts/mapForegroundAuditRenderer.test.mjs:19-23`
- Modify: `map-assets/reference/v2/manifest.json:47-64`
- Modify: `client/src/game/worldVisuals.test.ts:23-28`
- Create: `client/public/assets/maps/v2/banquet/table-floral.png`
- Create: `client/public/assets/maps/v2/banquet/table-dining.png`
- Replace: `client/public/assets/maps/v2/banquet/background.webp`
- Delete: `map-assets/reference/v2/banquet/table-front-source.png`
- Delete: `client/public/assets/maps/v2/banquet/table-front.png`

**Interfaces:**
- Consumes: Task 2의 세 원본 이미지.
- Produces: `background.webp`, `table-floral.png`, `table-dining.png`과 `ceremony-hall → banquet → restroom` 순서의 v2 매니페스트.

- [ ] **Step 1: 새 매니페스트와 4개 완전 테이블 배치를 요구하는 실패 테스트 작성**

`scripts/mapAssetAudit.test.mjs`의 실제 매니페스트 기대값 마지막 세 구역을 다음 순서와 연회장 계약으로 바꾼다.

```js
{
  id: "ceremony-hall",
  background: { source: "pixel-background-source.png", output: "background.webp", width: 780, height: 1920 },
  overlays: [{ source: "aisle-bouquet-front-source.png", output: "aisle-bouquet-front.png", width: 60, height: 90 }],
  requiredArtifacts: ["altar", "ceremony-seat", "aisle", "aisle-bouquet", "candle-light", "entrance-door"]
},
{
  id: "banquet",
  background: { source: "pixel-background-source.png", output: "background.webp", width: 1200, height: 930 },
  overlays: [
    { source: "table-floral-source.png", output: "table-floral.png", width: 240, height: 240 },
    { source: "table-dining-source.png", output: "table-dining.png", width: 240, height: 240 }
  ],
  requiredArtifacts: ["window", "buffet", "central-aisle", "banquet-table", "table-setting", "flower-arrangement", "lobby-door", "restroom-door"]
},
{
  id: "restroom",
  background: { source: "pixel-background-source.png", output: "background.webp", width: 660, height: 660 },
  overlays: [],
  requiredArtifacts: ["mirror", "sink", "terrazzo-floor", "stall", "plant", "door"]
}
```

`scripts/mapForegroundAuditRenderer.test.mjs`에 다음 테스트를 추가한다.

```js
test("composes four complete banquet tables without legacy split fronts", () => {
  assert.deepEqual(DEFAULT_FOREGROUND_PLACEMENTS.banquet, [
    { asset: "table-floral.png", x: 150, y: 120 },
    { asset: "table-dining.png", x: 690, y: 120 },
    { asset: "table-dining.png", x: 150, y: 570 },
    { asset: "table-floral.png", x: 690, y: 570 }
  ]);
  assert.equal(DEFAULT_FOREGROUND_PLACEMENTS.banquet.some(({ asset }) => asset === "table-front.png"), false);
});
```

`client/src/game/worldVisuals.test.ts`의 자산 URL 테스트를 다음으로 바꾼다.

```ts
expect(resolveWorldMapAsset("banquet", "table-floral.png", "./base"))
  .toBe("./base/assets/maps/v2/banquet/table-floral.png");
expect(resolveWorldMapAsset("banquet", "table-dining.png", "./base"))
  .toBe("./base/assets/maps/v2/banquet/table-dining.png");
```

- [ ] **Step 2: 기존 매니페스트와 전경 배치 때문에 테스트가 실패하는지 확인**

Run:

```bash
pnpm maps:test
pnpm --filter @wedding-game/client exec vitest run src/game/worldVisuals.test.ts
```

Expected: 실제 매니페스트 순서·오버레이와 `DEFAULT_FOREGROUND_PLACEMENTS.banquet`가 기존 `table-front.png`를 사용해 FAIL.

- [ ] **Step 3: 자산 순서, 매니페스트와 전경 배치 구현**

`scripts/lib/mapAssetAudit.mjs`의 `DEFAULT_MAP_ZONE_IDS` 마지막 세 값을 다음으로 바꾼다.

```js
"ceremony-hall",
"banquet",
"restroom"
```

`map-assets/reference/v2/manifest.json`의 마지막 세 구역을 Step 1의 계약과 동일하게 바꾼다.

`scripts/lib/mapForegroundAuditRenderer.mjs`의 연회장 배치를 다음으로 바꾸고 객체 순서도 `ceremony-hall`, `banquet`, `restroom`으로 맞춘다.

```js
banquet: [
  { asset: "table-floral.png", x: 150, y: 120 },
  { asset: "table-dining.png", x: 690, y: 120 },
  { asset: "table-dining.png", x: 150, y: 570 },
  { asset: "table-floral.png", x: 690, y: 570 }
],
restroom: []
```

- [ ] **Step 4: 연회장 출력 자산 빌드와 레거시 파일 제거**

Run:

```bash
pnpm maps:build -- --zone banquet
rm -- map-assets/reference/v2/banquet/table-front-source.png client/public/assets/maps/v2/banquet/table-front.png
```

Expected outputs:

```text
client/public/assets/maps/v2/banquet/background.webp        1200x930
client/public/assets/maps/v2/banquet/table-floral.png       240x240 RGBA
client/public/assets/maps/v2/banquet/table-dining.png       240x240 RGBA
```

- [ ] **Step 5: 출력 이미지와 레거시 참조 검사**

`view_image`로 다음 세 이미지를 표시한다.

```text
client/public/assets/maps/v2/banquet/background.webp
client/public/assets/maps/v2/banquet/table-floral.png
client/public/assets/maps/v2/banquet/table-dining.png
```

Run:

```bash
rg -n "table-front" map-assets/reference/v2/manifest.json scripts/lib/mapForegroundAuditRenderer.mjs client/src/game/worldVisuals.test.ts
```

Expected: `rg` 결과 없음. 배경은 테이블이 없고 두 테이블 출력은 완전한 원형과 투명 모서리를 유지한다.

- [ ] **Step 6: 맵 감사와 관련 테스트 통과 확인**

Run:

```bash
pnpm maps:audit
pnpm maps:test
pnpm --filter @wedding-game/client exec vitest run src/game/worldVisuals.test.ts
```

Expected: 10개 맵, 38개 파일 자산 감사와 관련 테스트 PASS. 파일 수는 기존 36개에서 테이블 소스·출력 한 세트가 순증해 38개다.

- [ ] **Step 7: 자산 매니페스트 통합 커밋**

```bash
git add scripts/lib/mapAssetAudit.mjs scripts/mapAssetAudit.test.mjs scripts/lib/mapForegroundAuditRenderer.mjs scripts/mapForegroundAuditRenderer.test.mjs map-assets/reference/v2/manifest.json client/src/game/worldVisuals.test.ts map-assets/reference/v2/banquet client/public/assets/maps/v2/banquet
git commit -m "feat: build complete banquet table assets"
```

---

### Task 4: 월드 그래프, 연회장 배치와 경로 탐색 변경

**Files:**
- Modify: `client/src/game/world.ts:416-616`
- Modify: `client/src/game/world.test.ts:17-900`
- Modify: `client/src/game/pathfinding.test.ts:140-235`

**Interfaces:**
- Consumes: Task 1의 `banquet` 기본 스폰과 Task 3의 `table-floral.png`, `table-dining.png`.
- Produces: `예식홀 ↔ 로비 ↔ 연회장 ↔ 화장실` 포털 그래프, 4개 테이블 충돌·깊이와 좌우 중앙 통로.

- [ ] **Step 1: 새 포털 그래프와 연회장 계약을 요구하는 실패 테스트 작성**

`client/src/game/world.test.ts`의 `requiredEdges`를 다음으로 바꾼다.

```ts
const requiredEdges = [
  ["home", "neighborhood"],
  ["neighborhood", "subway-station"],
  ["subway-station", "subway-train"],
  ["subway-train", "venue-exterior"],
  ["venue-exterior", "lobby"],
  ["lobby", "bridal-room"],
  ["lobby", "ceremony-hall"],
  ["lobby", "banquet"],
  ["banquet", "restroom"]
] as const;
```

로비 포털 기대값에서 기존 화장실 항목을 다음으로 교체한다.

```ts
expect.objectContaining({
  id: "lobby-to-banquet",
  to: "banquet",
  x: 960,
  y: 345,
  width: 90,
  height: 120,
  approach: { x: 975, y: 405 },
  facing: "right",
  spawn: { x: 135, y: 465 }
})
```

예식홀 포털 기대값은 `hall-to-lobby` 한 개만 남긴다. 화장실 포털 기대값은 다음으로 바꾼다.

```ts
expect.objectContaining({
  id: "restroom-to-banquet",
  to: "banquet",
  x: 30,
  y: 285,
  width: 90,
  height: 120,
  approach: { x: 105, y: 345 },
  facing: "left",
  spawn: { x: 1065, y: 465 }
})
```

기존 연회장 계약 테스트를 다음 핵심 값으로 교체한다.

```ts
const tableRects = [
  { x: 150, y: 120, width: 240, height: 240 },
  { x: 690, y: 120, width: 240, height: 240 },
  { x: 150, y: 570, width: 240, height: 240 },
  { x: 690, y: 570, width: 240, height: 240 }
];

expect(banquet.journeyIndex).toBe(8);
expect(banquet.spawn).toEqual({ x: 135, y: 465 });
expect(banquet.paths).toEqual([
  { id: "banquet-floor", kind: "banquet", x: 60, y: 90, width: 1080, height: 750 },
  { id: "banquet-central", kind: "corridor", x: 60, y: 360, width: 1080, height: 210 }
]);
expect(banquet.spots).toEqual([
  expect.objectContaining({ id: "guestbook", x: 990, y: 690, width: 120, height: 90 })
]);
expect(banquet.blocked).toEqual([
  ...tableRects,
  { x: 450, y: 90, width: 300, height: 90 },
  banquet.spots[0]
]);
expect(banquet.portals).toEqual([
  expect.objectContaining({
    id: "banquet-to-lobby",
    to: "lobby",
    x: 30,
    y: 405,
    width: 90,
    height: 120,
    approach: { x: 105, y: 465 },
    facing: "left",
    spawn: { x: 945, y: 405 }
  }),
  expect.objectContaining({
    id: "banquet-to-restroom",
    to: "restroom",
    x: 1080,
    y: 405,
    width: 90,
    height: 120,
    approach: { x: 1095, y: 465 },
    facing: "right",
    spawn: { x: 135, y: 345 }
  })
]);
expect(banquet.decorations.filter((item) => item.kind === "banquet-table")).toEqual([
  expect.objectContaining({ id: "banquet-table-1", ...tableRects[0], asset: "table-floral.png", depthY: 360 }),
  expect.objectContaining({ id: "banquet-table-2", ...tableRects[1], asset: "table-dining.png", depthY: 360 }),
  expect.objectContaining({ id: "banquet-table-3", ...tableRects[2], asset: "table-dining.png", depthY: 810 }),
  expect.objectContaining({ id: "banquet-table-4", ...tableRects[3], asset: "table-floral.png", depthY: 810 })
]);
expect(banquet.decorations.some((item) => item.asset === "table-front.png")).toBe(false);
```

다음 제거 계약도 같은 테스트에 추가한다.

```ts
for (const retiredId of ["hall-to-banquet", "lobby-to-restroom", "banquet-to-hall", "restroom-to-lobby"]) {
  expect(gardenWorld.zones.flatMap((zone) => zone.portals).some((portalItem) => portalItem.id === retiredId)).toBe(false);
}
```

`syncs reverse portal destinations` 테스트의 관련 스폰 기대값을 다음으로 바꾼다.

```ts
const banquet = getWorldZone(gardenWorld, "banquet");
const restroom = getWorldZone(gardenWorld, "restroom");

expect(banquet.portals.find((portalItem) => portalItem.id === "banquet-to-lobby")?.spawn)
  .toEqual({ x: 945, y: 405 });
expect(restroom.portals.find((portalItem) => portalItem.id === "restroom-to-banquet")?.spawn)
  .toEqual({ x: 1065, y: 465 });
```

- [ ] **Step 2: 경로 탐색 테스트를 새 연결에 맞게 변경**

`client/src/game/pathfinding.test.ts`에서 로비 포털 ID 기대값을 다음으로 바꾼다.

```ts
[
  "lobby-to-venue",
  "lobby-to-bridal",
  "lobby-to-banquet",
  "lobby-to-hall"
]
```

예식홀 목표는 로비 포털과 인사 타일만 사용한다.

```ts
const goals = [
  hall.portals.find((portal) => portal.id === "hall-to-lobby")!.approach,
  { x: 285, y: 165 }
];
```

연회장 경로 테스트는 다음 목표를 로비 입장 스폰과 화장실 복귀 스폰 양쪽에서 검사한다.

```ts
const banquet = getWorldZone(gardenWorld, "banquet");
const goals = [
  banquet.portals.find((portal) => portal.id === "banquet-to-lobby")!.approach,
  banquet.portals.find((portal) => portal.id === "banquet-to-restroom")!.approach,
  { x: 975, y: 735 }
];

for (const start of [{ x: 135, y: 465 }, { x: 1065, y: 465 }]) {
  for (const goal of goals) {
    const route = findTilePath(banquet, start, goal);
    expect(route, `banquet ${start.x},${start.y} -> ${goal.x},${goal.y}`).not.toBeNull();
    expect(route?.at(-1)).toEqual(goal);
  }
}
```

화장실 경로 테스트의 포털 ID를 `restroom-to-banquet`로 바꾼다.

- [ ] **Step 3: 기존 포털 그래프와 6개 분할 테이블 때문에 테스트가 실패하는지 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/game/world.test.ts src/game/pathfinding.test.ts
```

Expected: 기존 `lobby-to-restroom`, `hall-to-banquet`, 6개 `table-front.png`와 기존 연회장 스폰 때문에 FAIL.

- [ ] **Step 4: 로비, 예식홀과 화장실 포털 구현**

`client/src/game/world.ts`에서 로비 오른쪽 포털을 다음으로 교체한다.

```ts
portal("lobby-to-banquet", "연회장", "banquet", { x: 960, y: 345, width: 90, height: 120 }, { x: 975, y: 405 }, "right", { x: 135, y: 465 })
```

예식홀 `portals`에는 `hall-to-lobby`만 남긴다.

화장실의 `journeyIndex`, 설명과 포털을 다음으로 바꾼다.

```ts
subtitle: "연회장 옆 밝은 테라조 공간에서 잠시 단정히 준비해요",
journeyIndex: 9,
portals: [
  portal("restroom-to-banquet", "연회장으로 돌아가기", "banquet", { x: 30, y: 285, width: 90, height: 120 }, { x: 105, y: 345 }, "left", { x: 1065, y: 465 })
]
```

화장실 문 장식 라벨도 `연회장 출입문`으로 바꾼다.

- [ ] **Step 5: 새 연회장 데이터 구현**

`banquetZone`을 다음 값으로 교체한다.

```ts
const banquetZone = createZone({
  id: "banquet",
  label: "연회장",
  subtitle: "맛있는 식사와 축하 메시지를 함께 나눠요",
  journeyIndex: 8,
  paths: [
    path("banquet-floor", "banquet", 60, 90, 1080, 750),
    path("banquet-central", "corridor", 60, 360, 1080, 210)
  ],
  spots: [spot("guestbook", "축하 메시지", 990, 690, 120, 90)],
  npcs: [],
  portals: [
    portal("banquet-to-lobby", "로비로 돌아가기", "lobby", { x: 30, y: 405, width: 90, height: 120 }, { x: 105, y: 465 }, "left", { x: 945, y: 405 }),
    portal("banquet-to-restroom", "화장실", "restroom", { x: 1080, y: 405, width: 90, height: 120 }, { x: 1095, y: 465 }, "right", { x: 135, y: 345 })
  ],
  blocked: [
    { x: 150, y: 120, width: 240, height: 240 },
    { x: 690, y: 120, width: 240, height: 240 },
    { x: 150, y: 570, width: 240, height: 240 },
    { x: 690, y: 570, width: 240, height: 240 },
    { x: 450, y: 90, width: 300, height: 90 }
  ],
  decorations: [
    decoration("banquet-table-1", "banquet-table", "꽃 중심 원형 하객 테이블", 150, 120, 240, 240, { asset: "table-floral.png", depthY: 360 }),
    decoration("banquet-table-2", "banquet-table", "식사 중심 원형 하객 테이블", 690, 120, 240, 240, { asset: "table-dining.png", depthY: 360 }),
    decoration("banquet-table-3", "banquet-table", "식사 중심 원형 하객 테이블", 150, 570, 240, 240, { asset: "table-dining.png", depthY: 810 }),
    decoration("banquet-table-4", "banquet-table", "꽃 중심 원형 하객 테이블", 690, 570, 240, 240, { asset: "table-floral.png", depthY: 810 }),
    decoration("banquet-buffet", "buffet", "웨딩 뷔페", 450, 90, 300, 90),
    decoration("banquet-banner", "party-flag", "축하 가랜드", 360, 60, 480, 36),
    decoration("banquet-guestbook-console", "dessert-cart", "축하 메시지 콘솔", 990, 690, 120, 90),
    decoration("banquet-lobby-door", "door", "로비 출입문", 30, 405, 90, 120),
    decoration("banquet-restroom-door", "door", "화장실 출입문", 1080, 405, 90, 120)
  ]
});
```

`gardenWorld.zones` 마지막 세 구역을 다음 순서로 바꾼다.

```ts
ceremonyHallZone,
banquetZone,
restroomZone
```

- [ ] **Step 6: 월드·경로 테스트 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/game/world.test.ts src/game/pathfinding.test.ts
```

Expected: 두 파일의 전체 테스트 PASS. 모든 포털 진입 타일, 양쪽 연회장 스폰, 중앙 통로와 guestbook 접근 경로가 유효함.

- [ ] **Step 7: 월드 그래프 커밋**

```bash
git add client/src/game/world.ts client/src/game/world.test.ts client/src/game/pathfinding.test.ts
git commit -m "feat: route banquet between lobby and restroom"
```

---

### Task 5: GameWorld 실제 이동 흐름과 테이블 깊이 통합

**Files:**
- Modify: `client/src/components/GameWorld.test.tsx:230-280,649-760`

**Interfaces:**
- Consumes: Task 4의 포털 라벨·스폰·테이블 좌표.
- Produces: 실제 화면에서 로비→연회장→화장실→연회장→로비 왕복과 예식홀 독립 복귀를 보장하는 회귀 테스트.

- [ ] **Step 1: 전체 맵 아트워크 순회 테스트를 새 동선으로 변경**

`updates map artwork for every zone reached through the journey`의 로비 이후 순서를 다음으로 바꾼다.

```ts
["신부 대기실", "bridal-room"],
["로비로 돌아가기", "lobby"],
["연회장", "banquet"],
["화장실", "restroom"],
["연회장으로 돌아가기", "banquet"],
["로비로 돌아가기", "lobby"],
["예식홀", "ceremony-hall"]
```

- [ ] **Step 2: 연회장·화장실 통합 실패 테스트 작성**

기존 화장실 왕복 테스트와 예식홀→연회장 테스트를 다음 계약을 검증하는 테스트로 교체한다.

```tsx
it("walks from the lobby through the rebuilt banquet to the restroom and back", () => {
  const { container } = render(<GameWorld profile={profile} />);
  travelFromHomeToLobby();

  travelThroughPortal("연회장");

  const banquet = screen.getByLabelText("연회장 지도");
  const tables = [...container.querySelectorAll('img[data-decoration="banquet-table"]')];
  expect(banquet).toHaveStyle({
    width: "1200px",
    height: "930px",
    transform: "translate3d(0px, -205px, 0) scale(1)"
  });
  expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "465px" });
  expect(tables).toHaveLength(4);
  expect(tables.map((table) => table.getAttribute("src"))).toEqual([
    "/assets/maps/v2/banquet/table-floral.png",
    "/assets/maps/v2/banquet/table-dining.png",
    "/assets/maps/v2/banquet/table-dining.png",
    "/assets/maps/v2/banquet/table-floral.png"
  ]);
  [
    ["150px", "120px", "1360"],
    ["690px", "120px", "1360"],
    ["150px", "570px", "1810"],
    ["690px", "570px", "1810"]
  ].forEach(([left, top, zIndex], index) => {
    expect(tables[index]).toHaveStyle({ left, top, width: "240px", height: "240px", zIndex });
  });
  expect(container.querySelector('img[src*="table-front.png"]')).not.toBeInTheDocument();

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [] }), {
    status: 200,
    headers: { "content-type": "application/json" }
  })));
  fireEvent.click(screen.getByRole("button", { name: /축하 메시지/ }));
  expect(screen.getByRole("dialog", { name: "방명록 우체통" })).toHaveTextContent("축하 메시지");
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));

  travelThroughPortal("화장실");
  expect(screen.getByLabelText("화장실 지도")).toBeInTheDocument();
  expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "345px" });

  travelThroughPortal("연회장으로 돌아가기");
  expect(screen.getByLabelText("연회장 지도")).toBeInTheDocument();
  expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "1065px", top: "465px" });

  travelThroughPortal("로비로 돌아가기");
  expect(screen.getByLabelText("예식장 로비 지도")).toBeInTheDocument();
  expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "945px", top: "405px" });
});
```

예식홀 테스트에는 다음 제거 계약을 추가한다.

```ts
travelThroughPortal("예식홀");
expect(screen.getByLabelText("예식홀 지도")).toBeInTheDocument();
expect(screen.queryByRole("button", { name: "연회장으로" })).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "로비로 돌아가기" })).toBeInTheDocument();
```

- [ ] **Step 3: 기존 GameWorld 흐름 때문에 테스트가 실패하는지 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/components/GameWorld.test.tsx
```

Expected: 기존 로비→화장실, 예식홀→연회장 라벨과 6개 `table-front.png` 기대 때문에 FAIL.

- [ ] **Step 4: 데이터 기반 렌더링으로 테스트 통과 확인**

Task 4 데이터가 완전하면 프로덕션 컴포넌트 추가 수정 없이 새 포털·테이블이 렌더링된다. 실패가 있으면 하드코딩된 구역 ID나 포털 라벨만 `GameWorld.tsx`에서 제거하고 새로운 분기 로직은 추가하지 않는다.

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/components/GameWorld.test.tsx src/components/WorldMiniMap.test.tsx
```

Expected: GameWorld 48개와 WorldMiniMap 2개 테스트 PASS.

- [ ] **Step 5: 화면 흐름 테스트 커밋**

```bash
git add client/src/components/GameWorld.test.tsx client/src/components/GameWorld.tsx
git diff --cached --quiet client/src/components/GameWorld.tsx || true
git commit -m "test: cover banquet restroom portal flow"
```

`GameWorld.tsx`가 변경되지 않았다면 스테이징에는 테스트 파일만 포함되는지 `git diff --cached --stat`로 확인한 뒤 커밋한다.

---

### Task 6: 전체 감사, 시각 검증과 GitHub Pages 배포

**Files:**
- Verify: `map-assets/reference/v2/banquet/`
- Verify: `client/public/assets/maps/v2/banquet/`
- Generate ignored review: `.superpowers/map-review/v2/banquet-restroom-redesign-foreground-audit.png`
- Generate ignored review: `.superpowers/map-review/v2/banquet-redesign-{desktop,mobile,landscape}.png`
- Verify: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: Tasks 1-5의 공유 순서, 이미지, 월드 그래프와 화면 테스트.
- Produces: 자동·시각 검증을 통과하고 공개 GitHub Pages에 배포된 새 연회장 동선.

- [ ] **Step 1: 전경 감사 시트 생성과 눈검사**

Run:

```bash
pnpm maps:foreground-audit -- --out .superpowers/map-review/v2/banquet-restroom-redesign-foreground-audit.png
```

`view_image`로 감사 시트를 표시하고 다음을 확인한다.

```text
연회장 배경에 테이블이 중복되어 있지 않음
완전한 테이블 4개와 모든 의자가 보임
상단·하단 접합선과 잘린 반원이 없음
꽃/식사 테이블이 대각선으로 배치됨
좌우 출입구와 중앙 통로가 가구에 막히지 않음
```

문제가 있으면 원인이 배경이면 Task 2 Step 2-3, 특정 테이블이면 Task 2 Step 4 또는 5-7로 돌아가 해당 자산만 다시 생성하고 Task 3 빌드를 반복한다.

- [ ] **Step 2: 전체 자동 검증**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Expected: 맵 10개·38개 파일 감사, 맵 테스트, 캐릭터 감사·77개 테스트, shared·client·worker 테스트, 전체 TypeScript와 프로덕션 빌드 exit code 0.

- [ ] **Step 3: 로컬 프리뷰 실행**

Run:

```bash
pnpm --filter @wedding-game/client exec vite preview --host 127.0.0.1 --port 58862
```

Expected: `http://127.0.0.1:58862/`에서 프로덕션 빌드 제공. 포트가 이미 사용 중이면 `58863`을 사용하고 이후 브라우저 URL도 동일하게 바꾼다.

- [ ] **Step 4: 데스크톱·모바일·가로 화면 시각 검증**

`agent-browser`의 별도 세션에서 닉네임 `연회장검증`으로 입장하고 포털 클릭으로 로비까지 이동한다. 다음 세 뷰포트에서 로비→연회장→화장실→연회장→로비를 왕복한다.

```text
1440x900  → .superpowers/map-review/v2/banquet-redesign-desktop.png
390x844   → .superpowers/map-review/v2/banquet-redesign-mobile.png
844x390   → .superpowers/map-review/v2/banquet-redesign-landscape.png
```

각 화면에서 다음을 확인한다.

```text
로비 오른쪽 연회장 포털이 출입구 중앙과 일치
연회장 좌우 포털이 각각 좌우 출입구와 일치
테이블 4개가 완전하고 중복·접합선·잘린 의자가 없음
캐릭터가 위쪽/아래쪽 테이블의 depthY 앞뒤에서 올바르게 가려짐
중앙 통로를 포털 클릭과 조이스틱 키 입력으로 통과 가능
화장실 복귀 포털의 목적지가 연회장
예식홀에 연회장 포털이 없음
미니맵·조이스틱·초대장 메뉴 클릭이 맵 이동을 일으키지 않음
브라우저 console/error 없음
```

`view_image`로 세 스크린샷을 각각 표시해 눈검사를 마친다.

- [ ] **Step 5: 최종 범위와 커밋 확인**

Run:

```bash
git status -sb
git diff origin/main...HEAD --stat
git log --oneline origin/main..HEAD
```

Expected: 설계·계획 문서, 공유 순서, 연회장 이미지, 매니페스트, 월드 데이터와 관련 테스트만 포함. 기존 미추적 캐릭터 원안은 그대로 남고 스테이징되지 않음.

- [ ] **Step 6: `main` 푸시와 Pages 완료 대기**

Run:

```bash
git push origin main
run_id=$(gh run list --workflow pages.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$run_id" --exit-status
```

Expected: `Deploy client to GitHub Pages`의 테스트, 빌드와 deploy 단계가 모두 success.

- [ ] **Step 7: 공개 URL과 라이브 동선 확인**

Run:

```bash
curl -fsSI https://po-mato.github.io/pixel-garden-invitation/
```

Expected: HTTP 200.

새 `agent-browser` 세션에서 다음 URL을 열고 로비→연회장→화장실을 이동한다.

```text
https://po-mato.github.io/pixel-garden-invitation/
```

라이브 DOM에서 다음을 확인한다.

```text
연회장 table-floral.png 2개
연회장 table-dining.png 2개
table-front.png 0개
연회장 포털 2개, 화장실 포털 1개
연회장 좌우 진입 영역 각각 30x90, 타일 3개
브라우저 오류 0개
```

- [ ] **Step 8: 최종 커밋 일치 확인과 로컬 프로세스 정리**

Run:

```bash
git rev-parse HEAD
git rev-parse origin/main
git status -sb
```

Expected: `HEAD`와 `origin/main`이 동일하고 추적 파일은 깨끗함. 검증용 브라우저 세션과 Vite preview를 종료하고, 기존 미추적 캐릭터 원안은 그대로 유지한다.

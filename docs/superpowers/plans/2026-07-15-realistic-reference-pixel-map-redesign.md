# 사실적 레퍼런스 기반 픽셀 맵 전면 재설계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사실적 공간 레퍼런스를 기반으로 10개 맵의 배경·핵심 아티팩트·동선·포털·미니맵을 고밀도 픽셀 아트로 전면 재구성한다.

**Architecture:** 맵별 정적 건축물과 아티팩트는 로컬 픽셀 배경에 포함하고, 캐릭터를 가려야 하는 핵심 오브젝트만 투명 PNG 깊이 레이어로 분리한다. `world.ts`의 타일 경로를 실제 보행 가능 영역으로 사용하고, 기존 포털 상태 머신·카메라·실시간 동기화는 유지한다. 이미지 소스와 앱용 자산은 manifest와 Sharp 기반 검사로 연결한다.

**Tech Stack:** React 18, TypeScript, Vite, CSS, Vitest, Testing Library, Sharp, Node.js, 내장 `image_gen`

## Global Constraints

- 모든 작업은 `/Users/sjlee/Documents/New project 5`의 현재 브랜치와 현재 워크트리에서 수행한다.
- 새 worktree를 만들지 않는다.
- 사용자가 별도로 요청하기 전에는 커밋하거나 푸시하지 않는다.
- 기존 미추적 캐릭터 원안 디렉터리를 수정, 삭제, 스테이징하지 않는다.
- 생성 이미지에는 내장 `image_gen`만 사용한다. CLI 또는 외부 API 이미지 생성 경로를 사용하지 않는다.
- 한 번에 한 맵만 생성·검수·통합하고, 실패 결과는 프로젝트에 저장하지 않는다.
- 사실적 레퍼런스는 앱에 직접 노출하지 않고 최종 앱에는 고밀도 픽셀 자산만 사용한다.
- 모든 맵은 정사영에 가까운 탑다운 3/4 시점과 좌상단 자연광 방향을 공유한다.
- 인물, 읽을 수 있는 문구, 로고, UI 설명을 맵 이미지에 포함하지 않는다.
- 배경을 CSS 비균등 확대·축소로 찌그러뜨리지 않는다.
- 기존 4방향 캐릭터, `30px` 타일 이동, 포털 도착 지연·페이드, 미니맵 표시 전용 동작을 유지한다.
- 조이스틱, 초대장 메뉴, 미니맵 입력은 월드 클릭 이동으로 전달되지 않아야 한다.
- 모든 프로젝트 문서와 사용자 응답은 한국어로 작성한다.

---

### Task 1: 맵 이미지 URL과 배경 렌더러

**Files:**
- Create: `client/src/game/worldVisuals.ts`
- Create: `client/src/game/worldVisuals.test.ts`
- Create: `client/src/components/WorldMapArtwork.tsx`
- Create: `client/src/components/WorldMapArtwork.test.tsx`
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/components/GameWorld.test.tsx`
- Modify: `client/src/styles.css`

**Interfaces:**
- Consumes: `WorldZoneId`, `import.meta.env.BASE_URL`
- Produces: `resolveWorldVisual(zoneId, baseUrl)`, `resolveWorldMapAsset(zoneId, fileName, baseUrl)`, `WorldMapArtwork`

- [x] **Step 1: URL과 10개 시각 설정에 대한 실패 테스트를 작성한다**

```ts
expect(resolveWorldVisual("home", "./base/")).toEqual({
  backgroundUrl: "./base/assets/maps/v2/home/background.webp",
  fallbackColor: "#d8c6b4",
  effects: ["window-light"]
});
expect(resolveWorldMapAsset("banquet", "table-front.png", "./base/"))
  .toBe("./base/assets/maps/v2/banquet/table-front.png");
expect(worldVisualZoneIds).toEqual(worldZoneIds);
```

`WorldMapArtwork` 테스트는 배경 이미지의 `src`, 빈 `alt`, `draggable="false"`, 오류 발생 후 `hidden` 상태를 검증한다.

- [x] **Step 2: 테스트를 실행해 모듈 부재로 실패하는지 확인한다**

Run: `pnpm --filter @wedding-game/client test -- worldVisuals.test.ts WorldMapArtwork.test.tsx`

Expected: 두 신규 모듈을 찾을 수 없어 FAIL.

- [x] **Step 3: 시각 설정과 URL 해석기를 구현한다**

```ts
import { worldZoneIds, type WorldZoneId } from "@wedding-game/shared";

export type WorldVisualEffect =
  | "window-light" | "leaf-shadow" | "station-glow" | "city-motion"
  | "garden-petals" | "lobby-glint" | "bridal-sparkle"
  | "aisle-light" | "mirror-glint" | "banquet-light";

type WorldVisualDefinition = {
  fallbackColor: string;
  effects: WorldVisualEffect[];
};

const definitions: Record<WorldZoneId, WorldVisualDefinition> = {
  home: { fallbackColor: "#d8c6b4", effects: ["window-light"] },
  neighborhood: { fallbackColor: "#9eb79e", effects: ["leaf-shadow"] },
  "subway-station": { fallbackColor: "#c8d2cf", effects: ["station-glow"] },
  "subway-train": { fallbackColor: "#d8ddd7", effects: ["city-motion"] },
  "venue-exterior": { fallbackColor: "#adc49f", effects: ["garden-petals"] },
  lobby: { fallbackColor: "#dedbd2", effects: ["lobby-glint"] },
  "bridal-room": { fallbackColor: "#e7d8d8", effects: ["bridal-sparkle"] },
  "ceremony-hall": { fallbackColor: "#536e5e", effects: ["aisle-light"] },
  restroom: { fallbackColor: "#d6e5e1", effects: ["mirror-glint"] },
  banquet: { fallbackColor: "#d9cfb9", effects: ["banquet-light"] }
};

const withTrailingSlash = (baseUrl: string) => baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

export const worldVisualZoneIds = [...worldZoneIds];

export function resolveWorldMapAsset(zoneId: WorldZoneId, fileName: string, baseUrl = import.meta.env.BASE_URL) {
  return `${withTrailingSlash(baseUrl)}assets/maps/v2/${zoneId}/${fileName}`;
}

export function resolveWorldVisual(zoneId: WorldZoneId, baseUrl = import.meta.env.BASE_URL) {
  return {
    backgroundUrl: resolveWorldMapAsset(zoneId, "background.webp", baseUrl),
    ...definitions[zoneId]
  };
}
```

- [x] **Step 4: 배경 렌더러를 구현한다**

```tsx
import type { WorldZoneId } from "@wedding-game/shared";
import { resolveWorldVisual } from "../game/worldVisuals";

export function WorldMapArtwork({ zoneId }: { zoneId: WorldZoneId }) {
  const visual = resolveWorldVisual(zoneId);
  return (
    <div className="world-map-artwork" style={{ backgroundColor: visual.fallbackColor }} aria-hidden="true">
      <img
        className="world-map-artwork__background"
        src={visual.backgroundUrl}
        alt=""
        draggable={false}
        onError={(event) => { event.currentTarget.hidden = true; }}
      />
      {visual.effects.map((effect) => (
        <span key={effect} className={`world-map-effect world-map-effect--${effect}`} />
      ))}
    </div>
  );
}
```

- [x] **Step 5: `GameWorld` 스테이지 첫 자식으로 배경을 연결한다**

`world-map__stage` 내부에서 경로보다 먼저 `<WorldMapArtwork zoneId={activeZone.id} />`를 렌더링한다. `GameWorld.test.tsx`에는 모든 구역 전환 후 `background.webp` URL이 현재 구역 ID를 포함하는지 검증하는 assertion을 추가한다.

- [x] **Step 6: 배경의 안정적인 크기와 픽셀 렌더링 CSS를 추가한다**

```css
.world-map-artwork,
.world-map-artwork__background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.world-map-artwork { z-index: 0; overflow: hidden; pointer-events: none; }
.world-map-artwork__background { object-fit: fill; image-rendering: pixelated; }
.world-map-effect { position: absolute; pointer-events: none; }
```

- [x] **Step 7: 관련 테스트를 통과시킨다**

Run: `pnpm --filter @wedding-game/client test -- worldVisuals.test.ts WorldMapArtwork.test.tsx GameWorld.test.tsx`

Expected: 신규 배경 URL, 폴백, 오류 숨김, `GameWorld` 연결 테스트 PASS.

---

### Task 2: 투명 아티팩트 깊이 레이어

**Files:**
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/worldVisuals.ts`
- Modify: `client/src/game/worldVisuals.test.ts`
- Modify: `client/src/components/WorldDecoration.tsx`
- Create: `client/src/components/WorldDecoration.test.tsx`
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/components/GameWorld.test.tsx`
- Modify: `client/src/styles.css`

**Interfaces:**
- Consumes: `WorldDecoration.asset`, `WorldDecoration.depthY`, 현재 구역 ID
- Produces: `worldDepth(y)`, 이미지 기반 `WorldDecoration`, 캐릭터와 오브젝트의 공통 깊이 정렬

- [x] **Step 1: 자산 장식과 깊이 계산 실패 테스트를 작성한다**

```ts
expect(worldDepth(345)).toBe(1345);
expect(worldDepth(Number.NaN)).toBe(1000);
```

컴포넌트 테스트는 `asset: "tree-canopy.png"`, `depthY: 390`인 장식이 현재 구역 URL과 `z-index: 1390`을 갖는 `<img>`를 렌더링하고, `asset`이 없는 장식은 DOM을 만들지 않는지 확인한다.

- [x] **Step 2: 테스트를 실행해 새 필드 부재로 실패하는지 확인한다**

Run: `pnpm --filter @wedding-game/client test -- worldVisuals.test.ts WorldDecoration.test.tsx`

Expected: `asset`, `depthY`, `worldDepth` 부재로 FAIL.

- [x] **Step 3: 장식 타입과 깊이 함수를 추가한다**

```ts
export type WorldDecoration = Rect & {
  id: string;
  kind: WorldDecorationKind;
  label: string;
  asset?: string;
  depthY?: number;
};

export function worldDepth(y: number): number {
  return 1000 + Math.max(0, Math.round(Number.isFinite(y) ? y : 0));
}
```

`decoration()` helper의 마지막 인자로 `visual?: { asset: string; depthY: number }`를 받아 반환 객체에 병합한다.

- [x] **Step 4: 이미지 장식 컴포넌트를 구현한다**

```tsx
export function WorldDecoration({ zoneId, decoration }: {
  zoneId: WorldZoneId;
  decoration: WorldDecorationData;
}) {
  if (!decoration.asset) return null;
  const depthY = decoration.depthY ?? decoration.y + decoration.height;
  return (
    <img
      className="world-decoration world-decoration--asset"
      data-decoration={decoration.kind}
      data-decoration-label={decoration.label}
      src={resolveWorldMapAsset(zoneId, decoration.asset)}
      alt=""
      draggable={false}
      aria-hidden="true"
      style={{
        left: decoration.x,
        top: decoration.y,
        width: decoration.width,
        height: decoration.height,
        zIndex: worldDepth(depthY)
      }}
      onError={(event) => { event.currentTarget.hidden = true; }}
    />
  );
}
```

- [x] **Step 5: 모든 월드 인물에 같은 깊이 기준을 적용한다**

`GameWorld.tsx`에서 장식 wrapper를 제거하고 장식을 스테이지 직접 자식으로 렌더링한다. 로컬·원격 캐릭터와 NPC에는 각각 `zIndex: worldDepth(y)`를 적용한다. 포털과 정보 버튼은 `z-index: 9000`, 미니맵과 HUD는 기존 상위 레이어를 유지한다.

- [x] **Step 6: 픽셀 아티팩트 CSS를 적용한다**

```css
.world-decoration--asset {
  position: absolute;
  display: block;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
}
```

- [x] **Step 7: 깊이와 입력 회귀 테스트를 통과시킨다**

Run: `pnpm --filter @wedding-game/client test -- WorldDecoration.test.tsx GameWorld.test.tsx`

Expected: 자산 장식, 캐릭터 깊이, 포털·UI 입력 차단 테스트 PASS.

---

### Task 3: 경로를 실제 보행 가능 영역으로 사용

**Files:**
- Modify: `client/src/game/geometry.ts`
- Modify: `client/src/game/geometry.test.ts`
- Modify: `client/src/game/pathfinding.ts`
- Modify: `client/src/game/pathfinding.test.ts`
- Modify: `client/src/game/world.test.ts`

**Interfaces:**
- Consumes: `WorldZone.paths`, `WorldZone.blocked`
- Produces: `isWalkable(point, world)`, 경로 밖 이동 차단, 모든 포털의 검증된 A* 경로

- [x] **Step 1: 경로 밖과 장애물 이동을 구분하는 실패 테스트를 작성한다**

```ts
expect(isWalkable({ x: 225, y: 405 }, home)).toBe(true);
expect(isBlocked({ x: 45, y: 45 }, home)).toBe(true);
expect(isBlocked(home.spawn, home)).toBe(false);
```

각 구역에서 `spawn → 모든 portal.approach`의 `findTilePath()`가 `null`이 아니며, 경로의 모든 점이 `isBlocked`를 통과하지 않는지도 검사한다.

- [x] **Step 2: 테스트를 실행해 경로 밖 이동이 허용되는 현재 동작으로 실패하는지 확인한다**

Run: `pnpm --filter @wedding-game/client test -- geometry.test.ts pathfinding.test.ts world.test.ts`

Expected: 경로 밖 점이 차단되지 않아 FAIL.

- [x] **Step 3: 보행 가능 판정을 구현한다**

```ts
export function isWalkable(point: Point, world: WorldZone): boolean {
  return world.paths.some((path) => pointInRect(point, path));
}

export function isBlocked(point: Point, world: WorldZone): boolean {
  return !isWalkable(point, world) || world.blocked.some((rect) => pointInRect(point, rect));
}
```

`pathfinding.ts`도 개별 `zone.blocked.some(...)` 대신 `isBlocked(point, zone)`을 사용한다. 시작점이나 목표가 차단 상태면 `null`을 반환하고 강제로 walkable 상태로 덮어쓰지 않는다.

- [x] **Step 4: 이동·경로·월드 테스트를 통과시킨다**

Run: `pnpm --filter @wedding-game/client test -- geometry.test.ts movement.test.ts pathfinding.test.ts world.test.ts`

Expected: 경로 내부 이동과 모든 포털 A* 경로 테스트 PASS.

---

### Task 4: 맵 자산 manifest, 빌드, 감사 도구

**Files:**
- Create: `map-assets/reference/v2/manifest.json`
- Create: `scripts/lib/mapAssetAudit.mjs`
- Create: `scripts/mapAssetAudit.test.mjs`
- Create: `scripts/build-map-assets.mjs`
- Create: `scripts/audit-map-assets.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: 맵별 레퍼런스·픽셀 배경·투명 오버레이 원본
- Produces: `client/public/assets/maps/v2/<zone>/background.webp`, 투명 PNG 오버레이, `maps:build`, `maps:audit`

- [x] **Step 1: 임시 이미지로 manifest 감사 실패 테스트를 작성한다**

테스트 fixture는 Sharp로 `60x90` 배경과 투명 `12x18` 오버레이를 만들고 다음을 검증한다.

```js
assert.equal(result.errors.length, 0);
assert.deepEqual(result.zoneIds, ["home"]);
assert.match(missingResult.errors[0], /background\.webp/);
assert.match(wrongSizeResult.errors[0], /크기/);
assert.match(opaqueOverlayResult.errors[0], /알파/);
```

- [x] **Step 2: 테스트를 실행해 감사 모듈 부재로 실패하는지 확인한다**

Run: `node --test scripts/mapAssetAudit.test.mjs`

Expected: `scripts/lib/mapAssetAudit.mjs` 부재로 FAIL.

- [x] **Step 3: manifest를 정확한 10개 구역과 출력 크기로 작성한다**

| 구역 | 최종 크기 | 깊이 오버레이와 출력 크기 | `requiredArtifacts` |
|---|---:|---|---|
| `home` | `600x720` | `topiary-foreground.png` `60x90` | `window`, `sofa`, `table`, `shoe-rack`, `door`, `topiary` |
| `neighborhood` | `1200x660` | `tree-canopy.png` `90x150` | `tree`, `street-lamp`, `bench`, `crosswalk`, `flower-bed`, `station-entrance` |
| `subway-station` | `900x840` | `ticket-gate-front.png` `60x120` | `route-band`, `ticket-gate`, `bench`, `safety-line`, `platform-door` |
| `subway-train` | `1440x540` | `strap-row-foreground.png` `960x120` | `city-window`, `teal-seat`, `strap`, `ceiling-light`, `train-door` |
| `venue-exterior` | `960x900` | `flower-arch-front.png` `240x180` | `stone-facade`, `glass-door`, `flower-arch`, `water-feature`, `flower-bed`, `tree` |
| `lobby` | `1080x900` | `reception-desk-front.png` `180x120` | `reception-desk`, `gift-desk`, `photo-wall`, `sofa`, `flower-arrangement`, `hall-door` |
| `bridal-room` | `720x630` | `flower-arrangement-front.png` `90x120` | `flower-wall`, `ivory-sofa`, `vanity`, `mirror`, `flower-arrangement`, `door` |
| `ceremony-hall` | `780x1920` | `aisle-bouquet-front.png` `60x90` | `altar`, `ceremony-seat`, `aisle`, `aisle-bouquet`, `candle-light`, `entrance-door` |
| `restroom` | `660x660` | `stall-front.png` `150x240` | `mirror`, `sink`, `terrazzo-floor`, `stall`, `plant`, `door` |
| `banquet` | `1200x930` | `table-front.png` `180x180` | `banquet-table`, `table-setting`, `buffet`, `dessert-cart`, `window`, `garland` |

모든 배경 원본 파일명은 `pixel-background-source.png`다. 소스 경로는 `map-assets/reference/v2/<zone>/`, 출력 경로는 `client/public/assets/maps/v2/<zone>/`로 고정한다.

- [x] **Step 4: Sharp 기반 빌드와 감사를 구현한다**

`build-map-assets.mjs --zone <id>`는 배경을 manifest 크기로 `fit: cover`, `kernel: nearest` 처리해 lossless WebP로 만들고, 오버레이는 manifest의 장식 표시 크기에 `fit: contain`, 투명 배경으로 PNG 출력한다. 입력과 출력 종횡비 차이가 `3%`를 넘으면 빌드를 실패시켜 강제 크롭을 막는다.

`mapAssetAudit.mjs`는 다음을 반환한다.

```js
export async function auditMapAssets({ rootDir, manifestPath }) {
  return { zoneIds, errors, files };
}
```

검사 항목은 10개 ID 순서, 소스 존재, 앱 배경 크기, 오버레이 알파 채널, manifest 중복, 요구 아티팩트 4개 이상이다.

- [x] **Step 5: package script를 추가하되 전체 build/test 연결은 Task 15까지 보류한다**

```json
"maps:build": "node scripts/build-map-assets.mjs",
"maps:audit": "node scripts/audit-map-assets.mjs",
"maps:test": "node --test scripts/mapAssetAudit.test.mjs"
```

- [x] **Step 6: 감사 도구 단위 테스트를 통과시킨다**

Run: `pnpm maps:test`

Expected: 정상 fixture PASS, 누락·크기·알파 오류 fixture가 기대 메시지로 검출됨.

---

## 맵별 공통 제작 순서

Task 5부터 Task 14까지는 각 맵에서 다음 순서를 반복하되 서로의 생성물을 한 호출에 섞지 않는다.

1. 내장 `image_gen`으로 사실적 레퍼런스를 생성한다.
2. 결과를 눈으로 검사하고 합격한 결과만 `realistic-reference.png`로 복사한다.
3. 레퍼런스를 첨부해 픽셀 배경을 생성한다.
4. 결과를 눈으로 검사하고 합격한 결과만 `pixel-background-source.png`로 복사한다.
5. 픽셀 배경을 첨부해 지정된 투명 깊이 오버레이 하나를 생성한다.
6. 배경이 실제 투명하고 시점·광원·픽셀 밀도가 일치하는지 확인한 뒤 저장한다.
7. `pnpm maps:build -- --zone <id>`를 실행하고 앱용 배경과 오버레이를 `view_image`로 확인한다.
8. 아래의 정확한 월드 좌표로 해당 구역 데이터와 테스트를 교체한다.
9. 맵 단위 테스트와 로컬 브라우저 검수를 통과한 뒤 다음 맵으로 이동한다.

이미지 생성 결과가 인물, 가짜 문구, 잘린 출입구, 다른 시점, 흐린 필터형 픽셀, 심한 반복을 포함하면 저장하지 않고 같은 호출 단위만 재시도한다.

---

### Task 5: 우리 집 제작과 통합

**Files:**
- Create: `map-assets/reference/v2/home/realistic-reference.png`
- Create: `map-assets/reference/v2/home/pixel-background-source.png`
- Create: `map-assets/reference/v2/home/topiary-foreground-source.png`
- Create: `client/public/assets/maps/v2/home/background.webp`
- Create: `client/public/assets/maps/v2/home/topiary-foreground.png`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`

**Interfaces:**
- Produces: `home` `600x720` 맵과 `home-to-neighborhood` 포털

- [ ] **Step 1: 다음 사실적 레퍼런스 프롬프트로 이미지를 생성·검수한다**

```text
인물 없는 한국의 소형 아파트 현관과 거실, 정사영에 가까운 탑다운 3/4 건축 시각화, 아침 햇살, 원목 바닥과 현관 타일, 낮은 소파, 작은 테이블, 신발장, 창가 식물, 위쪽 중앙 현관문까지 넓고 명확한 보행 통로, 세로형 구도, 글자와 로고 없음
```

- [ ] **Step 2: 픽셀 배경과 투명 토피어리 오버레이를 생성·검수한다**

```text
이 공간을 모바일 게임용 고밀도 픽셀 아트 맵으로 다시 그린다. 같은 탑다운 3/4 시점과 조명, 선명한 픽셀 가장자리, 캐릭터가 걸을 중앙 통로 확보, 인물·글자·UI 없음.
```

```text
같은 맵의 현관 토피어리 화분 하나만 고밀도 픽셀 아트 투명 PNG 오브젝트로 분리한다. 원본과 같은 시점·크기·광원, 배경과 바닥 없음.
```

- [ ] **Step 3: 새 크기와 포털 좌표를 기대하는 실패 테스트를 작성하고 실행한다**

`home` 기대값: bounds `600x720`, spawn `(285,555)`, 포털 approach `(285,105)`, 대상 spawn `(135,375)`.

Run: `pnpm --filter @wedding-game/client test -- world.test.ts`

Expected: 기존 `480x600` 데이터로 FAIL.

- [ ] **Step 4: 다음 데이터로 `homeZone`을 교체한다**

- paths: `floor(90,120,420,510)`, `entry(240,60,120,120)`; 두 path kind는 `floor`.
- spot: `directions(90,180,120,90)`.
- explicit blocked: `sofa(360,240,150,90)`, `table(270,330,120,90)`, `shoe-rack(90,480,120,120)`, `topiary(420,480,60,90)`.
- portal rect: `(240,30,120,90)`, approach `(285,105)`, facing `up`, destination spawn `(135,375)`.
- asset decoration: topiary `(420,480,60,90)`, asset `topiary-foreground.png`, depthY `555`.

- [ ] **Step 5: 빌드·테스트·브라우저 검수를 완료한다**

Run: `pnpm maps:build -- --zone home && pnpm --filter @wedding-game/client test -- world.test.ts GameWorld.test.tsx`

Expected: `home` 배경 `600x720`, 포털 경로, 캐릭터/토피어리 깊이 PASS.

---

### Task 6: 동네 거리 제작과 통합

**Files:**
- Create: `map-assets/reference/v2/neighborhood/realistic-reference.png`
- Create: `map-assets/reference/v2/neighborhood/pixel-background-source.png`
- Create: `map-assets/reference/v2/neighborhood/tree-canopy-source.png`
- Create: `client/public/assets/maps/v2/neighborhood/background.webp`
- Create: `client/public/assets/maps/v2/neighborhood/tree-canopy.png`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`

**Interfaces:**
- Produces: `neighborhood` `1200x660` 횡형 맵과 양방향 포털

- [ ] **Step 1: 다음 프롬프트로 레퍼런스·픽셀 배경·나무 캐노피를 순서대로 생성한다**

```text
인물 없는 봄날 한국 주택가와 작은 상점 거리, 정사영 탑다운 3/4 건축 시각화, 벽돌 보도와 차도, 횡단보도, 가로수, 카페 외벽, 다채로운 화단, 좌우 끝이 연결된 넓은 보행로, 긴 가로형 구도, 글자와 로고 없음
```

```text
이 거리를 밝고 세밀한 모바일 게임용 고밀도 픽셀 아트 맵으로 다시 그린다. 동일한 탑다운 3/4 시점, 벽돌·아스팔트·잎·꽃 재질 구분, 좌우 통로 유지, 인물·글자·UI 없음.
```

```text
같은 맵의 봄 가로수 윗부분 캐노피 하나만 투명 배경의 고밀도 픽셀 오브젝트로 분리한다. 같은 시점과 좌상단 광원, 줄기 하단과 바닥 없음.
```

- [ ] **Step 2: 다음 정확한 좌표를 테스트에 추가한 뒤 기존 데이터로 실패를 확인한다**

- bounds `1200x660`, spawn `(135,375)`.
- paths: street `(60,240,1080,270)`, crosswalk `(510,180,180,390)`.
- west portal rect `(30,315,90,120)`, approach `(105,375)`, home spawn `(285,135)`.
- east portal rect `(1080,300,90,150)`, approach `(1095,375)`, station spawn `(135,435)`.
- asset trees: `(180,120,90,150)` depthY `270`, `(510,90,90,150)` depthY `240`, `(840,120,90,150)` depthY `270`, 모두 `tree-canopy.png`.

- [ ] **Step 3: `neighborhoodZone`을 교체하고 양방향 A* 경로를 통과시킨다**

Run: `pnpm maps:build -- --zone neighborhood && pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts GameWorld.test.tsx`

Expected: 좌우 포털 경로와 home 복귀 spawn PASS.

- [ ] **Step 4: 모바일에서 나무 캐노피와 캐릭터 가림, 횡단보도 판독성을 확인한다**

`390x844`에서 캐릭터가 나무 아래를 지나기 전·후 스크린샷을 남기고 미니맵 경로와 실제 도로 방향이 일치하는지 확인한다.

---

### Task 7: 지하철 역사 제작과 통합

**Files:**
- Create: `map-assets/reference/v2/subway-station/realistic-reference.png`
- Create: `map-assets/reference/v2/subway-station/pixel-background-source.png`
- Create: `map-assets/reference/v2/subway-station/ticket-gate-front-source.png`
- Create: `client/public/assets/maps/v2/subway-station/background.webp`
- Create: `client/public/assets/maps/v2/subway-station/ticket-gate-front.png`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`

**Interfaces:**
- Produces: `subway-station` `900x840` 맵과 개찰구 우회 경로

- [ ] **Step 1: 다음 세 프롬프트로 이미지를 생성·검수한다**

```text
인물 없는 밝고 현대적인 한국 지하철 대합실과 승강장, 정사영 탑다운 3/4 건축 시각화, 유광 타일, 금속 개찰구 세 개, 노선색 띠, 벤치, 안전선, 오른쪽 승강장 문, 서쪽 출입구에서 동쪽 승강장까지 명확한 통로, 글자와 로고 없음
```

```text
이 지하철 역사를 모바일 게임용 고밀도 픽셀 아트 맵으로 다시 그린다. 같은 탑다운 3/4 시점, 타일 반사와 금속 재질, 개찰구 아래쪽 우회 통로, 인물·글자·UI 없음.
```

```text
같은 맵의 금속 개찰구 앞쪽 덮개 한 개만 투명 배경의 고밀도 픽셀 오브젝트로 분리한다. 같은 시점·광원·픽셀 밀도, 바닥 없음.
```

- [ ] **Step 2: 다음 데이터로 실패 테스트를 작성하고 `subwayStationZone`을 교체한다**

- bounds `900x840`, spawn `(135,435)`.
- paths: concourse `(60,300,600,270)`, gate-corridor `(330,240,240,390)`, platform `(600,120,210,600)`.
- spot: directions `(120,150,120,90)`.
- blocked gates: `(360,360,60,120)`, `(450,360,60,120)`, `(540,360,60,120)`.
- west portal `(30,375,90,120)`, approach `(105,435)`, neighborhood spawn `(1065,375)`.
- east portal `(750,360,90,150)`, approach `(735,435)`, train spawn `(135,285)`.
- asset gate fronts: 같은 세 blocked rect, asset `ticket-gate-front.png`, depthY `480`.

- [ ] **Step 3: 빌드와 개찰구 우회 경로 검증을 실행한다**

Run: `pnpm maps:build -- --zone subway-station && pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts minimap.test.ts`

Expected: 서쪽 spawn에서 동쪽 approach까지 하단 우회 경로 PASS.

---

### Task 8: 지하철 차량 제작과 통합

**Files:**
- Create: `map-assets/reference/v2/subway-train/realistic-reference.png`
- Create: `map-assets/reference/v2/subway-train/pixel-background-source.png`
- Create: `map-assets/reference/v2/subway-train/strap-row-foreground-source.png`
- Create: `client/public/assets/maps/v2/subway-train/background.webp`
- Create: `client/public/assets/maps/v2/subway-train/strap-row-foreground.png`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`

**Interfaces:**
- Produces: `subway-train` `1440x540` 초광폭 맵

- [ ] **Step 1: 다음 프롬프트로 초광폭 차량 레퍼런스와 픽셀 배경을 생성한다**

```text
인물 없는 깨끗한 한국 지하철 객차 내부 전체, 정사영 탑다운 3/4 건축 시각화, 긴 초광폭 구도, 크림색 패널, 청록 좌석, 금속 손잡이, 여러 도시 창문, 양쪽 출입문, 중앙 보행 통로, 창밖 풍경은 구간마다 다름, 글자와 로고 없음
```

```text
이 긴 객차를 모바일 게임용 고밀도 픽셀 아트 맵으로 다시 그린다. 동일한 초광폭 탑다운 3/4 시점, 반복처럼 보이지 않는 창밖 도시와 좌석 소품, 선명한 중앙 통로, 인물·글자·UI 없음.
```

```text
같은 객차의 천장 손잡이 줄 전체만 투명 배경의 고밀도 픽셀 전경 오브젝트로 분리한다. 원본과 같은 길이·시점·광원, 천장과 배경 없음.
```

- [ ] **Step 2: 종횡비 감사가 `3%` 안에 드는지 먼저 확인한다**

Run: `pnpm maps:build -- --zone subway-train`

Expected: `1440x540` 출력이 찌그러짐 없이 생성됨. 종횡비 오류면 소스를 저장하지 않고 초광폭 구도로 재생성한다.

- [ ] **Step 3: 다음 데이터로 `subwayTrainZone`을 교체한다**

- bounds `1440x540`, spawn `(135,285)`.
- path carriage `(60,180,1320,210)`.
- west portal `(30,210,90,150)`, approach `(105,285)`, station spawn `(705,435)`.
- east portal `(1320,210,90,150)`, approach `(1335,285)`, venue spawn `(465,765)`.
- strap overlay `(240,105,960,120)`, asset `strap-row-foreground.png`, depthY `420`.

- [ ] **Step 4: 긴 카메라 이동과 양쪽 포털을 검증한다**

Run: `pnpm --filter @wedding-game/client test -- world.test.ts camera.test.ts minimap.test.ts GameWorld.test.tsx`

Expected: `1440x540` 미니맵 종횡비, 서쪽·동쪽 포털 경로, 추적 카메라 PASS.

---

### Task 9: 예식장 앞 제작과 통합

**Files:**
- Create: `map-assets/reference/v2/venue-exterior/realistic-reference.png`
- Create: `map-assets/reference/v2/venue-exterior/pixel-background-source.png`
- Create: `map-assets/reference/v2/venue-exterior/flower-arch-front-source.png`
- Create: `client/public/assets/maps/v2/venue-exterior/background.webp`
- Create: `client/public/assets/maps/v2/venue-exterior/flower-arch-front.png`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`

**Interfaces:**
- Produces: `venue-exterior` `960x900` 정원형 진입 맵

- [ ] **Step 1: 다음 프롬프트로 레퍼런스·픽셀 배경·꽃 아치를 생성한다**

```text
인물 없는 현대적인 가든 웨딩홀 정면, 정사영 탑다운 3/4 건축 시각화, 밝은 석재와 유리, 중앙 진입로, 코랄·아이보리 꽃 아치, 작은 수경 요소, 풍성한 화단과 나무, 아래쪽 도착 지점에서 위쪽 유리문까지 명확한 통로, 글자와 로고 없음
```

```text
이 가든 웨딩홀 외부를 모바일 게임용 고밀도 픽셀 아트 맵으로 다시 그린다. 같은 시점과 자연광, 석재·유리·물·꽃 재질을 선명하게 구분, 중앙 진입로 유지, 인물·글자·UI 없음.
```

```text
같은 맵의 꽃 아치 앞쪽 꽃과 잎 부분만 투명 배경의 고밀도 픽셀 오브젝트로 분리한다. 같은 시점과 광원, 기둥 뒤 배경 없음.
```

- [ ] **Step 2: 다음 데이터로 `venueExteriorZone`을 교체한다**

- bounds `960x900`, spawn `(465,765)`.
- paths: garden `(90,570,780,180)`, plaza `(240,300,480,360)`, central `(390,60,180,780)`.
- blocked fountain `(240,450,120,120)`.
- bottom portal `(420,810,90,60)`, approach `(465,795)`, train spawn `(1305,285)`.
- top portal `(405,30,120,90)`, approach `(465,105)`, lobby spawn `(525,765)`.
- flower arch `(360,180,240,180)`, asset `flower-arch-front.png`, depthY `360`.

- [ ] **Step 3: 중앙 통로와 포털 도착 연출을 검증한다**

Run: `pnpm maps:build -- --zone venue-exterior && pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts GameWorld.test.tsx`

Expected: 분수 우회, 상하 포털 도착·페이드 PASS.

---

### Task 10: 예식장 로비 제작과 통합

**Files:**
- Create: `map-assets/reference/v2/lobby/realistic-reference.png`
- Create: `map-assets/reference/v2/lobby/pixel-background-source.png`
- Create: `map-assets/reference/v2/lobby/reception-desk-front-source.png`
- Create: `client/public/assets/maps/v2/lobby/background.webp`
- Create: `client/public/assets/maps/v2/lobby/reception-desk-front.png`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`

**Interfaces:**
- Produces: `lobby` `1080x900` 네 방향 분기 맵

- [ ] **Step 1: 다음 프롬프트로 로비 자산을 생성한다**

```text
인물 없는 밝고 넓은 웨딩홀 로비, 정사영 탑다운 3/4 건축 시각화, 대리석 바닥과 금속·유리 디테일, 중앙 안내 데스크, 축의대, 꽃 포토월, 소파와 대형 꽃 장식, 아래 외부·왼쪽 신부대기실·오른쪽 화장실·위 예식홀로 이어지는 네 갈래 통로, 글자와 로고 없음
```

```text
이 로비를 모바일 게임용 고밀도 픽셀 아트 맵으로 다시 그린다. 같은 탑다운 3/4 시점, 대리석 반사와 금속·유리·꽃 재질 구분, 네 갈래 동선 유지, 인물·글자·UI 없음.
```

```text
같은 로비 중앙 안내 데스크의 앞쪽 패널과 꽃 장식만 투명 배경 고밀도 픽셀 오브젝트로 분리한다. 같은 시점·크기·광원, 바닥 없음.
```

- [ ] **Step 2: 다음 데이터로 로비 실패 테스트를 작성한다**

- bounds `1080x900`, spawn `(525,765)`.
- paths: main `(90,300,900,300)`, vertical `(420,90,240,720)`, upper `(90,180,900,180)`, lower `(90,540,900,240)`.
- spots: wedding-info `(180,180,120,90)`, rsvp `(300,630,120,90)`, gallery `(690,180,120,90)`, story `(780,630,120,90)`.
- blocked desk `(450,300,180,120)`.
- venue portal rect `(480,810,120,60)`, approach `(525,795)`, venue spawn `(465,135)`.
- bridal portal rect `(30,345,90,120)`, approach `(105,405)`, bridal spawn `(345,525)`.
- restroom portal rect `(960,345,90,120)`, approach `(975,405)`, restroom spawn `(135,345)`.
- hall portal rect `(480,30,120,90)`, approach `(525,105)`, hall spawn `(375,1785)`.
- desk overlay `(450,300,180,120)`, asset `reception-desk-front.png`, depthY `420`.

- [ ] **Step 3: 네 포털의 독립 A* 경로와 미니맵 표시를 통과시킨다**

Run: `pnpm maps:build -- --zone lobby && pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts WorldMiniMap.test.tsx GameWorld.test.tsx`

Expected: spawn에서 네 portal approach까지 모두 경로 존재, 미니맵 포털 4개 PASS.

---

### Task 11: 신부 대기실 제작과 통합

**Files:**
- Create: `map-assets/reference/v2/bridal-room/realistic-reference.png`
- Create: `map-assets/reference/v2/bridal-room/pixel-background-source.png`
- Create: `map-assets/reference/v2/bridal-room/flower-arrangement-front-source.png`
- Create: `client/public/assets/maps/v2/bridal-room/background.webp`
- Create: `client/public/assets/maps/v2/bridal-room/flower-arrangement-front.png`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`

**Interfaces:**
- Produces: `bridal-room` `720x630` 신부 NPC 공간

- [ ] **Step 1: 다음 프롬프트로 대기실 자산을 생성한다**

```text
인물 없는 우아한 신부 대기실, 정사영 탑다운 3/4 건축 시각화, 자연광, 입체적인 아이보리·코랄 꽃벽, 아이보리 소파, 대형 거울, 화장대, 꽃병과 드레스 조명, 아래 출입문에서 중앙 인사 공간까지 넓은 통로, 글자와 로고 없음
```

```text
이 신부 대기실을 모바일 게임용 고밀도 픽셀 아트 맵으로 다시 그린다. 같은 시점과 부드러운 자연광, 패브릭·거울·목재·꽃 재질 구분, 인물 자리는 비워 둠, 글자·UI 없음.
```

```text
같은 맵의 소파 옆 큰 꽃꽂이 앞부분만 투명 배경의 고밀도 픽셀 오브젝트로 분리한다. 같은 시점·광원·픽셀 밀도, 바닥 없음.
```

- [ ] **Step 2: 다음 데이터로 `bridalRoomZone`을 교체한다**

- bounds `720x630`, spawn `(345,525)`.
- paths: floor `(90,90,540,450)`, entry `(300,510,120,90)`.
- spot couple `(150,150,120,90)`.
- NPC bride `(360,285)`.
- blocked sofa `(90,330,180,90)`, vanity `(510,240,90,120)`.
- portal rect `(300,540,120,60)`, approach `(345,555)`, lobby spawn `(135,405)`.
- flower overlay `(240,300,90,120)`, asset `flower-arrangement-front.png`, depthY `420`.

- [ ] **Step 3: NPC·정보 지점·복귀 포털을 검증한다**

Run: `pnpm maps:build -- --zone bridal-room && pnpm --filter @wedding-game/client test -- world.test.ts GameWorld.test.tsx WeddingNpc.test.tsx`

Expected: 신부 NPC 선택, `couple` 모달, 로비 복귀 경로 PASS.

---

### Task 12: 예식홀 제작과 통합

**Files:**
- Create: `map-assets/reference/v2/ceremony-hall/realistic-reference.png`
- Create: `map-assets/reference/v2/ceremony-hall/pixel-background-source.png`
- Create: `map-assets/reference/v2/ceremony-hall/aisle-bouquet-front-source.png`
- Create: `client/public/assets/maps/v2/ceremony-hall/background.webp`
- Create: `client/public/assets/maps/v2/ceremony-hall/aisle-bouquet-front.png`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`
- Modify: `client/src/game/minimap.test.ts`

**Interfaces:**
- Produces: `ceremony-hall` `780x1920` 장축 맵

- [ ] **Step 1: 다음 프롬프트로 긴 예식홀 자산을 생성한다**

```text
인물 없는 높은 천장의 밝은 웨딩 세리머니 홀, 매우 긴 세로형 정사영 탑다운 3/4 건축 시각화, 중앙 아이보리 버진로드, 좌우 대칭 좌석, 구간마다 다른 꽃 장식과 촛불, 위쪽 제단, 아래쪽 출입문, 반복감 없는 긴 공간, 글자와 로고 없음
```

```text
이 긴 예식홀을 모바일 게임용 고밀도 픽셀 아트 맵으로 다시 그린다. 같은 세로형 탑다운 3/4 시점, 입구·중앙 통로·제단의 밀도와 조명 변화, 선명한 버진로드, 인물·글자·UI 없음.
```

```text
같은 예식홀의 버진로드 가장자리 꽃다발 하나 앞부분만 투명 배경의 고밀도 픽셀 오브젝트로 분리한다. 같은 시점·광원·크기, 바닥 없음.
```

- [ ] **Step 2: `780x1920` 종횡비와 접합 흔적을 검수한다**

`pnpm maps:build -- --zone ceremony-hall`이 종횡비 차이로 실패하면 이미지를 늘이지 않는다. 세로 구도를 다시 생성하고, 최종 이미지의 입구·중앙·제단 세 구간을 `view_image`로 각각 확대 확인한다.

- [ ] **Step 3: 다음 데이터로 `ceremonyHallZone`을 교체한다**

- bounds `780x1920`, spawn `(375,1785)`.
- paths: aisle `(300,90,180,1740)`, altar-cross `(180,120,420,240)`, entry `(240,1740,300,120)`.
- spot couple `(180,150,90,90)`.
- NPC groom `(330,255)`, bride `(450,255)`.
- bottom portal `(330,1830,120,60)`, approach `(375,1815)`, lobby spawn `(525,135)`.
- top portal `(330,30,120,90)`, approach `(375,105)`, banquet spawn `(585,795)`.
- bouquet overlays at `(270,480)`, `(420,720)`, `(270,960)`, `(420,1200)`, 각각 `60x90`, asset `aisle-bouquet-front.png`, depthY는 각각 `570`, `810`, `1050`, `1290`.

- [ ] **Step 4: 장축 카메라, 미니맵, 양방향 포털을 검증한다**

Run: `pnpm --filter @wedding-game/client test -- world.test.ts camera.test.ts minimap.test.ts WorldMiniMap.test.tsx GameWorld.test.tsx`

Expected: 미니맵 높이 `120px` 이하, 전체 버진로드 경로, 제단·입구 포털 PASS.

---

### Task 13: 화장실 제작과 통합

**Files:**
- Create: `map-assets/reference/v2/restroom/realistic-reference.png`
- Create: `map-assets/reference/v2/restroom/pixel-background-source.png`
- Create: `map-assets/reference/v2/restroom/stall-front-source.png`
- Create: `client/public/assets/maps/v2/restroom/background.webp`
- Create: `client/public/assets/maps/v2/restroom/stall-front.png`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`

**Interfaces:**
- Produces: `restroom` `660x660` 맵

- [ ] **Step 1: 다음 프롬프트로 화장실 자산을 생성한다**

```text
인물 없는 밝고 깨끗한 웨딩홀 화장실, 정사영 탑다운 3/4 건축 시각화, 민트·화이트 타일과 다색 테라조, 조명 거울 두 개, 금속 세면대 두 개, 오른쪽 칸막이 두 개, 식물, 왼쪽 출입문과 넓은 중앙 통로, 글자와 로고 없음
```

```text
이 화장실을 모바일 게임용 고밀도 픽셀 아트 맵으로 다시 그린다. 동일한 시점, 테라조·타일·거울·금속 반사 구분, 중앙 통로 유지, 인물·글자·UI 없음.
```

```text
같은 맵의 오른쪽 칸막이 문 앞쪽 부분 하나만 투명 배경의 고밀도 픽셀 오브젝트로 분리한다. 같은 시점과 광원, 벽과 바닥 없음.
```

- [ ] **Step 2: 다음 데이터로 `restroomZone`을 교체한다**

- bounds `660x660`, spawn `(135,345)`.
- paths: floor `(90,150,480,390)`, entry `(60,270,90,150)`.
- blocked sinks `(150,150,240,90)`, stalls `(420,240,150,240)`.
- portal `(30,285,90,120)`, approach `(105,345)`, lobby spawn `(945,405)`.
- stall overlay `(420,240,150,240)`, asset `stall-front.png`, depthY `480`.

- [ ] **Step 3: 좁은 통로와 로비 복귀를 검증한다**

Run: `pnpm maps:build -- --zone restroom && pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts GameWorld.test.tsx`

Expected: spawn 주변 4방향 이동, 칸막이 충돌, 로비 복귀 PASS.

---

### Task 14: 연회장 제작과 통합

**Files:**
- Create: `map-assets/reference/v2/banquet/realistic-reference.png`
- Create: `map-assets/reference/v2/banquet/pixel-background-source.png`
- Create: `map-assets/reference/v2/banquet/table-front-source.png`
- Create: `client/public/assets/maps/v2/banquet/background.webp`
- Create: `client/public/assets/maps/v2/banquet/table-front.png`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`

**Interfaces:**
- Produces: `banquet` `1200x930` 최종 맵

- [ ] **Step 1: 다음 프롬프트로 연회장 자산을 생성한다**

```text
인물 없는 밝고 화사한 웨딩 연회장, 정사영 탑다운 3/4 건축 시각화, 큰 창과 자연광, 서로 다른 상차림의 원형 테이블 여섯 개, 꽃 장식, 오른쪽 뷔페, 디저트 카트, 샹들리에 그림자, 아래 출입문에서 테이블 사이로 이어지는 넓은 통로, 글자와 로고 없음
```

```text
이 연회장을 모바일 게임용 고밀도 픽셀 아트 맵으로 다시 그린다. 같은 탑다운 3/4 시점, 음식·식기·패브릭·꽃·유리 재질 구분, 테이블 사이 통로 유지, 인물·글자·UI 없음.
```

```text
같은 맵의 원형 연회 테이블 앞쪽 절반과 의자만 투명 배경의 고밀도 픽셀 오브젝트로 분리한다. 같은 시점·광원·크기, 바닥 없음.
```

- [ ] **Step 2: 다음 데이터로 `banquetZone`을 교체한다**

- bounds `1200x930`, spawn `(585,795)`.
- paths: floor `(60,90,1080,750)`, central `(510,90,180,780)`.
- spot guestbook `(930,120,120,90)`.
- blocked tables: `(120,210,180,180)`, `(390,210,180,180)`, `(660,210,180,180)`, `(120,480,180,180)`, `(390,480,180,180)`, `(660,480,180,180)`.
- blocked buffet `(930,300,150,300)`.
- portal `(540,840,120,60)`, approach `(585,825)`, hall spawn `(375,165)`.
- table overlays는 여섯 blocked table과 같은 rect, asset `table-front.png`, depthY는 각 rect의 `y + 150`.

- [ ] **Step 3: 전체 테이블 통로, 방명록, 예식홀 복귀를 검증한다**

Run: `pnpm maps:build -- --zone banquet && pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts GameWorld.test.tsx GuestbookPanel.test.tsx`

Expected: spawn에서 guestbook 인접 타일까지 이동 가능, 예식홀 복귀, 방명록 모달 PASS.

---

### Task 15: 기존 CSS 도형 제거와 장소별 제한 모션

**Files:**
- Modify: `client/src/styles.css`
- Modify: `client/src/styles.test.ts`

**Interfaces:**
- Consumes: `WorldMapArtwork` effect 클래스와 이미지 기반 장식
- Produces: 이미지 배경을 가리지 않는 투명 경로, 10개 장소별 제한 효과, 모션 감소 대응

- [ ] **Step 1: 이미지 배경 계약과 구식 도형 제거 실패 테스트를 작성한다**

테스트는 다음을 검사한다.

```ts
expect(css).toContain(".world-map-artwork__background");
expect(css).toContain("image-rendering: pixelated");
expect(css).toMatch(/\.world-path\s*\{[^}]*opacity:\s*0/s);
expect(css).not.toContain("--world-ground:");
expect(css).toContain("prefers-reduced-motion: reduce");
```

- [ ] **Step 2: 기존 10개 `--world-ground` 테마와 CSS 장식 도형을 제거한다**

컨트롤, 포털, 정보 버튼, 미니맵 스타일은 유지한다. `.world-path`는 미니맵용 데이터 DOM으로만 남기고 월드에서는 `opacity: 0; pointer-events: none;`으로 숨긴다. `.world-decoration--asset` 외 기존 pseudo-element 장식 규칙을 제거한다.

- [ ] **Step 3: 각 effect를 작고 제한된 픽셀 모션으로 구현한다**

- `window-light`, `lobby-glint`, `mirror-glint`: 작은 불투명도 변화
- `leaf-shadow`, `garden-petals`, `bridal-sparkle`: `steps(2, end)` 위치·불투명도 변화
- `station-glow`, `aisle-light`, `banquet-light`: 정적인 광원과 느린 2단계 밝기 변화
- `city-motion`: 창문 영역 안에서만 움직이는 수평 픽셀 띠

모든 effect는 `pointer-events: none`, 동시에 최대 1개 DOM 요소만 사용한다.

- [ ] **Step 4: 모션 감소에서 환경 효과를 정지한다**

```css
@media (prefers-reduced-motion: reduce) {
  .world-map-effect { animation: none !important; }
}
```

- [ ] **Step 5: 스타일 테스트를 통과시킨다**

Run: `pnpm --filter @wedding-game/client test -- styles.test.ts`

Expected: 이미지 렌더링, 투명 경로, 구식 테마 제거, 모션 감소 계약 PASS.

---

### Task 16: 자산 감사를 전체 테스트와 빌드에 연결

**Files:**
- Modify: `package.json`
- Modify: `scripts/mapAssetAudit.test.mjs`
- Modify: `client/src/game/world.test.ts`

**Interfaces:**
- Consumes: 완성된 10개 맵 manifest와 앱 자산
- Produces: 누락·크기·알파·월드 크기 불일치를 차단하는 루트 명령

- [ ] **Step 1: 실제 manifest와 월드 크기 대응 테스트를 추가한다**

`world.test.ts`의 `expectedSizes`를 다음으로 고정한다.

```ts
const expectedSizes = {
  home: [600, 720],
  neighborhood: [1200, 660],
  "subway-station": [900, 840],
  "subway-train": [1440, 540],
  "venue-exterior": [960, 900],
  lobby: [1080, 900],
  "bridal-room": [720, 630],
  "ceremony-hall": [780, 1920],
  restroom: [660, 660],
  banquet: [1200, 930]
} as const;
```

모든 구역이 배경과 최소 1개 asset decoration을 가지며 모든 portal spawn이 대상 구역의 path 안에 있는지 검사한다.

- [ ] **Step 2: 루트 test와 build 앞에 `maps:audit`를 연결한다**

```json
"build": "pnpm maps:audit && pnpm characters:audit && pnpm characters:generate && pnpm --filter @wedding-game/shared build && pnpm --filter @wedding-game/client build && pnpm --filter @wedding-game/worker build",
"test": "pnpm maps:audit && pnpm maps:test && pnpm characters:audit && pnpm characters:test && pnpm --filter @wedding-game/shared test && pnpm --filter @wedding-game/client test && pnpm --filter @wedding-game/worker test"
```

- [ ] **Step 3: 감사·테스트·타입 검사·빌드를 실행한다**

Run: `pnpm maps:audit && pnpm test && pnpm typecheck && pnpm build`

Expected: 10개 맵 자산 감사, 전체 테스트, 타입 검사, shared/client/worker 빌드 모두 PASS.

- [ ] **Step 4: 형식과 작업 범위를 검사한다**

Run: `git diff --check && git status --short`

Expected: 공백 오류 없음. 기존 미추적 캐릭터 디렉터리는 그대로이며 이번 맵 파일과 문서만 새 변경으로 표시됨.

---

### Task 17: 전체 여정 브라우저 검수와 배포 준비

**Files:**
- Create: `.superpowers/map-review/v2/<zone>-mobile.png`
- Create: `.superpowers/map-review/v2/<zone>-desktop.png`
- Create: `.superpowers/map-review/v2/all-mobile.png`
- Create: `.superpowers/map-review/v2/all-desktop.png`

**Interfaces:**
- Consumes: 완성된 10개 맵과 프로덕션 빌드
- Produces: 20개 맵별 검수 이미지, 전체 contact sheet, 배포 승인 가능한 검증 결과

- [ ] **Step 1: 사용 가능한 포트를 확인하고 로컬 서버를 시작한다**

Run: `pnpm dev -- --host 127.0.0.1`

Expected: 기존 포트가 사용 중이면 다른 포트로 실행되고 URL이 출력됨.

- [ ] **Step 2: 모바일 네 크기와 데스크톱에서 전체 여정을 자동화한다**

대상 뷰포트는 `320x568`, `360x740`, `390x844`, `430x932`, 데스크톱 `1440x1000`이다. 각 맵에서 다음을 확인한다.

1. 배경 이미지가 로드되고 빈 폴백 화면이 아니다.
2. 캐릭터·문·가구 스케일이 자연스럽다.
3. 길과 장애물의 시각 경계가 실제 이동과 일치한다.
4. 오버레이가 캐릭터 앞뒤에서 자연스럽다.
5. 포털 클릭과 조이스틱 접근이 모두 도착·대기·페이드 후 전환된다.
6. 미니맵 경로·장애물·포털이 실제 구조와 일치한다.
7. 미니맵, 조이스틱, 메뉴 클릭이 캐릭터 이동을 발생시키지 않는다.
8. 브라우저 콘솔에 이미지 로드·디코딩·좌표 오류가 없다.

- [ ] **Step 3: 맵별 모바일·데스크톱 스크린샷과 contact sheet를 만든다**

스크린샷은 각 맵의 대표 위치에서 저장한다. `all-mobile.png`와 `all-desktop.png`에는 10개 맵이 여정 순서로 배열돼야 하며 텍스트가 잘리지 않아야 한다.

- [ ] **Step 4: 자산 크기와 네트워크 요청을 확인한다**

모든 맵 자산 요청이 HTTP 200이고 외부 이미지 URL 요청이 0건인지 확인한다. 배경 하나가 과도하게 크면 화질 비교 후 lossless WebP effort만 높이고 픽셀 해상도는 낮추지 않는다.

- [ ] **Step 5: 최종 로컬 검증 결과를 사용자에게 보고하고 배포 승인을 요청한다**

보고 내용은 변경된 10개 맵, 전체 테스트·빌드 결과, 스크린샷 경로, 남은 시각 위험이다. 사용자 명시 승인 전에는 커밋·푸시하지 않는다.

- [ ] **Step 6: 사용자가 배포를 승인한 경우에만 배포한다**

승인 후 이번 작업 파일만 선별해 커밋·푸시하고 GitHub Pages workflow 완료를 기다린다. `https://po-mato.github.io/pixel-garden-invitation/`에서 모바일·데스크톱 전체 여정을 다시 확인한다. 기존 미추적 캐릭터 디렉터리는 커밋 대상에서 제외한다.

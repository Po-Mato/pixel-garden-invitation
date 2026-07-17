# 다중 타일 포털과 조이스틱 가시성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 맵 포털을 진행 방향과 직각인 3타일 진입 띠로 바꾸고, 캐릭터가 포털 앞에 표시되며 조이스틱 손잡이가 더 선명하게 보이도록 구현·배포한다.

**Architecture:** `WorldPortal.entryTiles`가 실제 판정 영역의 단일 원천이 되고, 월드 판정·자동 보행·렌더링·미니맵이 이 좌표에서 같은 사각 범위를 계산한다. 클릭 자동 보행은 세 진입 타일의 경로를 비교해 가장 짧은 경로를 선택하며, 포털 렌더링 깊이는 캐릭터 깊이보다 낮게 계산한다. 조이스틱은 기존 PNG와 입력 로직을 유지하고 CSS 크기·이동 반경·대비만 조정한다.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, pathfinding.js, Vite, GitHub Actions Pages

## Global Constraints

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 새 worktree를 만들지 않고 현재 `main` 워크트리에서 순차 실행한다.
- 기존 조이스틱 PNG 에셋과 포털 도착 지연·fade 전환·입력 해제 래치를 유지한다.
- 각 포털은 `30x30px` 진입 타일을 정확히 3개 가진다.
- `up`·`down` 포털은 가로 3칸, `left`·`right` 포털은 세로 3칸이다.
- 포털 타일, 판정 범위, 클릭 영역과 미니맵 표식은 같은 좌표를 사용한다.
- 포털은 플레이어·원격 하객·NPC보다 낮게, 정보 버튼은 기존 `z-index: 9000`에 렌더링한다.
- 손잡이는 데스크톱 `38px`·이동 반경 `26px`, 모바일 `30px`·이동 반경 `21px`를 사용한다.
- 관련 없는 미추적 캐릭터 원안 디렉터리는 스테이징하거나 변경하지 않는다.
- 전체 테스트·타입 검사·프로덕션 빌드를 통과한 뒤 `main`을 푸시하고 GitHub Pages 공개 URL까지 검증한다.

---

### Task 1: 3타일 포털 데이터와 판정 계약

**Files:**
- Modify: `client/src/game/world.ts:94-128,206-215,229-539`
- Test: `client/src/game/world.test.ts:1-158`

**Interfaces:**
- Consumes: `Point`, `Rect`, `Direction`, 기존 `WorldPortal.approach`와 `facing`.
- Produces: `WorldPortal.entryTiles: Point[]`, `portalEntryTileSize`, `portalEntryRect(portal): Rect`, `pointInPortalEntry(portal, point): boolean`.

- [ ] **Step 1: 기존 타원 계약을 3타일 계약으로 바꾸는 실패 테스트 작성**

`client/src/game/world.test.ts`에서 `portalEntrySize`와 `portalVisualCenter` 가져오기를 제거하고 `portalEntryTileSize`를 가져온다. 기존 `aligns every portal entry ellipse...` 테스트를 다음 계약으로 교체한다.

```ts
it("defines three walkable entry tiles perpendicular to every portal direction", () => {
  expect(portalEntryTileSize).toBe(30);

  let entryTileCount = 0;
  for (const zone of gardenWorld.zones) {
    for (const portal of zone.portals) {
      entryTileCount += portal.entryTiles.length;
      expect(portal.entryTiles, portal.id).toHaveLength(3);
      expect(portal.entryTiles, portal.id).toContainEqual(portal.approach);

      const xs = portal.entryTiles.map((tile) => tile.x);
      const ys = portal.entryTiles.map((tile) => tile.y);
      if (portal.facing === "up" || portal.facing === "down") {
        expect(new Set(xs).size, portal.id).toBe(3);
        expect(new Set(ys), portal.id).toEqual(new Set([portal.approach.y]));
      } else {
        expect(new Set(xs), portal.id).toEqual(new Set([portal.approach.x]));
        expect(new Set(ys).size, portal.id).toBe(3);
      }

      for (const tile of portal.entryTiles) {
        expect(isTileCenter(tile.x, zone.cameraSafeBounds.x), `${portal.id} x`).toBe(true);
        expect(isTileCenter(tile.y, zone.cameraSafeBounds.y), `${portal.id} y`).toBe(true);
        expect(isWalkable(tile, zone), `${portal.id} walkable`).toBe(true);
        expect(isBlocked(tile, zone), `${portal.id} blocked`).toBe(false);
        expect(pointInPortalEntry(portal, tile), `${portal.id} entry`).toBe(true);
      }
    }
  }

  expect(entryTileCount).toBe(54);
});
```

사각 범위와 바로 바깥 판정도 추가한다.

```ts
it("uses the exact contiguous tile strip as each portal entry rectangle", () => {
  for (const zone of gardenWorld.zones) {
    for (const portal of zone.portals) {
      const entry = portalEntryRect(portal);
      const horizontal = portal.facing === "up" || portal.facing === "down";

      expect([entry.width, entry.height], portal.id).toEqual(horizontal ? [90, 30] : [30, 90]);
      expect(pointInPortalEntry(portal, { x: entry.x + 1, y: entry.y + 1 }), portal.id).toBe(true);
      expect(pointInPortalEntry(portal, { x: entry.x - 1, y: entry.y + entry.height / 2 }), portal.id).toBe(false);
      expect(pointInPortalEntry(portal, { x: entry.x + entry.width / 2, y: entry.y - 1 }), portal.id).toBe(false);
    }
  }
});
```

- [ ] **Step 2: 월드 테스트를 실행해 기존 타원 데이터에서 실패하는지 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/game/world.test.ts
```

Expected: `portalEntryTileSize` 또는 `entryTiles`가 없어 FAIL.

- [ ] **Step 3: 3타일 데이터와 사각 판정 구현**

`client/src/game/world.ts`의 포털 타입과 헬퍼를 다음 구조로 바꾼다.

```ts
export type WorldPortal = Rect & {
  id: string;
  label: string;
  to: WorldZoneId;
  approach: Point;
  entryTiles: Point[];
  facing: Direction;
  spawn: Point;
};

export const portalEntryTileSize = 30;

function createPortalEntryTiles(approach: Point, facing: Direction): Point[] {
  const offsets = [-portalEntryTileSize, 0, portalEntryTileSize];
  return offsets.map((offset) => (
    facing === "up" || facing === "down"
      ? { x: approach.x + offset, y: approach.y }
      : { x: approach.x, y: approach.y + offset }
  ));
}

export function portalEntryRect(portal: WorldPortal): Rect {
  const xs = portal.entryTiles.map((tile) => tile.x);
  const ys = portal.entryTiles.map((tile) => tile.y);
  const halfTile = portalEntryTileSize / 2;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX - halfTile,
    y: minY - halfTile,
    width: maxX - minX + portalEntryTileSize,
    height: maxY - minY + portalEntryTileSize
  };
}

export function pointInPortalEntry(portal: WorldPortal, point: Point): boolean {
  const halfTile = portalEntryTileSize / 2;
  return portal.entryTiles.some((tile) => (
    point.x >= tile.x - halfTile &&
    point.x <= tile.x + halfTile &&
    point.y >= tile.y - halfTile &&
    point.y <= tile.y + halfTile
  ));
}
```

포털 생성 헬퍼에서 `visualCenter` 인자를 제거하고 `entryTiles`를 만든다.

```ts
const portal = (
  id: string,
  label: string,
  to: WorldZoneId,
  rect: Rect,
  approach: Point,
  facing: Direction,
  spawn: Point
): WorldPortal => ({
  id,
  label,
  to,
  ...rect,
  approach,
  entryTiles: createPortalEntryTiles(approach, facing),
  facing,
  spawn
});
```

18개 `portal(...)` 호출의 마지막 `visualCenter` 인자를 제거한다.

- [ ] **Step 4: 월드 테스트 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/game/world.test.ts
```

Expected: PASS이며 전체 진입 타일 수가 54.

- [ ] **Step 5: 데이터 계약 커밋**

```bash
git add client/src/game/world.ts client/src/game/world.test.ts
git commit -m "feat: define three-tile portal entries"
```

---

### Task 2: 가장 가까운 도달 가능 포털 경로 선택

**Files:**
- Modify: `client/src/game/pathfinding.ts`
- Test: `client/src/game/pathfinding.test.ts`

**Interfaces:**
- Consumes: Task 1의 `WorldPortal.entryTiles`, 기존 `findTilePath(zone, start, goal)`.
- Produces: `PortalRoute`, `findNearestPortalRoute(zone, start, portal): PortalRoute | null`.

- [ ] **Step 1: 최단 진입 타일 선택 실패 테스트 작성**

`client/src/game/pathfinding.test.ts`에 다음 테스트를 추가한다.

```ts
it("selects the shortest reachable entry tile for a clicked portal", () => {
  const home = getWorldZone(gardenWorld, "home");
  const portal = home.portals[0];
  const route = findNearestPortalRoute(home, { x: 255, y: 165 }, portal);

  expect(route).not.toBeNull();
  expect(route?.entry).toEqual({ x: 255, y: 105 });
  expect(route?.path.at(-1)).toEqual(route?.entry);
});

it("returns an empty path when already standing on an entry tile", () => {
  const home = getWorldZone(gardenWorld, "home");
  const portal = home.portals[0];
  const route = findNearestPortalRoute(home, portal.entryTiles[2], portal);

  expect(route).toEqual({ entry: portal.entryTiles[2], path: [] });
});

it("returns null when all three portal entry tiles are blocked", () => {
  const home = getWorldZone(gardenWorld, "home");
  const portal = home.portals[0];
  const sealedHome = {
    ...home,
    blocked: [
      ...home.blocked,
      ...portal.entryTiles.map((tile) => ({
        x: tile.x - 15,
        y: tile.y - 15,
        width: 30,
        height: 30
      }))
    ]
  };

  expect(findNearestPortalRoute(sealedHome, home.spawn, portal)).toBeNull();
});
```

기존 전체 포털 경로 테스트는 각 포털의 세 타일 모두 경로가 존재하는지 검사하도록 확장한다.

```ts
for (const zone of gardenWorld.zones) {
  for (const portal of zone.portals) {
    for (const entry of portal.entryTiles) {
      expect(findTilePath(zone, zone.spawn, entry), `${zone.id}/${portal.id}/${entry.x},${entry.y}`).not.toBeNull();
    }
  }
}
```

- [ ] **Step 2: 경로 테스트를 실행해 새 선택 함수가 없어 실패하는지 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/game/pathfinding.test.ts
```

Expected: `findNearestPortalRoute`가 없어 FAIL.

- [ ] **Step 3: 도달 가능한 최단 경로 선택 함수 구현**

`client/src/game/pathfinding.ts`에 다음 인터페이스와 구현을 추가한다.

```ts
export type PortalRoute = {
  entry: Point;
  path: Point[];
};

export function findNearestPortalRoute(
  zone: WorldZone,
  start: Point,
  portal: WorldPortal
): PortalRoute | null {
  const routes = portal.entryTiles
    .map((entry) => ({ entry, path: findTilePath(zone, start, entry) }))
    .filter((candidate): candidate is PortalRoute => candidate.path !== null);

  routes.sort((a, b) => {
    const lengthDifference = a.path.length - b.path.length;
    if (lengthDifference !== 0) return lengthDifference;
    const aIsCenter = a.entry.x === portal.approach.x && a.entry.y === portal.approach.y;
    const bIsCenter = b.entry.x === portal.approach.x && b.entry.y === portal.approach.y;
    return Number(bIsCenter) - Number(aIsCenter);
  });

  return routes[0] ?? null;
}
```

`WorldPortal`을 타입 전용 가져오기에 추가한다.

- [ ] **Step 4: 경로 테스트 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/game/pathfinding.test.ts
```

Expected: PASS이며 각 포털의 세 타일이 모두 도달 가능.

- [ ] **Step 5: 경로 선택 커밋**

```bash
git add client/src/game/pathfinding.ts client/src/game/pathfinding.test.ts
git commit -m "feat: route to nearest portal tile"
```

---

### Task 3: 포털 이동·렌더링·미니맵 연결

**Files:**
- Modify: `client/src/components/GameWorld.tsx:26-34,521-539,688-709`
- Modify: `client/src/components/WorldMiniMap.tsx:84-95` only if the existing single bounding rectangle cannot preserve the target class contract
- Test: `client/src/components/GameWorld.test.tsx:963-1018`
- Test: `client/src/components/WorldMiniMap.test.tsx:1-51`

**Interfaces:**
- Consumes: Task 1의 `portalEntryRect`, Task 2의 `findNearestPortalRoute`, 기존 `worldDepth`.
- Produces: 세 타일 포털 DOM, 최단 타일 클릭 보행, `worldDepth(portal.approach.y) - 100` 포털 깊이, 동일 범위 미니맵 표식.

- [ ] **Step 1: 컴포넌트 실패 테스트를 새 렌더링 계약으로 변경**

`client/src/components/GameWorld.test.tsx`의 포털 깊이·장식·위치 테스트를 다음 계약으로 변경한다.

```ts
import { worldDepth } from "../game/worldVisuals";
```

```tsx
it("keeps portal effects behind characters while information buttons stay above the map", () => {
  render(<GameWorld profile={profile} />);

  const portal = screen.getByRole("button", { name: "동네로 나가기" });
  expect(portal).toHaveStyle({ zIndex: "1005" });
  expect(screen.getByLabelText("하객1")).toHaveStyle({ zIndex: "1555" });
  expect(Number(portal.style.zIndex)).toBeLessThan(worldDepth(105 - 88));
  expect(screen.getByRole("button", { name: /오시는 길/ })).toHaveStyle({ zIndex: "9000" });
});

it("renders one portal effect over three visible entry tiles", () => {
  render(<GameWorld profile={profile} />);
  const portal = screen.getByRole("button", { name: "동네로 나가기" });

  expect(portal.querySelectorAll(".world-portal__tile")).toHaveLength(3);
  expect(portal.querySelectorAll(".world-portal__beam--outer")).toHaveLength(1);
  expect(portal.querySelectorAll(".world-portal__beam--core")).toHaveLength(1);
  expect(portal.querySelector(".world-portal__effect")).toHaveAttribute("aria-hidden", "true");
});

it("uses the exact three-tile portal strip as its click area", () => {
  render(<GameWorld profile={profile} />);
  expect(screen.getByRole("button", { name: "동네로 나가기" })).toHaveStyle({
    left: "240px",
    top: "90px",
    width: "90px",
    height: "30px"
  });

  travelThroughPortal("동네로 나가기");
  expect(screen.getByRole("button", { name: "집으로 돌아가기" })).toHaveStyle({
    left: "90px",
    top: "330px",
    width: "30px",
    height: "90px"
  });
});
```

기존 오른쪽 끝 타일 조이스틱 테스트 이름을 `enters a portal by joystick through either edge entry tile`로 바꾸고 `{ left: "315px", top: "105px" }`에서 `arrival`이 시작되는 기대값은 유지한다.

`client/src/components/WorldMiniMap.test.tsx`에는 포털 데이터가 `90x30`으로 투영되는지 명시적으로 확인한다.

```tsx
expect(portalEntryRect(zone.portals[0])).toEqual({ x: 240, y: 90, width: 90, height: 30 });
expect(portal).toHaveAttribute("width", String(projectedPortal.width));
expect(portal).toHaveAttribute("height", String(projectedPortal.height));
```

- [ ] **Step 2: 관련 컴포넌트 테스트 실패 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/components/GameWorld.test.tsx src/components/WorldMiniMap.test.tsx
```

Expected: 기존 `80x34`, `z-index: 9000`, 원형 장식 DOM 때문에 FAIL.

- [ ] **Step 3: 클릭 이동을 최단 진입 타일로 연결**

`GameWorld.tsx`에서 `findTilePath` 대신 `findNearestPortalRoute`를 사용한다.

```ts
function handlePortalClick(portalItem: WorldPortal) {
  if (portalTransitionRef.current) return;

  const route = findNearestPortalRoute(activeZone, positionRef.current, portalItem);
  setTarget(null);
  setJoystickVector({ x: 0, y: 0 });
  targetStepAtRef.current = null;
  if (!route) {
    setPortalIntent(null);
    setTravelStatus("길을 찾을 수 없어요");
    return;
  }
  if (route.path.length === 0) {
    beginPortalTransition(portalItem, route.entry, performance.now());
    return;
  }
  setPortalIntent({ portal: portalItem, path: route.path });
  setTravelStatus(`${portalItem.label}까지 이동 중`);
}
```

- [ ] **Step 4: 포털 DOM과 깊이 구현**

포털 방향 클래스를 추가하고 실제 사각 범위와 캐릭터 아래 깊이를 사용한다.

```tsx
{activeZone.portals.map((portalItem) => {
  const horizontal = portalItem.facing === "up" || portalItem.facing === "down";
  return (
    <button
      key={portalItem.id}
      type="button"
      className={`world-portal world-portal--${horizontal ? "horizontal" : "vertical"}${portalIntent?.portal.id === portalItem.id ? " world-portal--target" : ""}`}
      style={{
        ...pixelRect(portalEntryRect(portalItem)),
        zIndex: worldDepth(portalItem.approach.y) - 100
      }}
      onClick={(event) => {
        event.stopPropagation();
        handlePortalClick(portalItem);
      }}
    >
      <span className="world-portal__effect" aria-hidden="true">
        <span className="world-portal__beam world-portal__beam--outer" />
        <span className="world-portal__beam world-portal__beam--core" />
        <span className="world-portal__particle world-portal__particle--one" />
        <span className="world-portal__particle world-portal__particle--two" />
        <span className="world-portal__particle world-portal__particle--three" />
        <span className="world-portal__particle world-portal__particle--four" />
        <span className="world-portal__tiles">
          {portalItem.entryTiles.map((tile) => (
            <span key={`${tile.x}-${tile.y}`} className="world-portal__tile" />
          ))}
        </span>
      </span>
      <span className="world-portal__label">{portalItem.label}</span>
    </button>
  );
})}
```

`WorldMiniMap`은 이미 `portalEntryRect`를 소비하므로 DOM을 바꾸지 않고 변경된 범위가 자동 반영되는지 테스트로 확인한다.

- [ ] **Step 5: 컴포넌트 테스트 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/components/GameWorld.test.tsx src/components/WorldMiniMap.test.tsx
```

Expected: PASS.

- [ ] **Step 6: 이동·렌더링 연결 커밋**

```bash
git add client/src/components/GameWorld.tsx client/src/components/GameWorld.test.tsx client/src/components/WorldMiniMap.test.tsx
git commit -m "feat: render walkable portal tile strips"
```

---

### Task 4: 사각 발광 포털과 J2 조이스틱 스타일

**Files:**
- Modify: `client/src/styles.css:1633-1639,1761-1919,2383-2441,2515-2524`
- Test: `client/src/styles.test.ts:303-357`

**Interfaces:**
- Consumes: Task 3의 `.world-portal--horizontal`, `.world-portal--vertical`, `.world-portal__tiles`, `.world-portal__tile` DOM과 기존 조이스틱 PNG.
- Produces: 3타일 사각 발광 띠, 단일 수직 빛기둥, 캐릭터 뒤 포털 효과, J2 손잡이 크기·대비.

- [ ] **Step 1: 포털·조이스틱 CSS 실패 테스트 작성**

`client/src/styles.test.ts`의 원형 포털과 조이스틱 기대값을 다음으로 바꾼다.

```ts
it("renders portals as three square floor tiles with one rising light effect", () => {
  const portalRule = styles.match(/\.world-portal\s*\{([^}]*)}/s)?.[1] ?? "";
  const tilesRule = styles.match(/\.world-portal__tiles\s*\{([^}]*)}/s)?.[1] ?? "";
  const tileRule = styles.match(/\.world-portal__tile\s*\{([^}]*)}/s)?.[1] ?? "";
  const beamRule = styles.match(/\.world-portal__beam\s*\{([^}]*)}/s)?.[1] ?? "";

  expect(portalRule).toContain("overflow: visible;");
  expect(portalRule).toContain("border-radius: 3px;");
  expect(tilesRule).toContain("display: grid;");
  expect(styles).toMatch(/\.world-portal--horizontal \.world-portal__tiles\s*\{[^}]*grid-template-columns:\s*repeat\(3, 30px\);/s);
  expect(styles).toMatch(/\.world-portal--vertical \.world-portal__tiles\s*\{[^}]*grid-template-rows:\s*repeat\(3, 30px\);/s);
  expect(tileRule).toContain("width: 30px;");
  expect(tileRule).toContain("height: 30px;");
  expect(tileRule).toMatch(/animation:\s*portal-tile-pulse/);
  expect(beamRule).toContain("bottom: calc(50% - 15px);");
  expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.world-portal__tile,[\s\S]*\.world-portal__particle\s*\{[^}]*animation:\s*none !important;/);
});

it("uses the approved J2 joystick thumb size, travel, and contrast", () => {
  const joystickRule = styles.match(/\.virtual-joystick\s*\{([^}]*)}/s)?.[1] ?? "";
  const thumbRule = styles.match(/\.virtual-joystick__thumb\s*\{([^}]*)}/s)?.[1] ?? "";

  expect(joystickRule).toContain("--joystick-travel: 26px;");
  expect(thumbRule).toContain("width: 38px;");
  expect(thumbRule).toContain("height: 38px;");
  expect(thumbRule).toContain("saturate(1.16)");
  expect(thumbRule).toContain("drop-shadow(0 2px 0 #743e52)");
  expect(styles).toMatch(/@media \(max-width: 720px\)[\s\S]*\.virtual-joystick\s*\{[^}]*--joystick-travel:\s*21px;/);
  expect(styles).toMatch(/@media \(max-width: 720px\)[\s\S]*\.virtual-joystick__thumb\s*\{[^}]*width:\s*30px;[^}]*height:\s*30px;/);
});
```

- [ ] **Step 2: 스타일 테스트 실패 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/styles.test.ts
```

Expected: 원형 포털, `30px`·`22px` 이동 반경과 `34px`·`27px` 손잡이 때문에 FAIL.

- [ ] **Step 3: 사각 타일 포털 CSS 구현**

기존 `.world-portal__circle` 규칙을 제거하고 다음 타일 레이아웃을 적용한다. 빛기둥과 입자는 하나만 유지한다.

```css
.world-portal {
  position: absolute;
  display: block;
  overflow: visible;
  border: 0;
  border-radius: 3px;
  padding: 0;
  background: transparent;
  color: #f6ffff;
  isolation: isolate;
}

.world-portal__effect,
.world-portal__tiles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.world-portal__tiles {
  display: grid;
}

.world-portal--horizontal .world-portal__tiles {
  grid-template-columns: repeat(3, 30px);
}

.world-portal--vertical .world-portal__tiles {
  grid-template-rows: repeat(3, 30px);
}

.world-portal__tile {
  position: relative;
  box-sizing: border-box;
  width: 30px;
  height: 30px;
  border: 2px solid var(--portal-core);
  border-radius: 3px;
  background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--portal-accent) 82%, transparent) 0 4px, color-mix(in srgb, var(--portal-deep) 74%, transparent) 4px 8px);
  box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--portal-core) 42%, transparent), 0 0 8px var(--portal-glow);
  animation: portal-tile-pulse 1.15s steps(4, end) infinite;
}

.world-portal__beam {
  left: 50%;
  bottom: calc(50% - 15px);
}
```

타일 중심 문양은 `.world-portal__tile::before`로 그리고, 입자 x 위치는 고정 픽셀이 아니라 `18%`, `36%`, `64%`, `82%`를 사용한다. `@keyframes portal-circle-pulse`는 `portal-tile-pulse`로 바꾸고 reduced-motion 선택자도 새 타일 클래스에 맞춘다.

- [ ] **Step 4: J2 조이스틱 CSS 구현**

```css
.virtual-joystick {
  --joystick-travel: 26px;
}

.virtual-joystick__thumb {
  width: 38px;
  height: 38px;
  filter: saturate(1.16) contrast(1.08)
    drop-shadow(0 2px 0 #743e52)
    drop-shadow(0 0 3px rgba(255, 248, 218, 0.92));
}

@media (max-width: 720px) {
  .virtual-joystick {
    --joystick-travel: 21px;
  }

  .virtual-joystick__thumb {
    width: 30px;
    height: 30px;
  }
}
```

하단의 좁은 화면 미디어 쿼리에도 같은 `21px`, `30px` 값을 적용해 앞선 모바일 규칙을 덮어쓰지 않게 한다.

- [ ] **Step 5: 스타일과 조이스틱 컴포넌트 테스트 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/styles.test.ts src/components/VirtualJoystick.test.tsx
```

Expected: PASS.

- [ ] **Step 6: 스타일 커밋**

```bash
git add client/src/styles.css client/src/styles.test.ts
git commit -m "style: clarify portals and joystick handle"
```

---

### Task 5: 전체 회귀 및 시각 검증

**Files:**
- Verify: `client/src/game/world.ts`
- Verify: `client/src/game/pathfinding.ts`
- Verify: `client/src/components/GameWorld.tsx`
- Verify: `client/src/components/WorldMiniMap.tsx`
- Verify: `client/src/styles.css`

**Interfaces:**
- Consumes: Tasks 1-4의 구현과 전체 저장소 테스트 계약.
- Produces: 배포 가능한 클라이언트 번들과 데스크톱·모바일 시각 검증 결과.

- [ ] **Step 1: 클라이언트 집중 회귀 실행**

Run:

```bash
pnpm --filter @wedding-game/client test
pnpm --filter @wedding-game/client typecheck
```

Expected: 모든 Vitest 테스트와 TypeScript 검사 PASS.

- [ ] **Step 2: 저장소 전체 테스트·타입 검사·빌드 실행**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: 맵·캐릭터 감사, shared·client·worker 테스트, 타입 검사와 Vite 프로덕션 빌드 모두 exit code 0.

- [ ] **Step 3: 로컬 프로덕션 미리보기 실행**

Run:

```bash
pnpm --filter @wedding-game/client exec vite preview --host 127.0.0.1 --port 58862
```

Expected: 상대 `base`를 사용하는 로컬 Vite preview는 `http://127.0.0.1:58862/`에서 응답한다. 포트가 사용 중이면 Vite가 출력한 다음 사용 가능 포트를 기록한다.

- [ ] **Step 4: 데스크톱·모바일 브라우저 검증**

다음 항목을 데스크톱 `1440x900`과 모바일 `390x844`에서 확인한다.

```text
1. 우리 집 상단 포털이 가로 3칸이고 세 칸 모두 입구 보행로 안에 있다.
2. 동네 좌·우 포털이 세로 3칸이고 실제 이동 타일과 일치한다.
3. 포털 클릭은 가까운 끝 타일로 걸어가고, 조이스틱은 끝 타일 진입만으로 전환된다.
4. 캐릭터의 몸과 이름표가 포털 바닥광·빛기둥보다 앞에 표시된다.
5. 미니맵 포털 표식이 월드의 3타일 방향과 일치한다.
6. 조이스틱 손잡이가 중립과 네 방향에서 선명하고 베이스를 벗어나지 않는다.
7. 조이스틱·미니맵·초대장 메뉴 클릭은 맵 클릭 이동을 발생시키지 않는다.
8. 포털 도착 지연과 fade-out/fade-in이 기존처럼 동작한다.
```

시각 계약이 어긋나면 배포하지 않고 해당 Task의 실패 테스트를 추가한 뒤 수정·재검증한다.

- [ ] **Step 5: 최종 변경 범위 확인**

Run:

```bash
git status --short
git diff --check
git log --oneline -6
```

Expected: 관련 코드·테스트·문서 외 변경이 없고, 미추적 캐릭터 원안 디렉터리는 커밋에 포함되지 않음.

---

### Task 6: GitHub Pages 배포와 공개 URL 확인

**Files:**
- Verify: `.github/workflows/pages.yml`
- Verify: `client/dist/`

**Interfaces:**
- Consumes: Task 5에서 검증한 `main` 커밋.
- Produces: 공개 GitHub Pages 배포와 라이브 확인 결과.

- [ ] **Step 1: 현재 브랜치와 푸시 범위 확인**

Run:

```bash
git branch --show-current
git status --short
git diff origin/main...HEAD --stat
```

Expected: 브랜치 `main`, 의도한 설계·계획·구현 커밋만 origin보다 앞서 있음.

- [ ] **Step 2: `main` 푸시**

Run:

```bash
git push origin main
```

Expected: `main -> main` 성공.

- [ ] **Step 3: GitHub Pages 워크플로 완료 대기**

Run:

```bash
run_id=$(gh run list --workflow pages.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$run_id" --exit-status
```

Expected: build와 deploy job 모두 success.

- [ ] **Step 4: 공개 URL과 최신 번들 확인**

Run:

```bash
curl -fsSI https://po-mato.github.io/pixel-garden-invitation/
```

Expected: HTTP 200. 라이브 브라우저에서 `https://po-mato.github.io/pixel-garden-invitation/`를 열고 Task 5의 포털·깊이·조이스틱 핵심 항목을 다시 확인한다.

- [ ] **Step 5: 배포 완료 상태 확인**

Run:

```bash
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Expected: `HEAD`와 `origin/main`이 같고 관련 추적 파일은 깨끗함. 기존 미추적 캐릭터 원안 디렉터리는 그대로 유지됨.

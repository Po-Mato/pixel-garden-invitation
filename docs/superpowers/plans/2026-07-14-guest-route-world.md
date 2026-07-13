# 실제 하객 동선 월드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 집에서 출발해 지하철과 예식장 각 공간을 포털로 직접 걸어 이동하는 10개 구역 월드와 캐릭터 중심 추적 카메라를 구현한다.

**Architecture:** 공유 프로토콜은 정확한 10개 구역 ID를 정의하고, 클라이언트 월드 데이터는 실제 픽셀 좌표와 카메라 안전 영역, 포털 접근점을 제공한다. 포털 자동 보행은 검증된 A* 라이브러리로 만든 타일 경로를 기존 이동 루프가 한 칸씩 소비하며, 별도 카메라 순수 함수가 가변 크기 스테이지의 변환과 클릭 역변환을 책임진다.

**Tech Stack:** TypeScript, React 18, Vitest, Testing Library, Vite, `pathfinding` A*, CSS 픽셀 아트

## 전역 제약

- 작업 경로는 `/Users/sjlee/Documents/New project 5`이고 현재 브랜치와 현재 워크트리를 사용한다.
- 사용자가 별도로 요청하기 전에는 커밋과 푸시를 하지 않는다.
- 월드 이동은 포털로만 가능하며 HUD 여정 표시는 클릭할 수 없다.
- 포털 클릭 직후 맵을 바꾸지 않고, 캐릭터가 접근 타일까지 걸어 도착한 뒤에만 전환한다.
- 구역은 정확히 `home`, `neighborhood`, `subway-station`, `subway-train`, `venue-exterior`, `lobby`, `bridal-room`, `ceremony-hall`, `restroom`, `banquet` 10개다.
- 예식홀은 `660x1800`이며 모든 구역에서 로컬 캐릭터가 뷰포트 중심을 유지한다.
- 수동 맵 클릭 또는 조이스틱 입력은 진행 중인 포털 자동 보행을 취소한다.
- 기존 미추적 캐릭터 원본 자산은 수정·삭제·스테이징하지 않는다.

---

## 파일 구조

- `shared/src/protocol.ts`: 실시간 프로토콜의 10개 구역 ID.
- `shared/src/validation.test.ts`: 새 구역 허용과 레거시 구역 거부 계약.
- `client/src/game/world.ts`: 구역, 길, 포털, 장식 타입과 10개 맵 데이터.
- `client/src/game/world.test.ts`: 맵 크기, 연결 그래프, 타일 정렬, 안전 영역 검증.
- `client/src/game/pathfinding.ts`: A* 그리드 생성과 월드 좌표 경로 변환.
- `client/src/game/pathfinding.test.ts`: 직선, 우회, 불가능 경로 검증.
- `client/src/game/camera.ts`: 카메라 오프셋, 배율, 화면-월드 좌표 변환.
- `client/src/game/camera.test.ts`: 중심 고정과 역변환 검증.
- `client/src/components/GameWorld.tsx`: 포털 의도, 자동 보행, 도달 전환, 카메라 렌더링.
- `client/src/components/GameWorld.test.tsx`: 포털 전용 이동과 취소, 상태 안내 계약.
- `client/src/components/WorldDecoration.tsx`: 실제 픽셀 좌표 장식 배치.
- `client/src/styles.css`: 10개 장소 테마, 가변 스테이지, 추적 카메라, 새 픽셀 장식.
- `client/src/styles.test.ts`: CSS 구조와 모든 구역 테마 검증.

### Task 1: 공유 구역 프로토콜

**Files:**
- Modify: `shared/src/validation.test.ts`
- Modify: `shared/src/protocol.ts`

**Interfaces:**
- Produces: `worldZoneIds`와 `WorldZoneId`가 정확히 10개 실제 동선 구역을 표현한다.

- [x] **Step 1: 실패 테스트 작성**

  `shared/src/validation.test.ts`에 10개 ID 각각의 `join`/`move` 허용과 `entrance`, `ceremony`, `gallery`, `lounge` 거부를 추가한다.

- [x] **Step 2: 실패 확인**

  Run: `pnpm --filter @wedding-game/shared test -- src/validation.test.ts`
  Expected: 새 `home` 메시지가 거부되거나 레거시 ID가 허용되어 FAIL.

- [x] **Step 3: 최소 구현**

  `worldZoneIds`를 설계의 10개 ID 튜플로 교체한다. `validation.ts`는 이 튜플에서 만든 집합을 계속 사용한다.

- [x] **Step 4: 통과 확인**

  Run: `pnpm --filter @wedding-game/shared test -- src/validation.test.ts`
  Expected: PASS.

### Task 2: 10개 월드 데이터와 구조 검증

**Files:**
- Create: `client/src/game/world.test.ts`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/geometry.test.ts`
- Modify: `client/src/game/movement.test.ts`

**Interfaces:**
- Produces: `WorldPath`, `WorldPortal.approach`, `WorldPortal.facing`, `WorldZone.cameraSafeBounds`, `WorldZone.paths`, `WorldZone.theme`, `WorldZone.journeyIndex`.
- Produces: `GardenWorld = { defaultZoneId: WorldZoneId; zones: WorldZone[] }`와 안전한 `getWorldZone`, `getZoneForSpot`.

- [x] **Step 1: 실패 테스트 작성**

  `world.test.ts`에서 정확한 ID/크기/기본 구역, 양방향 포털 그래프, 로비 분기, 홀-연회장 연결, 모든 좌표의 30px 타일 정렬, 안전 영역 포함, 비충돌, 장소별 길과 장식을 검증한다. 기존 geometry/movement 테스트는 기본 구역을 `getWorldZone()`으로 얻도록 바꾼다.

- [x] **Step 2: 실패 확인**

  Run: `pnpm --filter @wedding-game/client test -- src/game/world.test.ts src/game/geometry.test.ts src/game/movement.test.ts`
  Expected: 새 타입/10개 맵이 없어 FAIL.

- [x] **Step 3: 최소 구현**

  10개 구역을 데이터 중심으로 정의한다. 각 구역의 `bounds`, `cameraSafeBounds`, `spawn`, `blocked`, `paths`, `spots`, `npcs`, `portals`, `decorations`를 실제 좌표로 작성하고 포털의 접근점과 대상 스폰을 연결한다. 기존 정보 spot은 설계된 장소에 재배치한다.

- [x] **Step 4: 통과 확인**

  Run: `pnpm --filter @wedding-game/client test -- src/game/world.test.ts src/game/geometry.test.ts src/game/movement.test.ts`
  Expected: PASS.

### Task 3: A* 포털 경로 탐색

**Files:**
- Modify: `client/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `client/src/game/pathfinding.test.ts`
- Create: `client/src/game/pathfinding.ts`

**Interfaces:**
- Consumes: `Point`, `WorldZone`, `gridTileSize`.
- Produces: `findTilePath(zone: WorldZone, start: Point, goal: Point): Point[] | null`.

- [x] **Step 1: 의존성 설치**

  Run: `pnpm --filter @wedding-game/client add pathfinding && pnpm --filter @wedding-game/client add -D @types/pathfinding`
  Expected: `client/package.json`, `pnpm-lock.yaml` 갱신.

- [x] **Step 2: 실패 테스트 작성**

  직선 경로가 시작점을 제외한 30px 간격 좌표를 반환하는지, 장애물을 상하좌우로 우회하는지, 완전히 막힌 목표는 `null`인지, 실제 모든 포털 접근점까지 경로가 존재하는지 검증한다.

- [x] **Step 3: 실패 확인**

  Run: `pnpm --filter @wedding-game/client test -- src/game/pathfinding.test.ts`
  Expected: 모듈이 없어 FAIL.

- [x] **Step 4: 최소 구현**

  `PF.Grid`와 `PF.AStarFinder({ allowDiagonal: false })`를 사용한다. 카메라 안전 영역을 그리드로 만들고 `blocked`와 spot 영역을 통과 불가로 표시하되 시작점과 목표점은 보행 가능하게 보정한 뒤 월드 타일 중심 좌표로 되돌린다.

- [x] **Step 5: 통과 확인**

  Run: `pnpm --filter @wedding-game/client test -- src/game/pathfinding.test.ts`
  Expected: PASS.

### Task 4: 추적 카메라 순수 함수

**Files:**
- Create: `client/src/game/camera.test.ts`
- Create: `client/src/game/camera.ts`

**Interfaces:**
- Produces: `computeCameraTransform({ player, viewport, zoom }): CameraTransform`.
- Produces: `screenToWorld({ client, viewportRect, camera }): Point`.

- [x] **Step 1: 실패 테스트 작성**

  여러 뷰포트와 맵 위치에서 플레이어가 정확히 중앙에 투영되는지, 화면 좌표를 역변환하면 원래 월드 좌표가 되는지, 비정상 크기에도 유한한 기본값을 쓰는지 검증한다.

- [x] **Step 2: 실패 확인**

  Run: `pnpm --filter @wedding-game/client test -- src/game/camera.test.ts`
  Expected: 모듈이 없어 FAIL.

- [x] **Step 3: 최소 구현 및 통과 확인**

  카메라 수식과 역변환을 부작용 없는 함수로 구현한다.

  Run: `pnpm --filter @wedding-game/client test -- src/game/camera.test.ts`
  Expected: PASS.

### Task 5: 포털 클릭 자동 보행과 도달 전환

**Files:**
- Modify: `client/src/components/GameWorld.test.tsx`
- Modify: `client/src/components/GameWorld.tsx`

**Interfaces:**
- Consumes: `findTilePath`, `WorldPortal.approach`, `WorldPortal.facing`.
- Produces: 포털 경로 상태를 타일 단위로 소비하고 마지막 접근점 도달 후에만 `moveToZone`을 호출하는 UI 동작.

- [x] **Step 1: 실패 테스트 작성**

  구역 이동 탭이 없고 비클릭 여정 표시만 존재하는지, 포털 클릭 직후 현재 장소가 유지되는지, 가짜 타이머로 경로를 모두 이동한 후 대상 장소가 되는지, 다른 맵 클릭과 조이스틱이 자동 경로를 취소하는지, 도달/취소/실패가 `aria-live`에 표시되는지 검증한다.

- [x] **Step 2: 실패 확인**

  Run: `pnpm --filter @wedding-game/client test -- src/components/GameWorld.test.tsx`
  Expected: 기존 즉시 전환과 맵 탭 때문에 FAIL.

- [x] **Step 3: 최소 구현**

  맵 탭을 제거하고 포털 클릭에서 A* 경로를 저장한다. 기존 120ms 이동 루프는 경로의 첫 타일 방향으로 한 칸씩 이동하고, 최종 좌표가 `approach`와 일치할 때 방향을 `facing`으로 설정한 뒤 `moveToZone(portal.to, portal.spawn)`을 호출한다. 수동 입력은 경로와 대상 포털을 지운다.

- [x] **Step 4: 통과 확인**

  Run: `pnpm --filter @wedding-game/client test -- src/components/GameWorld.test.tsx`
  Expected: PASS.

### Task 6: 가변 크기 스테이지와 카메라 렌더링

**Files:**
- Modify: `client/src/components/GameWorld.test.tsx`
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/components/WorldDecoration.tsx`
- Modify: `client/src/styles.test.ts`
- Modify: `client/src/styles.css`

**Interfaces:**
- Consumes: `computeCameraTransform`, `screenToWorld`, `WorldZone.bounds`, `WorldZone.paths`.
- Produces: ResizeObserver 기반 뷰포트 크기, 실제 px 크기 stage, `translate3d(...) scale(...)` 카메라, px 배치 오브젝트.

- [x] **Step 1: 실패 테스트 작성**

  구역 크기가 stage 인라인 폭/높이에 반영되고, 플레이어 좌표 변경 시 카메라 변환이 바뀌며, 장식/spot/portal/NPC가 px 좌표를 쓰고, 화면 클릭이 역변환된 월드 타일을 목표로 삼는지 검증한다. CSS 테스트에는 고정 `390x720` 스케일 제거와 카메라 transform 계약을 추가한다.

- [x] **Step 2: 실패 확인**

  Run: `pnpm --filter @wedding-game/client test -- src/components/GameWorld.test.tsx src/styles.test.ts`
  Expected: 기존 고정 크기와 백분율 배치 때문에 FAIL.

- [x] **Step 3: 최소 구현**

  `.world-map`을 overflow hidden 뷰포트로 만들고, stage를 실제 월드 크기로 배치한다. 뷰포트 ResizeObserver와 카메라 함수를 연결하고 모든 월드 오브젝트를 px 좌표로 렌더링한다. 맵 클릭은 카메라 역변환 후 그리드에 스냅한다.

- [x] **Step 4: 통과 확인**

  Run: `pnpm --filter @wedding-game/client test -- src/components/GameWorld.test.tsx src/styles.test.ts`
  Expected: PASS.

### Task 7: 10개 장소별 픽셀 시각과 HUD

**Files:**
- Modify: `client/src/components/WorldDecoration.tsx`
- Modify: `client/src/styles.css`
- Modify: `client/src/styles.test.ts`

**Interfaces:**
- Consumes: 월드 데이터의 `theme`, `paths`, 확장된 `WorldDecorationKind`.
- Produces: 각 장소의 구별 가능한 바닥, 구조물, 길, 장식, 현재 여정 HUD.

- [x] **Step 1: 실패 테스트 작성**

  10개 `.world-map--<zone>` 테마, 길 종류, 집/거리/역/객차/예식장/로비/대기실/홀/화장실/연회장 핵심 장식 스타일과 비클릭 여정 레일을 검증한다.

- [x] **Step 2: 실패 확인**

  Run: `pnpm --filter @wedding-game/client test -- src/styles.test.ts src/components/GameWorld.test.tsx`
  Expected: 새 선택자와 장식이 없어 FAIL.

- [x] **Step 3: 최소 구현**

  장소별 색·바닥 패턴·경로와 `door`, `window`, `crosswalk`, `ticket-gate`, `train-seat`, `reception-desk`, `vanity`, `restroom-sink`, `ceremony-seat`, `altar`, `banquet-table`, `buffet` 등을 CSS 픽셀 구조로 구현한다. HUD에는 현재 단계와 축약 여정을 표시하고 버튼 역할은 부여하지 않는다.

- [x] **Step 4: 통과 확인**

  Run: `pnpm --filter @wedding-game/client test -- src/styles.test.ts src/components/GameWorld.test.tsx`
  Expected: PASS.

### Task 8: 전체 회귀와 실제 브라우저 검증

**Files:**
- Modify only if verification exposes a defect in files above.

**Interfaces:**
- Produces: 테스트·타입·빌드가 통과하고 모바일 실제 여정이 작동하는 완료 상태.

- [x] **Step 1: 관련 패키지 전체 검증**

  Run: `pnpm --filter @wedding-game/shared test && pnpm --filter @wedding-game/client test && pnpm typecheck`
  Expected: PASS, TypeScript errors 0.

- [x] **Step 2: 프로덕션 빌드**

  Run: `pnpm build`
  Expected: 캐릭터 audit/generation과 shared/client/worker 빌드 모두 PASS.

- [x] **Step 3: 로컬 서버와 모바일 브라우저 검증**

  Run: `pnpm dev -- --host 127.0.0.1`
  Expected: 사용 가능한 로컬 URL 출력.

  `320x568`, `390x844`, `430x932`에서 집 진입 후 포털을 눌러 집→거리→역→객차→예식장 앞→로비→신부 대기실→로비→화장실→로비→홀→연회장 전체를 걷는다. 각 클릭 직후 장소가 유지되고 도달 후에만 전환되는지, 홀에서 캐릭터 중심과 긴 세로 카메라가 유지되는지, HUD/조이스틱/포털이 겹치지 않는지 확인한다.

- [x] **Step 4: 최종 변경 검토**

  Run: `git status --short && git diff --check && git diff --stat`
  Expected: 공백 오류가 없고 변경 범위가 계획 파일과 월드 구현 파일에 한정되며 기존 미추적 캐릭터 자산은 그대로다.

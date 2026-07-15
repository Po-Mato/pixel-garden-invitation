# Task 10 코드 통합 보고서

## RED / GREEN

- RED: `client/src/game/world.test.ts`, `client/src/game/pathfinding.test.ts`, `worker/src/GardenRoom.test.ts`에 Task 10 로비 계약, 역방향 포털 spawn, future-room 임시 spawn/bounds clamp 테스트를 먼저 추가했다.
- RED 확인: 새 테스트는 기존 구현에서 lobby bounds/spawn, reverse portal destination, worker spawn/bounds 불일치로 실패했다.
- GREEN: `client/src/game/world.ts`와 `worker/src/GardenRoom.ts`를 계약 좌표로 동기화하고 지정 테스트/전체 테스트를 통과시켰다.

## Exact 계약 반영

- lobby bounds: `1080x900`
- lobby spawn: `(525,765)`
- paths: `main (90,300,900,300)`, `vertical (420,90,240,720)`, `upper (90,180,900,180)`, `lower (90,540,900,240)`
- spots: `wedding-info (180,180,120,90)`, `rsvp (300,630,120,90)`, `gallery (690,180,120,90)`, `story (780,630,120,90)`
- blocked desk: `(450,300,180,120)`
- portals: venue `(480,810,120,60)` approach `(525,795)` spawn `(465,135)`, bridal `(30,345,90,120)` approach `(105,405)` spawn `(345,525)`, restroom `(960,345,90,120)` approach `(975,405)` spawn `(135,345)`, hall `(480,30,120,90)` approach `(525,105)` spawn `(375,1785)`
- reception desk overlay: `(450,300,180,120)`, asset `reception-desk-front.png`, `depthY 420`
- Task 9 임시 `lobby-arrival` path 제거 완료

## 임시 corridor / 미래 맵 호환

- `bridal-room`: bounds를 `720x630`, spawn을 `(345,525)`로 임시 확장하고 `bridal-entry-corridor (300,450,90,120)`를 추가해 기존 floor/출구까지 A* 연결을 보장했다.
- `ceremony-hall`: bounds를 `780x1920`, spawn을 `(375,1785)`로 임시 확장하고 `hall-entry-corridor (300,1620,120,240)`를 추가해 기존 aisle/출구까지 A* 연결을 보장했다.
- `restroom`: destination `(135,345)`는 기존 bounds/path 안에서 walkable이므로 geometry 변경 없이 보존했다.
- 좌표별 즉시 전환 예외, clamp 예외, 무경로 전환 예외는 추가하지 않았다.

## Worker 동기화

- worker lobby spawn/bounds를 `(525,765)` / `1080x900`으로 동기화했다.
- worker bridal-room spawn/bounds를 `(345,525)` / `720x630`으로 동기화했다.
- worker ceremony-hall spawn/bounds를 `(375,1785)` / `780x1920`으로 동기화했다.
- lobby approach `(975,405)` 및 bridal/hall 임시 확장 좌표가 clamp되지 않는 테스트를 추가했다.

## 검증

- RED: `pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts` 실패 확인
- RED: `pnpm --filter @wedding-game/worker test -- GardenRoom.test.ts` 실패 확인
- 지정 client tests: `pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts WorldMiniMap.test.tsx GameWorld.test.tsx` 통과
- 전체 client tests: `pnpm --filter @wedding-game/client test` 통과
- 전체 worker tests: `pnpm --filter @wedding-game/worker test` 통과
- typecheck: `pnpm typecheck` 통과
- diff check: `git diff --check` 통과
- `pnpm maps:build -- --zone lobby`: `client/public/assets/maps/v2/lobby/background.webp` 및 `client/public/assets/maps/v2/lobby/reception-desk-front.png`가 없어 실행하지 않았다.

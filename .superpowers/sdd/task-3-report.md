# Task 3 보고서: 경로를 실제 보행 가능 영역으로 사용

## 상태

- 완료
- Task 3 변경 파일: `client/src/game/geometry.ts`, `client/src/game/geometry.test.ts`, `client/src/game/pathfinding.ts`, `client/src/game/pathfinding.test.ts`, `client/src/game/world.ts`, `client/src/game/world.test.ts`
- 기존 미추적 `character-assets`는 수정하거나 스테이징하지 않음
- 푸시하지 않음

## 구현

- `isWalkable(point, world)`은 `world.paths` 중 하나에 점이 포함될 때만 `true`를 반환한다.
- `isBlocked(point, world)`는 경로 밖이거나 기존 `world.blocked` 사각형 안일 때 `true`를 반환한다.
- A*는 각 타일과 시작점, 목표점에 동일한 `isBlocked` 판정을 적용한다. 차단된 시작점/목표점은 `null`을 반환하며, 이전처럼 강제로 walkable 상태로 덮어쓰지 않는다.
- 현재 좌표를 보존하기 위해 `home-floor`만 위쪽으로 한 타일 확장했다: `x=90`, `y=120`, `width=300`, `height=420`. 이 변경으로 기존 포털 접근점 `(225, 135)`가 실제 경로에 포함된다.
- bounds, spawn, portal rect/approach/spawn, spot, blocked, decoration은 변경하지 않았다.

## RED 증거

명령:

```sh
pnpm --filter @wedding-game/client test -- geometry.test.ts pathfinding.test.ts world.test.ts
```

결과: exit 1, 26개 파일 중 2개 실패, 184개 테스트 중 3개 실패.

- `isWalkable is not a function`
- 차단된 시작점이 경로를 반환함
- 경로 밖 목표점이 경로를 반환함

## GREEN 및 회귀 검증

```sh
pnpm --filter @wedding-game/client exec vitest run src/game/geometry.test.ts src/game/movement.test.ts src/game/pathfinding.test.ts src/game/world.test.ts
# 4 files passed, 28 tests passed

pnpm --filter @wedding-game/client exec vitest run src/components/GameWorld.test.tsx
# 1 file passed, 34 tests passed

pnpm --filter @wedding-game/client test
# 26 files passed, 184 tests passed

pnpm --filter @wedding-game/client typecheck
# exit 0
```

## 자체 검토

- 격자 조이스틱 이동은 기존부터 `isBlocked`를 호출하므로 A*와 동일하게 경로 밖 타일을 차단한다.
- 포털 검증은 모든 구역의 `spawn -> portal.approach` A* 경로가 존재하고, 반환된 모든 타일이 `isBlocked`를 통과하는지 검사한다.
- 월드 검증은 모든 spawn 및 portal approach가 경로 안이고 차단되지 않았는지 검사한다.
- 경로 보정은 실패 원인이었던 `home`의 단일 기존 path에만 적용했으며, 시각/레이아웃 재설계는 하지 않았다.

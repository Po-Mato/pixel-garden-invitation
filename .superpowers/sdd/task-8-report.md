# Task 8 코드 완료 보고서

## 결론

Task 8 코드 계약을 완료했다. `subway-train`은 `1440x540` 초광폭 맵으로 교체했고, spawn/path/양쪽 portal/destination/strap foreground overlay를 brief 값에 맞췄다. worker의 `subway-train` bounds도 `1440x540`으로 확장했다.

## 계약 확인

- `subway-train` bounds: `1440x540`
- train spawn: `(135,285)`
- carriage path: `(60,180,1320,210)`
- west portal: rect `(30,210,90,150)`, approach `(105,285)`, station spawn `(705,435)`
- east portal: rect `(1320,210,90,150)`, approach `(1335,285)`, venue spawn `(465,765)`
- strap overlay: `(240,105,960,120)`, asset `strap-row-foreground.png`, `depthY 420`
- worker train bounds: `minX 0`, `maxX 1440`, `minY 0`, `maxY 540`

## venue `(465,765)` 도착점 호환 처리

리뷰 요청에 따라 `(465,765)` exact 예외 처리를 제거했다. `venue-exterior`는 Task 9 전체 geometry를 선행 적용하지 않고, Task 8 도착점 호환에 필요한 최소 corridor만 추가했다.

- venue bounds: `840x900`
- 기존 garden path 유지: `(60,300,720,180)`
- 최소 arrival corridor 추가: `path("venue-arrival", "garden", 420,300,90,510)`
- corridor는 `(465,765)`을 bounds/path/camera-safe 안에 두고, `y=300`에서 기존 garden path와 연결한다.
- client `moveToZone`은 explicit spawn도 다시 `snapToGrid(spawn ?? zone.spawn, zone)`로 처리한다.
- `handlePortalClick`의 Task 8 무경로 즉시 전환 예외와 상수는 제거했다. 도착점에서 `venue-to-lobby`, `venue-to-train` 모두 정상 A* 경로로 걸어간다.
- worker `venue-exterior` bounds는 `maxY 900`으로 동기화했고, `(465,765)` unclamp 예외 함수는 제거했다. 모든 venue 좌표는 일반 bounds clamp만 사용한다.

## strap source 판단

`strap-row-foreground-source.png`는 `1774x222`이며 8:1 목표 대비 오차가 약 `0.11%`다. Task brief의 3% 이내 조건을 충족하므로 이미지 소스는 수정하지 않았다.

## TDD/테스트 보강

의미 있는 테스트로 보강했다.

- `world.test.ts`: Task 8 train 데이터 전체, 양쪽 portal route, `venue-arrival` corridor, `(465,765)` safe/walkable/in-bounds, arrival에서 venue 양쪽 portal approach까지 정상 A* 경로를 검증한다.
- `GameWorld.test.tsx`: train stage `1440x540`, strap overlay 위치/asset/depth, venue 도착 좌표 `(465,765)`, 이후 lobby/train portal 클릭이 즉시 전환하지 않고 한 타일씩 걷기 시작하는 회귀를 검증한다.
- `pathfinding.test.ts`: Task 8 예외 없이 모든 incoming spawn에서 destination exits까지 정상 경로가 있음을 검증한다.
- `GardenRoom.test.ts`: train spawn/bounds, train east approach, venue `(465,765)` 일반 bounds 보존, `y > 900` clamp를 검증한다.
- `camera.test.ts`, `minimap.test.ts`: 초광폭 train camera tracking, `(465,765)` 390x520 viewport projection, 8:3 minimap projection을 검증한다.

## 실행 결과

- `pnpm maps:build -- --zone subway-train`: PASS, `Built map assets: subway-train`
- `pnpm --filter @wedding-game/client test -- world.test.ts camera.test.ts minimap.test.ts GameWorld.test.tsx`: PASS, 26 files / 212 tests
- `pnpm --filter @wedding-game/worker test`: PASS, 5 files / 51 tests
- `pnpm typecheck`: PASS
- `pnpm --filter @wedding-game/client test`: PASS, 26 files / 212 tests

## 범위

이미지 파일은 수정하지 않았다. `maps:build` 실행 후 `client/public/assets/maps/v2/subway-train` 및 `map-assets/reference/v2/subway-train`에는 git 변경이 없었다. `character-assets`의 기존 미추적 파일은 건드리지 않았고 스테이징 대상에서 제외한다.

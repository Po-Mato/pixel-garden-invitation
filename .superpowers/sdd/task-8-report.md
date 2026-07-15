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

## venue `(465,765)` 과도기 처리

현재 `venue-exterior` 맵 계약은 `840x720`으로 유지했다. 이전 구현처럼 venue height를 `810`으로 키우거나 `venue-train-arrival` path를 추가하면 Task 9 venue 데이터를 선행 변경하게 되므로 제거했다.

대신 Task 8의 train-to-venue destination `(465,765)`은 포털 도착 좌표로 그대로 보존한다. 이 좌표는 현재 venue walkable/camera-safe 영역 밖인 과도기 좌표이므로:

- client `moveToZone`은 명시 portal spawn을 `snapToGrid`로 클램프하지 않는다.
- 현재 위치가 `(465,765)`인 venue 과도기 상태에서 portal button을 누르면 일반 pathfinding 실패를 오류로 끝내지 않고 기존 portal transition으로 이어간다.
- worker는 `venue-exterior` 전체 bounds를 키우지 않고, 정확히 `(465,765)`만 clamp 예외로 허용한다.
- 다른 venue 좌표는 여전히 현재 bounds `840x720`에 맞춰 clamp된다.

## TDD/테스트 보강

의미 있는 테스트로 보강했다.

- `world.test.ts`: Task 8 train 데이터 전체, 양쪽 portal route, venue가 `840x720`으로 유지되고 `(465,765)`이 walkable이 아닌 과도기 destination임을 검증한다.
- `GameWorld.test.tsx`: train stage `1440x540`, strap overlay 위치/asset/depth, venue 도착 좌표 `(465,765)`, 이후 lobby portal 전환을 검증한다.
- `pathfinding.test.ts`: 일반 incoming spawn pathfinding 계약에서 Task 8 venue 과도기 spawn만 명시 예외로 고정한다.
- `GardenRoom.test.ts`: train spawn/bounds, train east approach, venue `(465,765)` 예외 통과, 다른 venue 좌표 clamp 유지까지 검증한다.
- `camera.test.ts`, `minimap.test.ts`: 초광폭 train camera tracking과 8:3 minimap projection을 검증한다.

## 실행 결과

- `pnpm maps:build -- --zone subway-train`: PASS, `Built map assets: subway-train`
- `pnpm --filter @wedding-game/client test -- world.test.ts camera.test.ts minimap.test.ts GameWorld.test.tsx`: PASS, 26 files / 210 tests
- `pnpm --filter @wedding-game/worker test`: PASS, 5 files / 51 tests
- `pnpm typecheck`: PASS
- `pnpm --filter @wedding-game/client test`: PASS, 26 files / 210 tests

## 범위

이미지 파일은 수정하지 않았다. `maps:build` 실행 후 `client/public/assets/maps/v2/subway-train` 및 `map-assets/reference/v2/subway-train`에는 git 변경이 없었다. `character-assets`의 기존 미추적 파일은 건드리지 않았고 스테이징 대상에서 제외한다.

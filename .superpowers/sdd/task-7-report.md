# Task 7 코드 통합 보고서

## 변경

- `subway-station` 월드를 `900x840`으로 확장하고 시작 위치를 `(135,435)`로 교체했다.
- 대합실, 개찰구 우회 통로, 우측 승강장의 보행 경로를 각각 `(60,300,600,270)`, `(330,240,240,390)`, `(600,120,210,600)`으로 등록했다.
- 길 안내 spot, 서쪽 동네 포털, 동쪽 열차 포털을 Task 7 좌표 계약으로 교체했다. 동네 귀환 spawn `(1065,375)` 및 열차 도착 spawn `(135,285)`의 camera safe bounds, walkable, blocked 상태를 테스트로 검증한다.
- 세 개찰구 충돌 영역 `(360|450|540,360,60,120)`을 추가하고, 같은 영역에 `ticket-gate-front.png` 전경 오버레이를 `depthY: 480`으로 등록했다.
- 배경 구조에 맞춰 노선 안내판, 대합실 벤치, 역사 기둥, 열차 출입문 장식 좌표를 보정했다.
- `fde7c53`의 지하철 이미지 자산은 수정하거나 재생성하지 않았다. `pnpm maps:build -- --zone subway-station` 실행 후에도 해당 자산에는 diff가 없다.

## TDD 및 검증

- 월드 계약, 하단 개찰구 우회 A*, 양쪽 포털 spawn 안전성, 미니맵 투영, 개찰구 이동 차단, GameWorld 전경 오버레이 깊이 테스트를 먼저 추가했다. 기존 역사 데이터에서 8개 테스트가 계약 불일치로 실패한 것을 확인한 뒤 최소 데이터 변경으로 통과시켰다.
- `pnpm maps:build -- --zone subway-station`: 성공 (`Built map assets: subway-station`).
- `pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts minimap.test.ts GameWorld.test.tsx`: 26 파일, 202 테스트 통과.
- `pnpm typecheck`: shared, client, worker 타입 검사 통과.
- `pnpm --filter @wedding-game/client test`: 26 파일, 202 테스트 통과.
- 브라우저는 사용자 지시에 따라 실행하지 않았다.

## 커밋

- Task 7 코드, 직접 영향 테스트, 이 보고서만 커밋한다.
- 푸시하지 않는다.

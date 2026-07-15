# Task 6 완료 보고서

## 변경

- `neighborhood` 월드를 `1200x660`으로 확장하고 spawn을 `(135,375)`로 교체했다.
- street `(60,240,1080,270)`, crosswalk `(510,180,180,390)`의 새 보행 영역을 적용했다.
- 서쪽 home 포털과 동쪽 station 포털의 rect, approach, 대상 spawn을 Task 6 좌표 계약으로 교체했다.
- station에서 neighborhood로 돌아올 때는 동쪽 포털 바로 안쪽 안전 타일 `(1065,375)`에 도착하도록 보정했다.
- 세 나무 캐노피 장식을 `tree-canopy.png` 에셋과 계약된 좌표/depthY로 등록하고, 배경의 가로등, 벤치, 횡단보도, 화단, 역사 입구 위치에 맞춰 기존 장식 좌표를 조정했다.
- 이미지 자산은 커밋 `1869573`의 결과를 그대로 사용했고 재생성하거나 수정하지 않았다. `character-assets`도 변경하거나 스테이징하지 않았다.

## 테스트

- TDD: 새 neighborhood 치수, 경로, 포털, 캐노피 계약과 양쪽 포털 A* 경로, home 복귀 spawn 안전성 테스트를 먼저 추가해 기존 데이터에서 실패를 확인했다.
- `pnpm maps:build -- --zone neighborhood`: 성공 (`Built map assets: neighborhood`).
- `pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts GameWorld.test.tsx`: 26 파일, 193 테스트 통과.
- `pnpm typecheck`: shared, client, worker 타입 검사 통과.
- `pnpm --filter @wedding-game/client test`: 26 파일, 193 테스트 통과.
- 브라우저 자동화는 상위 에이전트 담당 범위이므로 실행하지 않았다.

## 커밋

- 이 보고서와 Task 6 코드/테스트의 커밋 메시지는 `feat: integrate neighborhood map contract`이다.
- 푸시하지 않았다.

# Task 5 완료 보고서

## 검토 및 변경

- `home` 좌표 계약은 bounds `600x720`, spawn `(285,555)`, 두 floor path, directions spot, 명시적 blocker 4개, `home-to-neighborhood` approach `(285,105)`, 대상 spawn `(135,375)`를 유지한다.
- 실사 참조와 픽셀 배경을 좌표 계약에 맞게 다시 생성했다. 현관문은 위 중앙, 소파는 오른쪽, 테이블은 중앙, 신발장은 왼쪽 아래에 두고 spawn에서 현관까지 중앙 보행 통로를 비웠다.
- 픽셀 배경의 오른쪽 아래는 비워 별도 토피어리 전경만 `(420,480,60,90)`, `depthY: 555`로 렌더링되게 했다.
- 맵 배경이 정상 로드된 동안 보행 path 시각 레이어를 투명하게 만들고, 로드 실패 또는 새 구역 진입 전에는 기존 fallback path가 복원되게 했다.
- 새 Home 좌표로 깨진 geometry, movement, GameWorld 회귀 테스트를 행동 기준으로 갱신했다.
- 배경 로드 상태가 이전 구역 ID로 남는 문제는 구역 이동 시 상태를 초기화해 수정했다.

## 자산 메타데이터

- `realistic-reference.png`: PNG `1145x1374`, 정확한 5:6 비율.
- `pixel-background-source.png`: PNG `1145x1374`, 정확한 5:6 비율.
- `topiary-foreground-source.png`: PNG `1024x1536`, 2:3 비율, 알파 `0..255`, 완전 투명 픽셀 `1,169,609`개.
- `background.webp`: lossless WebP `600x720`.
- `topiary-foreground.png`: PNG `60x90`, 알파 `0..255`, 완전 투명 픽셀 `4,023`개.

## 검증 결과

- `pnpm maps:build -- --zone home`: 성공.
- `pnpm --filter @wedding-game/client test -- GameWorld.test.tsx`: 26 files, 190 tests 통과.
- `pnpm --filter @wedding-game/client test -- world.test.ts GameWorld.test.tsx`: 26 files, 190 tests 통과.
- `pnpm --filter @wedding-game/client test`: 26 files, 190 tests 통과.
- `pnpm typecheck`: shared, client, worker 모두 성공.
- 데스크톱 `1440x1000`과 모바일 `390x844` 브라우저 화면을 확인했다. 배경은 `600x720` natural size로 로드됐고, 로드 후 path의 computed background는 투명, box-shadow는 `none`이었다. 중앙 통로, 토피어리 전경, 캐릭터 깊이와 UI 배치를 확인했다.
- 로컬 Worker를 실행하지 않아 실시간 WebSocket 연결 실패가 콘솔에 기록됐지만 솔로 모드 맵 렌더링과는 무관하다.
- 전체 `maps:audit`는 나머지 9개 맵 자산이 아직 없으므로 Task 14 이후 실행한다.

## 커밋

- 최초 구현: `e9f6f86` (`feat: build v2 home map`).
- 최초 검증 기록: `5c0db43` (`docs: record task 5 verification`).
- 리뷰 수정 커밋은 이 보고서와 함께 생성한다. 푸시하지 않는다.

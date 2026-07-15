# Task 5 완료 보고서

## 검토 및 변경

- 기존 Task 5 자산과 `client/src/game/world.ts`, `client/src/game/world.test.ts`를 브리프와 대조했다.
- `home`은 bounds `600x720`, spawn `(285,555)`, floor/entry 경로, directions spot, 명시적 blocked 4개, `home-to-neighborhood` 포털 및 목적 spawn `(135,375)`의 좌표 계약과 일치한다.
- 토피어리 장식은 `(420,480,60,90)`, `topiary-foreground.png`, `depthY: 555`와 일치한다.
- 코드와 테스트는 계약을 충족해 추가 수정하지 않았다. 이 보고서만 이번 완료 작업에서 갱신했다.

## 자산 메타데이터

- `realistic-reference.png`: PNG `1024x1229`, 비율 `0.833198` (5:6 대비 약 `0.02%` 차이).
- `pixel-background-source.png`: PNG `1145x1373`, 비율 `0.833940` (5:6 대비 약 `0.07%` 차이).
- `topiary-foreground-source.png`: PNG `1024x1536`, 비율 `0.666667` (2:3), 알파 최솟값/최댓값 `0/255`, 완전 투명 픽셀 `1,169,609`개.
- `background.webp`: WebP `600x720`.
- `topiary-foreground.png`: PNG `60x90`, 알파 최솟값/최댓값 `0/255`, 완전 투명 픽셀 `4,023`개.
- Sharp 원시 픽셀 검사로 소스와 출력 오버레이 모두 실제 투명 알파를 확인했다. `pnpm maps:build -- --zone home`은 5:6/2:3 허용 오차(3%)를 검증한 뒤 성공했다.

## 검증 결과

- `pnpm maps:build -- --zone home`: 성공.
- `pnpm maps:audit`: 실패. 아직 생성되지 않은 다른 9개 구역의 소스·출력 파일이 없기 때문이며, Home 자산 5개는 모두 존재하고 Home 전용 빌드·Sharp 검사를 통과했다.
- `pnpm --filter @wedding-game/client test -- world.test.ts GameWorld.test.tsx`: 실패 (187건 중 169 통과, 18 실패). `world.test.ts`는 통과했다.
- 실패 18건은 Task 5 소유 범위 밖인 `client/src/game/geometry.test.ts` 2건, `client/src/game/movement.test.ts` 3건, `client/src/components/GameWorld.test.tsx` 13건이다. 모두 이전 Home 크기·spawn·portal approach·목적 spawn 좌표를 하드코딩한 기대값과 새 계약의 불일치다. 해당 파일은 수정하거나 스테이징하지 않았다.
- `pnpm typecheck`: 성공 (shared, client, worker).
- 장시간 브라우저 자동화는 실행하지 않았다. 브라우저 렌더링 검수는 상위 에이전트가 별도 수행한다.

## 커밋

- 기존 Task 5 구현 커밋: `e9f6f8634055f2fe17cb133b07644de1c8673308` (`feat: build v2 home map`).
- 이번 완료 보고서 커밋에는 Task 5 소유 파일인 이 보고서만 포함한다. 푸시하지 않는다.

# Task 11 코드 통합 보고서

## 범위
- 담당: 신부 대기실 코드 통합
- 기준 HEAD: `9c7a4c352a29344731026258715c6732fd663165`
- 수정 파일: `client/src/game/world.ts`, `client/src/game/world.test.ts`, `client/src/game/pathfinding.test.ts`, `client/src/components/GameWorld.test.tsx`, `worker/src/GardenRoom.test.ts`
- 이미지/manifest/`character-assets` 변경 없음

## RED
- 명령: `pnpm --filter @wedding-game/client test -- world.test.ts GameWorld.test.tsx WeddingNpc.test.tsx pathfinding.test.ts`
- 결과: 실패 확인
- 실패 요약:
  - `world.test.ts`: 기존 `bridal-entry-corridor`, floor `90,120,420,360` 등 Task10 임시 geometry가 exact 계약과 불일치
  - `GameWorld.test.tsx`: 신부 NPC 위치/depth가 기존 `(300,225)`/`1225`로 남아 Task11 `(360,285)`/`1285`와 불일치

## GREEN
- `bridal-room` 계약 반영:
  - bounds `720x630`, spawn `(345,525)`
  - paths `bridal-floor (90,90,540,450)`, `bridal-entry (300,510,120,90)`
  - couple spot `(150,150,120,90)`, bride NPC `(360,285)`
  - blocked sofa `(90,330,180,90)`, vanity `(510,240,90,120)`
  - portal `(300,540,120,60)`, approach `(345,555)`, destination lobby `(135,405)`
  - flower overlay `(240,300,90,120)`, `flower-arrangement-front.png`, depthY `420`
- Task10 임시 `bridal-entry-corridor`와 구 대기실 decoration 제거
- worker bridal spawn/bounds는 기존 exact 값 유지, 테스트 명칭/범위 보강

## 검증
- 지정 client: `pnpm --filter @wedding-game/client test -- world.test.ts GameWorld.test.tsx WeddingNpc.test.tsx pathfinding.test.ts` 통과, 26 files / 222 tests
- 지정 worker: `pnpm --filter @wedding-game/worker test -- GardenRoom.test.ts` 통과, 5 files / 57 tests
- 전체 client: `pnpm --filter @wedding-game/client test` 통과, 26 files / 222 tests
- 전체 worker: `pnpm --filter @wedding-game/worker test` 통과, 5 files / 57 tests
- typecheck: `pnpm typecheck` 통과
- diff check: `git diff --check` 통과
- maps build: `client/public/assets/maps/v2/bridal-room/background.webp`와 `flower-arrangement-front.png`가 아직 없어 미실행

## 해시
- 기준 HEAD: `9c7a4c352a29344731026258715c6732fd663165`
- 최종 커밋 해시는 커밋 생성 후 확정된다.

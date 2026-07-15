# Task 13 Code Report

Task 13 화장실 코드 계약을 완료했다. 이미지와 manifest, character-assets는 변경하지 않았다.

## TDD

- RED: `world.test.ts`, `pathfinding.test.ts`, `GameWorld.test.tsx`, `GardenRoom.test.ts`에 restroom `660x660` 계약, spawn 4방향 안전 이동, 세면대/칸막이 충돌, A* 경로, lobby 왕복 fade/final 좌표, stall 전경 깊이, worker spawn/bounds 테스트를 먼저 추가했다.
- RED 확인: 기존 구현은 restroom `540x600`, spawn `(105,315)`, portal approach `(105,315)`, worker bounds `540x600` 때문에 실패했다.
- GREEN: `restroomZone`과 worker spawn/bounds를 Task 13 좌표 계약에 맞춰 교체했다.

## Contract

- bounds/spawn: restroom `660x660`, `(135,345)`.
- paths: `restroom-floor (90,150,480,390)`, `restroom-entry (60,270,90,150)`.
- blocked: sinks `(150,150,240,90)`, stalls `(420,240,150,240)`만 유지해 중복 blocker를 피했다.
- portal: `(30,285,90,120)`, approach `(105,345)`, facing `left`, lobby spawn `(945,405)`.
- lobby-to-restroom destination `(135,345)` 유지.
- stall foreground: `restroom-stall-front (420,240,150,240)`, asset `stall-front.png`, `depthY 480`.
- worker: restroom spawn `(135,345)`, bounds `0..660 / 0..660`.

## Verification

- PASS: `pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts GameWorld.test.tsx`
- PASS: `pnpm --filter @wedding-game/worker test`
- PASS: `pnpm --filter @wedding-game/client test`
- PASS: `pnpm typecheck`
- SKIP: `pnpm maps:build -- --zone restroom` because restroom image outputs were not present in this code-only handoff.

### Task 12 코드 보고서: 예식홀 장축 계약 통합

**범위**
- 이미지/manifest/character-assets는 병렬 담당 범위라 수정하지 않았다.
- `client/src/game/world.ts`, world/minimap/pathfinding/GameWorld 테스트, `worker/src/GardenRoom.ts` 및 테스트만 변경했다.

**RED**
- `world.test.ts`: 예식홀 `780x1920`, spawn `(375,1785)`, 세 path, couple spot, groom/bride NPC, 하단/상단 portal, bouquet 4개 asset/depth, `hall-entry-corridor` 제거, banquet arrival corridor를 먼저 고정했다.
- `pathfinding.test.ts`: 예식홀 spawn에서 하단 portal, 상단 portal, couple 인접 greeting tile까지 전체 aisle A* 경로와 banquet `(585,795)`에서 기존 banquet 출구까지의 경로를 추가했다.
- `minimap.test.ts`: `780x1920` 장축 미니맵이 높이 `120px` 이하이고 route marker가 모두 투영 범위 안에 있는지 추가했다.
- `GameWorld.test.tsx`: lobby→hall→banquet 클릭/도착/fade/final coords, hall stage 크기, NPC 위치/depth, bouquet 4개 asset/depth 렌더링을 추가했다.
- `GardenRoom.test.ts`: ceremony-hall spawn 유지, banquet `(585,795)` spawn/이동 좌표가 clamp되지 않는지 추가했다.
- RED 확인: 구형 hall path/portal/NPC/bouquet, banquet spawn `(525,705|735)` 때문에 client 5건, worker 1건이 실패했다.

**GREEN**
- `ceremony-hall` path를 `hall-aisle (300,90,180,1740)`, `hall-altar-cross (180,120,420,240)`, `hall-entry (240,1740,300,120)`로 교체했다.
- Task 10 임시 `hall-entry-corridor`를 제거했다.
- couple spot `(180,150,90,90)`, groom `(330,255)`, bride `(450,255)`로 갱신했다.
- 하단 portal은 `(330,1830,120,60)`, approach `(375,1815)`, lobby spawn `(525,135)`, facing `down`으로 갱신했다.
- 상단 portal은 `(330,30,120,90)`, approach `(375,105)`, banquet spawn `(585,795)`, facing `up`으로 갱신했다.
- bouquet foreground 4개를 `(270,480)`, `(420,720)`, `(270,960)`, `(420,1200)`, 각 `60x90`, asset `aisle-bouquet-front.png`, depthY `570/810/1050/1290`로 추가했다.
- banquet 전체 redesign 없이 기존 `banquet-floor`에 최소 `banquet-arrival (525,720,120,90)` corridor만 추가하고, banquet spawn/worker spawn을 `(585,795)`로 맞췄다.
- `banquet-to-hall` destination은 새 hall top portal 근처의 walkable tile `(375,135)`로 조정해 전체 portal graph 연결성을 유지했다.

**검증**
- `pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts minimap.test.ts GameWorld.test.tsx`: PASS, 26 files / 228 tests.
- `pnpm --filter @wedding-game/worker test -- GardenRoom.test.ts`: PASS, 5 files / 58 tests.
- `pnpm --filter @wedding-game/client test`: PASS, 26 files / 228 tests.
- `pnpm --filter @wedding-game/worker test`: PASS, 5 files / 58 tests.
- `pnpm typecheck`: PASS.
- `pnpm maps:build -- --zone ceremony-hall`: 실행하지 않음. `client/public/assets/maps/v2/ceremony-hall/background.webp`와 `aisle-bouquet-front.png`가 아직 준비되지 않았다.

**주의**
- `character-assets` 미추적 변경은 기존/병렬 작업물로 보고 건드리지 않았다.
- 새 worktree와 push는 하지 않았다.

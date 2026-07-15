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

### 리뷰 수정: 월드 경계 카메라 clamp

**기준**
- 리뷰 수정 기준 HEAD: `ef4d7fe7e4d0c951580b13232436200fc9bd7742`.
- 원 Task 12 코드 커밋: `bf34054`.
- 수정 대상은 공통 카메라 코드와 client 카메라/GameWorld/미니맵 테스트뿐이며 이미지/manifest/`character-assets`는 수정하지 않았다.

**재현 및 RED**
- 원인은 `computeCameraTransform`이 map bounds를 입력받지 않고 desired tracking 좌표를 그대로 반환해 경계에서도 플레이어를 무조건 중앙에 둔 것이었다.
- `390x520` viewport에서 구 구현은 hall top `(375,105)`에 `camera.y=155`, hall bottom `(375,1815)`에 `camera.y=-1555`, venue bottom `(465,765)`에 `camera.y=-505`를 반환해 stage 바깥 fallback을 노출했다.
- RED 명령: `pnpm --filter @wedding-game/client exec vitest run src/game/camera.test.ts src/game/minimap.test.ts src/components/WorldMiniMap.test.tsx src/components/GameWorld.test.tsx`.
- RED 결과: 4파일 중 3파일 실패, 68건 중 13건 실패. camera 경계 8건, hall 미니맵 viewport 2건, 실제 GameWorld stage/역변환 3건이 새 계약과 정확히 불일치했다.

**GREEN**
- `computeCameraTransform` 입력에 `bounds.width/height`를 추가했다.
- 각 축의 desired tracking 좌표를 먼저 계산한 뒤 scaled map이 viewport보다 크면 `[viewport - mapSize * zoom, 0]`으로 clamp한다.
- scaled map이 viewport보다 작거나 같으면 플레이어 위치와 무관하게 해당 축의 맵 전체를 viewport 중앙에 배치한다.
- `GameWorld`가 매 렌더에서 `activeZone.bounds`를 전달하도록 연결했다.
- 중앙 구간은 플레이어가 정확히 viewport 중앙에 유지되고, hall top은 `camera.y=0`, hall bottom은 `camera.y=-1400`, venue top/bottom은 각각 `0/-380`으로 고정된다.
- 경계 clamp 이후에도 `screenToWorld` 클릭 역변환과 hall top/bottom 미니맵 viewport 투영이 실제 월드 범위를 보존하도록 회귀 테스트를 갱신했다.

**낮음 꽃 socket finding**
- 리뷰 근거로 제시된 실제 모바일 합성 `/tmp/task12-hall-first-socket-mobile.png`에서는 꽃과 금색 받침이 하나의 socket으로 붙어 있고 중복 또는 부유가 없어 finding이 재현되지 않았다.
- 이미지 병렬 담당 범위를 유지하며 이미지/manifest 수정은 하지 않았다.

**리뷰 수정 검증**
- 지정 client: 4파일 / 68테스트 PASS.
- 전체 client: 26파일 / 235테스트 PASS. Node의 기존 `--localstorage-file` 경고 1줄 외 실패 없음.
- 전체 worker: 5파일 / 58테스트 PASS.
- `pnpm typecheck`: shared/client/worker PASS.
- `git diff --check`: PASS.
- 리뷰 수정 커밋 메시지: `fix: clamp tracking camera to map bounds`.
- 최종 커밋 해시는 커밋 생성 후 확정한다.

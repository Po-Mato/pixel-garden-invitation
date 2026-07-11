# Mobile World Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 타일 기반 이동 속도를 안정화하고 네 구역의 시각 품질, 하객 외곽선, 모바일 무스크롤 게임 UI를 완성한다.

**Architecture:** 이동 입력 타이밍은 순수 함수 기반 반복 제어기로 분리하고 `GameWorld`는 그 결과에 따라 기존 `30px` 타일 이동을 실행한다. 월드는 기존 논리 좌표와 데이터 렌더러를 유지하면서 장식 종류와 CSS 깊이 레이어를 확장하며, 모바일에서는 `100dvh` 게임 셸과 오버레이 조작부를 사용한다.

**Tech Stack:** React 18, TypeScript, CSS, Vitest, Testing Library, agent-browser

## Global Constraints

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 새 worktree를 만들지 않고 현재 `main` 워크트리에서 작업한다.
- 사용자가 별도로 요청하기 전까지 커밋, 푸시, 배포하지 않는다.
- 중간 캐릭터 원안 디렉터리는 수정하거나 삭제하지 않는다.
- 논리 타일 크기는 `30px`를 유지한다.
- 첫 이동은 즉시 실행하고, 유지 입력은 `300ms` 뒤부터 `240ms`마다 반복한다.
- 기본 플레이 화면은 `100dvh` 안에 들어오고 문서 스크롤을 만들지 않는다.
- 월드 캐릭터 표시 크기는 `48x72px`를 유지한다.
- 장식 애니메이션은 `prefers-reduced-motion`에서 비활성화한다.

---

### Task 1: 타일 입력 반복 제어기

**Files:**
- Create: `client/src/game/tileInput.ts`
- Create: `client/src/game/tileInput.test.ts`
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/components/GameWorld.test.tsx`

**Interfaces:**
- Produces: `tileInputInitialDelayMs`, `tileInputRepeatIntervalMs`
- Produces: `createTileInputState(now, direction)`, `nextTileInputStep(state, now, direction)`
- Consumes: 기존 `computeNextGridPosition()`과 `gridTileSize`

- [x] **Step 1: 첫 입력, 초기 지연, 반복 간격, 방향 변경을 검증하는 실패 테스트 작성**
- [x] **Step 2: `pnpm --filter @wedding-game/client test -- tileInput.test.ts`로 누락 API 실패 확인**
- [x] **Step 3: 순수 타일 입력 반복 제어기 구현**
- [x] **Step 4: 제어기 테스트 통과 확인**
- [x] **Step 5: GameWorld가 입력 시작 즉시 한 칸 이동하고 300ms 이전에는 반복하지 않는 실패 테스트 작성**
- [x] **Step 6: GameWorld의 requestAnimationFrame 이동 루프를 반복 제어기와 연결**
- [x] **Step 7: 기존 맵 클릭 이동과 실시간 위치 전송 회귀 테스트 통과 확인**

### Task 2: 모바일 무스크롤 게임 셸과 메뉴

**Files:**
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/components/GameWorld.test.tsx`
- Modify: `client/src/styles.css`
- Modify: `client/src/styles.test.ts`

**Interfaces:**
- Produces: `.world-shell`, `.world-hud`, `.world-map-shell`, `.world-control-dock`
- Produces: `초대장 메뉴` 버튼과 `초대장 바로가기` dialog
- Consumes: 기존 `SpotModal`, `VirtualJoystick`, `invitationContent.spots`

- [x] **Step 1: 압축 HUD, 메뉴 버튼, 닫을 수 있는 바로가기 dialog를 요구하는 실패 컴포넌트 테스트 작성**
- [x] **Step 2: `100dvh`, `overflow:hidden`, 유동 맵, 안전 영역, 오버레이 조작부 CSS 계약 실패 테스트 작성**
- [x] **Step 3: GameWorld 마크업을 HUD, 유동 맵, 조작 도크 구조로 재배치**
- [x] **Step 4: 메뉴 dialog 열기, 바로가기 선택, Escape 및 배경 닫기 구현**
- [x] **Step 5: 모바일 높이별 맵 축소와 최소 터치 크기 CSS 구현**
- [x] **Step 6: 컴포넌트와 CSS 테스트 통과 확인**

### Task 3: 하객 캐릭터 픽셀 외곽선

**Files:**
- Modify: `client/src/components/CharacterSprite.tsx`
- Modify: `client/src/components/CharacterSprite.test.tsx`
- Modify: `client/src/styles.css`
- Modify: `client/src/styles.test.ts`

**Interfaces:**
- Produces: `character-sprite--world` 클래스
- Consumes: `CharacterDisplayMode`의 `world`, `thumbnail`, `preview`

- [x] **Step 1: world 모드에만 구분 클래스가 붙는 실패 테스트 작성**
- [x] **Step 2: 월드 클래스의 밝은 1px 및 어두운 2px drop-shadow CSS 계약 실패 테스트 작성**
- [x] **Step 3: 모드 클래스와 픽셀 외곽 효과 구현**
- [x] **Step 4: 미리보기와 썸네일에 외곽 효과가 없는지 회귀 테스트 통과 확인**

### Task 4: 네 구역 장식 깊이와 세부 묘사

**Files:**
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/geometry.test.ts`
- Modify: `client/src/components/WorldDecoration.tsx`
- Modify: `client/src/styles.css`
- Modify: `client/src/styles.test.ts`

**Interfaces:**
- Produces: `flower-fence`, `lily-cluster`, `ribbon-post`, `aisle-bouquet`, `mosaic-star`, `tea-chair`, `party-flag` 장식 종류
- Produces: `.world-map::before`, `.world-map::after` 공통 전경 및 가장자리 레이어
- Consumes: 기존 percentage 좌표 기반 장식 렌더러

- [x] **Step 1: 각 구역 16개 이상 장식, 8종 이상 종류, 구역별 신규 랜드마크를 요구하는 실패 데이터 테스트 작성**
- [x] **Step 2: 신규 장식 클래스와 다섯 깊이 레이어를 요구하는 실패 CSS 테스트 작성**
- [x] **Step 3: 통행로, 스폰, 카드, NPC를 피하는 신규 장식 좌표 추가**
- [x] **Step 4: 신규 장식의 픽셀 도형, 구역별 색상, 전경 레이어 구현**
- [x] **Step 5: reduced-motion과 충돌 회귀 테스트 통과 확인**

### Task 5: 전체 동작 및 시각 검증

**Files:**
- Verify: 전체 워크스페이스
- Create: `.superpowers/character-review/mobile-world-polish-*.png`

**Interfaces:**
- Consumes: Tasks 1-4 결과
- Produces: 네 모바일 높이와 네 구역의 검증 증거

- [x] **Step 1: `pnpm test && pnpm typecheck && pnpm build` 실행**
- [x] **Step 2: 로컬 Worker와 Vite 서버 실행**
- [x] **Step 3: `320x568`, `360x740`, `390x844`, `430x932`에서 문서 스크롤과 경계 이탈 검사**
- [x] **Step 4: 네 구역 스크린샷에서 장식, 카드, NPC, 캐릭터, 조작부 겹침 검사**
- [x] **Step 5: 방향키 유지 입력의 300ms 초기 지연과 240ms 반복을 브라우저에서 확인**
- [x] **Step 6: 캐릭터 외곽선, 메뉴 dialog, 모션 감소, 데스크톱 프레임 확인**
- [x] **Step 7: 발견된 문제를 실패 테스트로 재현한 뒤 수정하고 전체 검증 재실행**

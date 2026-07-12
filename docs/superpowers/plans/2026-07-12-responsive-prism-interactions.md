# 반응형 프리즘 인터랙션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 플레이 화면의 모바일 문서 스크롤을 제거하고 맵의 모든 주요 인터랙션을 새벽빛 프리즘 픽셀 스타일로 통일한다.

**Architecture:** 플레이 상태는 CSS의 `:has(.app-shell--playing)` 선택자와 고정 앱 셸로 동적 뷰포트에 잠근다. 인터랙션은 기존 DOM과 이벤트를 유지하면서 컴포넌트별 CSS 변수, 가상 요소, 포커스·눌림 상태를 추가한다.

**Tech Stack:** React 18, TypeScript, CSS dynamic viewport units, CSS pseudo-elements, Vitest, agent-browser

## 전역 제약

- 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 새 worktree를 만들지 않는다.
- 두 캐릭터 원안 미추적 디렉터리는 수정하거나 커밋하지 않는다.
- 입장 화면의 세로 스크롤은 유지하고 플레이 화면만 무스크롤로 만든다.
- 맵 `390:720`, 논리 타일 `30px`, 캐릭터 `48x72px`를 유지한다.
- 터치 영역과 키보드 포커스 가시성을 축소하지 않는다.

---

### Task 1: 플레이 뷰포트 잠금

**Files:**
- Modify: `client/src/styles.test.ts`
- Modify: `client/src/styles.css`

**Interfaces:**
- Produces: `html:has(.app-shell--playing)`, `body:has(.app-shell--playing)` 플레이 상태 계약
- Consumes: `.app-shell--playing`, `.phone-frame--playing`, `.game-world`

- [x] **Step 1:** 스타일 테스트에 플레이 상태의 `height: 100dvh`, `overflow: hidden`, `overscroll-behavior: none`과 고정 셸을 요구하는 단언을 추가한다.
- [x] **Step 2:** `pnpm --filter @wedding-game/client exec vitest run src/styles.test.ts -t "viewport"`를 실행해 현재 `body`의 `100vh` 계약 때문에 실패하는지 확인한다.
- [x] **Step 3:** 플레이 상태의 `html/body`와 앱 셸을 동적 뷰포트에 고정하고 일반 입장 화면 규칙은 유지한다.
- [x] **Step 4:** 같은 테스트를 다시 실행해 통과시킨다.

### Task 2: 프리즘 인터랙션 계약

**Files:**
- Modify: `client/src/styles.test.ts`
- Modify: `client/src/styles.css`

**Interfaces:**
- Produces: `--zone-accent`, `--spot-accent`, `--portal-accent` 시각 변수
- Consumes: `.world-zone-tabs`, `.world-spot`, `.world-portal`

- [x] **Step 1:** 탭·카드·포털의 색상 변수, 가상 요소, `:focus-visible`을 요구하는 실패 테스트를 작성한다.
- [x] **Step 2:** 테스트가 기존 단색 상자 스타일에서 실패하는지 확인한다.
- [x] **Step 3:** 구역 탭에 구역별 색상, 유리 하이라이트, 활성·눌림·포커스 상태를 구현한다.
- [x] **Step 4:** 정보 카드에 종류별 색상, 마름모 배지, 행동 표시, 포커스 링을 구현한다.
- [x] **Step 5:** 포털에 프리즘 모자이크, 방향 표시, 호버·눌림·포커스 상태를 구현한다.
- [x] **Step 6:** 인터랙션 스타일 테스트를 통과시킨다.

### Task 3: 메뉴와 조이스틱 정리

**Files:**
- Modify: `client/src/styles.test.ts`
- Modify: `client/src/styles.css`

**Interfaces:**
- Produces: 프리즘 메뉴 버튼·시트·바로가기·조이스틱 스타일
- Consumes: `.world-menu-button`, `.world-menu-sheet`, `.world-menu-grid`, `.virtual-joystick`

- [x] **Step 1:** 메뉴와 조이스틱의 얇은 색상 테두리, 광택, 포커스 상태를 요구하는 실패 테스트를 작성한다.
- [x] **Step 2:** 기존 굵은 갈색 상자 스타일에서 실패하는지 확인한다.
- [x] **Step 3:** 메뉴 버튼과 메뉴 시트를 프리즘 유리 스타일로 구현한다.
- [x] **Step 4:** 메뉴 바로가기와 닫기 버튼의 상태를 구현한다.
- [x] **Step 5:** 조이스틱 외곽 링과 방향 버튼 색을 같은 팔레트로 정리한다.
- [x] **Step 6:** 관련 테스트를 통과시킨다.

### Task 4: 실제 반응형·회귀 검증과 배포

**Files:**
- Verify: 전체 워크스페이스

**Interfaces:**
- Consumes: Tasks 1-3 결과
- Produces: 모바일·가로 화면 무스크롤 및 공개 배포 증거

- [x] **Step 1:** 로컬 Worker와 Vite를 실행한다.
- [x] **Step 2:** `320x568`, `360x740`, `390x844`, `430x932`에서 문서와 뷰포트 크기가 같은지 측정한다.
- [x] **Step 3:** `844x390` 가로 화면과 뷰포트 변경 후에도 스크롤이 없는지 측정한다.
- [x] **Step 4:** 네 구역과 메뉴 열린 상태를 캡처해 텍스트·조작부·인터랙션 교차를 확인한다.
- [x] **Step 5:** `pnpm test && pnpm typecheck && pnpm build && git diff --check`를 실행한다.
- [ ] **Step 6:** 변경 파일만 커밋하고 `main`에 푸시한다.
- [ ] **Step 7:** GitHub Pages 작업 성공과 공개 URL의 새 스타일을 확인한다.

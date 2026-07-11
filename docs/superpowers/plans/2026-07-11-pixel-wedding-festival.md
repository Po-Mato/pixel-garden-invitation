# Pixel Wedding Festival Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네 구역을 화려한 픽셀 웨딩 페스티벌로 강화하고 하객의 월드 표시 크기를 유지하면서 픽셀 블록을 2배 굵게 만든다.

**Architecture:** 맵 장식은 기존 데이터 기반 렌더러를 확장하고 구역별 CSS 테마로 표현한다. 캐릭터 생성기는 기존 고해상도 시트와 별도로 `24×36px` 프레임의 월드 시트를 만들며, `CharacterSprite`가 display mode에 따라 적절한 자산과 source size를 선택한다.

**Tech Stack:** React 18, TypeScript, CSS, Sharp, Vitest, Node test runner, agent-browser

## Global Constraints

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 새 worktree를 만들지 않고 현재 워크트리에서 작업한다.
- 중간 원안 디렉터리는 수정하거나 삭제하지 않는다.
- 월드 캐릭터의 표시 크기는 `48×72px`로 유지한다.
- 새 애니메이션은 `prefers-reduced-motion`에서 비활성화한다.

---

### Task 1: 월드 전용 굵은 픽셀 캐릭터 자산

**Files:**
- Modify: `scripts/generate-character-assets.mjs`
- Modify: `scripts/characterAssetGenerator.test.mjs`
- Modify: `client/src/character/assets.ts`
- Modify: `client/src/character/assets.test.ts`
- Modify: `client/src/components/CharacterSprite.tsx`
- Test: `client/src/components/GameWorld.test.tsx`

**Interfaces:**
- Produces: `guests/world/<preset>__walk.png`, `guests/world/<preset>__idle.png`
- Produces: display mode별 `sourceSize`, `walkUrl`, `idleUrl`

- [x] **Step 1: 월드 시트 치수와 출력 개수를 요구하는 실패 테스트 작성**
- [x] **Step 2: 자산 생성 테스트가 기존 28개 출력과 잘못된 치수로 실패하는지 확인**
- [x] **Step 3: Sharp 최근접 리사이즈로 12개 프리셋의 월드 걷기·대기 시트 생성**
- [x] **Step 4: display mode별 URL과 source size 실패 테스트 작성 및 실패 확인**
- [x] **Step 5: 자산 해석과 CharacterSprite source size 선택 구현**
- [x] **Step 6: 자산·클라이언트 관련 테스트 통과 확인**

### Task 2: 구역별 웨딩 페스티벌 장식 데이터

**Files:**
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/geometry.test.ts`
- Modify: `client/src/components/WorldDecoration.tsx`
- Modify: `client/src/components/GameWorld.test.tsx`

**Interfaces:**
- Produces: 각 구역 최소 12개 장식, 최소 6개 종류, 구역별 고유 장식
- Consumes: 기존 percentage 기반 `WorldDecoration` 렌더링

- [x] **Step 1: 장식 밀도와 구역별 고유 종류를 요구하는 실패 테스트 작성**
- [x] **Step 2: 현재 구역별 7~9개 장식으로 실패하는지 확인**
- [x] **Step 3: 새 장식 종류와 충돌하지 않는 좌표 데이터 추가**
- [x] **Step 4: 장식 렌더링 계약 테스트 통과 확인**

### Task 3: 구역별 타일·장식 시각 스타일

**Files:**
- Modify: `client/src/styles.css`
- Modify: `client/src/styles.test.ts`

**Interfaces:**
- Consumes: `world-map--<zone>`, `world-decoration--<kind>` 클래스
- Produces: 네 구역의 서로 다른 배경, 길, 테두리, 픽셀 장식과 reduced-motion 처리

- [x] **Step 1: 네 구역 테마와 새 장식 CSS 계약 실패 테스트 작성**
- [x] **Step 2: CSS 계약이 누락된 선택자로 실패하는지 확인**
- [x] **Step 3: 구역별 타일, 길, 가장자리 및 새 장식 스타일 구현**
- [x] **Step 4: steps 애니메이션과 reduced-motion 해제 구현**
- [x] **Step 5: CSS 계약 테스트 통과 확인**

### Task 4: 전체 시각 및 회귀 검증

**Files:**
- Verify: 전체 워크스페이스
- Create: `.superpowers/character-review/pixel-wedding-festival-*.png`

**Interfaces:**
- Consumes: Tasks 1-3 결과
- Produces: 네 구역 모바일·데스크톱 검증 이미지와 테스트 결과

- [x] **Step 1: `pnpm test`, `pnpm typecheck`, `pnpm build` 실행**
- [x] **Step 2: 로컬 앱에서 네 구역 모바일 스크린샷 생성**
- [x] **Step 3: 데스크톱 화면과 캐릭터 계산 스타일 확인**
- [x] **Step 4: 빈 화면, 오버레이, 가로 넘침, 요소 겹침, 콘솔 오류 확인**
- [x] **Step 5: 발견된 시각 문제를 테스트 우선으로 수정하고 전체 검증 재실행**

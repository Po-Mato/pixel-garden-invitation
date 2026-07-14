# 월드 미니맵 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 10개 맵에서 전체 동선과 현재 위치를 실시간으로 보여주는 우측 상단 상시 표시형 미니맵을 구현한다.

**Architecture:** 좌표 계산은 `game/minimap.ts`의 순수 함수로 분리하고, SVG 렌더링은 `WorldMiniMap.tsx`가 담당한다. `GameWorld.tsx`는 활성 맵, 캐릭터, 카메라, 포털 목표 상태만 전달하며 기존 이동 로직은 변경하지 않는다.

**Tech Stack:** React 18, TypeScript, SVG, Vitest, Testing Library, CSS

## Global Constraints

- 미니맵은 우측 상단에 항상 표시한다.
- 일반 맵은 최대 `96x96px`, 세로로 긴 예식홀은 최대 `72x120px`를 사용한다.
- 원본 맵의 종횡비를 유지한다.
- 맵 경계, 경로, 장애물, 포털, 주요 장소, 캐릭터, 현재 화면 범위를 표시한다.
- 포털 자동 보행 중에는 목표 포털을 강조한다.
- 미니맵은 표시 전용이며 기존 이동과 포털 전환 규칙을 변경하지 않는다.

---

### Task 1: 미니맵 좌표 계산

**Files:**
- Create: `client/src/game/minimap.ts`
- Create: `client/src/game/minimap.test.ts`

**Interfaces:**
- Consumes: `Point`, `WorldBounds`, `ViewportSize`, `CameraTransform`
- Produces: `createMiniMapLayout`, `projectMiniMapPoint`, `projectMiniMapRect`, `computeMiniMapViewportRect`

- [x] **Step 1: 좌표 투영과 종횡비 테스트 작성**
- [x] **Step 2: 테스트를 실행해 필요한 API 부재로 실패하는지 확인**
- [x] **Step 3: 레이아웃, 점, 사각형, 뷰포트 투영 함수 구현**
- [x] **Step 4: `client/src/game/minimap.test.ts` 통과 확인**

### Task 2: SVG 미니맵 컴포넌트

**Files:**
- Create: `client/src/components/WorldMiniMap.tsx`
- Create: `client/src/components/WorldMiniMap.test.tsx`

**Interfaces:**
- Consumes: `WorldZone`, `Point`, `Direction`, `CameraTransform`, `ViewportSize`, `targetPortalId`
- Produces: 표시 전용 `WorldMiniMap` React 컴포넌트

- [x] **Step 1: 맵 경계, 경로, 장애물, 포털, 장소, 캐릭터, 뷰포트 렌더링 테스트 작성**
- [x] **Step 2: 컴포넌트 부재로 실패하는지 확인**
- [x] **Step 3: SVG 레이어와 접근성 구조 구현**
- [x] **Step 4: 컴포넌트 테스트 통과 확인**

### Task 3: 월드 연결과 반응형 스타일

**Files:**
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/components/GameWorld.test.tsx`
- Modify: `client/src/styles.css`
- Modify: `client/src/styles.test.ts`

**Interfaces:**
- Consumes: `WorldMiniMap`
- Produces: 우측 상단 상시 표시 미니맵과 목표 포털 강조 상태

- [x] **Step 1: `GameWorld` 연결과 미니맵 CSS 계약 테스트 작성**
- [x] **Step 2: 테스트를 실행해 연결 부재로 실패하는지 확인**
- [x] **Step 3: `GameWorld` 연결과 반응형 CSS 구현**
- [x] **Step 4: 관련 컴포넌트와 스타일 테스트 통과 확인**

### Task 4: 전체 검증

**Files:**
- Modify: `docs/superpowers/plans/2026-07-14-world-minimap.md`

**Interfaces:**
- Consumes: 완성된 미니맵 기능
- Produces: 검증된 구현 상태

- [x] **Step 1: `pnpm test` 실행**
- [x] **Step 2: `pnpm typecheck` 실행**
- [x] **Step 3: `pnpm build` 실행**
- [x] **Step 4: `320x568`, `390x844`, `430x932`에서 실제 브라우저 렌더링 확인**
- [x] **Step 5: `git diff --check`와 스테이징 제외 파일 확인**

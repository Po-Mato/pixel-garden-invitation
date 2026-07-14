# 조이스틱 포털 진입 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 조이스틱으로 포털 접근 타일에 진입하면 목적 맵으로 즉시 전환한다.

**Architecture:** `GameWorld` 이동 틱이 조이스틱 입력으로 다음 타일에 진입한 직후 포털 `approach`와의 일치를 검사한다. 일치하면 기존 `moveToZone(portal.to, portal.spawn)`을 호출한다.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library

## Global Constraints

- 조이스틱 입력으로 포털 접근 타일에 도착한 즉시 전환한다.
- 기존 포털 클릭 자동 보행 동작을 변경하지 않는다.
- 일반 맵 클릭 이동은 자동 포털 전환을 발생시키지 않는다.
- 전환에는 포털의 `to`와 `spawn`을 사용한다.

---

### Task 1: 조이스틱 포털 도착 회귀 테스트

**Files:**
- Modify: `client/src/components/GameWorld.test.tsx`

- [x] **Step 1:** 포털 직전까지 조이스틱으로 이동해도 현재 맵이 유지되는 테스트를 작성한다.
- [x] **Step 2:** 마지막 타일 진입 시 목적 맵과 `spawn`으로 전환되는 기대값을 작성한다.
- [x] **Step 3:** 기능 미구현으로 테스트가 실패하는지 확인한다.

### Task 2: 조이스틱 진입 즉시 전환

**Files:**
- Modify: `client/src/components/GameWorld.tsx`

- [x] **Step 1:** 조이스틱 입력 이동 후 `next`와 일치하는 포털을 찾는다.
- [x] **Step 2:** 포털이 있으면 `moveToZone` 호출 후 현재 이동 틱을 종료한다.
- [x] **Step 3:** 관련 `GameWorld` 테스트를 통과시킨다.

### Task 3: 전체 검증

**Files:**
- Modify: `docs/superpowers/plans/2026-07-14-joystick-portal-entry.md`

- [x] **Step 1:** `pnpm test`를 실행한다.
- [x] **Step 2:** `pnpm typecheck`를 실행한다.
- [x] **Step 3:** `pnpm build`를 실행한다.
- [x] **Step 4:** 실제 브라우저에서 조이스틱 접근 전환을 확인한다.
- [x] **Step 5:** `git diff --check`를 실행한다.

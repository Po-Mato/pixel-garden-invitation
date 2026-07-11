# Room Capacity And Remote Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한 초대장 방의 실시간 하객을 최대 100명으로 제한하고 원격 하객 이동을 픽셀 스타일에 맞게 짧게 보간한다.

**Architecture:** Durable Object는 하이버네이션 소켓 attachment에서 합류 완료 하객만 집계해 101번째 합류를 `room_full`로 거절한다. 재연결 관리자는 이 오류를 재시도 불가능한 종료로 취급하고, React 화면은 원격 상태만 비우면서 로컬 맵 플레이를 유지한다. 원격 위치는 CSS의 짧은 steps 전환으로 표시하고 모션 감소 환경에서는 전환을 제거한다.

**Tech Stack:** TypeScript, Cloudflare Durable Objects Hibernation WebSocket API, React 18, Vitest, CSS

## Global Constraints

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 새 worktree를 만들지 않고 현재 브랜치와 현재 워크트리에서 작업한다.
- 사용자가 요청하기 전에는 커밋하거나 푸시하지 않는다.
- 기존 로컬 이동, 구역 이동, 재연결 위치 복원 동작을 유지한다.

---

### Task 1: Durable Object 방 정원

**Files:**
- Modify: `worker/src/GardenRoom.ts`
- Test: `worker/src/GardenRoom.test.ts`

**Interfaces:**
- Consumes: `DurableObjectState.getWebSockets()`, 직렬화된 `GuestAttachment`
- Produces: `roomCapacity`, 101번째 join에 대한 `{ type: "error", code: "room_full" }`

- [x] **Step 1: 100명 합류 후 다음 합류가 거절되는 실패 테스트 작성**
- [x] **Step 2: `pnpm --filter @wedding-game/worker test -- GardenRoom.test.ts`로 예상 실패 확인**
- [x] **Step 3: 합류 완료 attachment만 세는 최소 정원 검사 구현**
- [x] **Step 4: Worker 테스트 통과 확인**

### Task 2: 만석 솔로 모드

**Files:**
- Modify: `client/src/realtime/realtimeClient.ts`
- Modify: `client/src/components/GameWorld.tsx`
- Test: `client/src/realtime/realtimeClient.test.ts`
- Test: `client/src/components/GameWorld.test.tsx`

**Interfaces:**
- Consumes: 서버 `room_full` 오류
- Produces: 재시도 중단, `full` 화면 상태, 계속 가능한 로컬 구역 이동

- [x] **Step 1: `room_full` 뒤 재연결하지 않는 실패 테스트 작성 및 실패 확인**
- [x] **Step 2: 재연결 관리자에서 `room_full`을 전달한 뒤 연결과 타이머를 종료**
- [x] **Step 3: 만석 문구와 로컬 이동 유지 실패 테스트 작성 및 실패 확인**
- [x] **Step 4: `GameWorld`의 `full` 상태와 원격 하객 정리 구현**
- [x] **Step 5: 관련 클라이언트 테스트 통과 확인**

### Task 3: 원격 하객 픽셀 보간

**Files:**
- Modify: `client/src/styles.css`
- Test: `client/src/components/GameWorld.test.tsx`

**Interfaces:**
- Consumes: 100ms 간격의 원격 위치 변경
- Produces: 원격 플레이어 전용 90ms `steps(3, end)` 위치 전환과 reduced-motion 해제

- [x] **Step 1: 원격 플레이어 보간 계약을 검증하는 실패 테스트 작성 및 실패 확인**
- [x] **Step 2: 원격 플레이어 데이터 속성과 CSS steps 전환 구현**
- [x] **Step 3: 모션 감소 미디어 쿼리에서 전환 제거**
- [x] **Step 4: 관련 클라이언트 테스트 통과 확인**

### Task 4: 전체 검증

**Files:**
- Verify: 전체 워크스페이스

**Interfaces:**
- Consumes: Tasks 1-3 결과
- Produces: 테스트, 타입 검사, 빌드, Wrangler dry-run, 실제 브라우저 확인 결과

- [x] **Step 1: `pnpm test` 실행**
- [x] **Step 2: `pnpm typecheck` 실행**
- [x] **Step 3: `pnpm build` 실행**
- [x] **Step 4: Wrangler 배포 dry-run 실행**
- [x] **Step 5: 로컬 Worker와 클라이언트에서 만석 상태 및 원격 보간 CSS를 확인**

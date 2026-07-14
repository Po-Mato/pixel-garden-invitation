# 포털 페이드 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 포털 이동에서 접근 타일 도착을 먼저 보여준 뒤 0.15초 정지, 0.25초 페이드아웃, 맵 변경, 0.3초 페이드인 순서로 전환한다.

**Architecture:** `GameWorld`가 포털과 현재 단계를 담은 전환 상태를 관리하고, 조이스틱과 포털 클릭 자동 보행이 하나의 `beginPortalTransition` 함수를 사용한다. 도착·페이드인 단계는 정리 가능한 타이머로, 일반 모션의 맵 교체는 불투명도 `transitionend`로 제어한다. 최상위 전환 레이어와 입력 release latch가 화면 및 입력을 차단하며, Worker는 상태가 실제로 바뀌는 동일 위치 최종 정지 신호만 이동 제한의 예외로 수락한다.

**Tech Stack:** React 18, TypeScript, CSS, Vitest, Testing Library

## Global Constraints

- 작업 경로는 `/Users/sjlee/Documents/New project 5`다.
- 현재 `main` 브랜치와 현재 워크트리에서 작업한다.
- 사용자 요청 전에는 커밋하거나 푸시하지 않는다.
- 캐릭터 원본 관련 미추적 디렉터리를 수정하거나 스테이징하지 않는다.
- 모든 포털 이동에 같은 전환을 적용한다.
- 정상 전환 시간은 도착 정지 `150ms`, 페이드아웃 `250ms`, 페이드인 `300ms`로 약 `700ms`다.
- 맵은 불투명도 `transitionend`가 발생해 화면이 완전히 가려진 뒤에만 변경한다. 이벤트가 유실된 경우에만 `1000ms` 안전 fallback을 사용한다.
- 전환 중에는 조이스틱, 방향키, 맵 클릭, 포털 클릭, 메뉴·장소·NPC UI 진입을 무시한다.
- 전환 시작 시 누르고 있던 조이스틱 포인터 또는 방향키는 해당 입력 자체가 해제될 때까지 새 맵에서도 잠금을 유지한다.
- `prefers-reduced-motion: reduce`에서는 불투명도 transition을 제거하되 `150ms + 250ms + 300ms` 상태 타이밍과 입력 잠금을 유지한다.

---

### Task 1: 포털 전환 타이밍 회귀 테스트

**Files:**
- Modify: `client/src/components/GameWorld.test.tsx`

**Interfaces:**
- Consumes: 기존 `advanceAnimation(now)`과 포털 경로 이동 테스트
- Produces: `advancePortalTransition()` 테스트 헬퍼와 도착·페이드 단계의 기대 동작

- [x] **Step 1: 테스트 타이머 헬퍼를 추가한다**

`beforeEach`에서 `vi.useFakeTimers()`를 활성화하고 `afterEach`에서 `vi.useRealTimers()`로 복원한다. 다음 헬퍼로 각 React effect가 다음 타이머를 등록할 기회를 보장한다.

```ts
function advancePortalTransition() {
  act(() => vi.advanceTimersByTime(150));
  act(() => vi.advanceTimersByTime(250));
  fireTransitionEnd(screen.getByTestId("world-portal-transition"), "opacity");
  act(() => vi.advanceTimersByTime(300));
}
```

기존 `finishCurrentRoute()`는 경로 애니메이션을 끝낸 뒤 `advancePortalTransition()`을 호출하도록 바꿔 기존 포털 테스트의 최종 기대를 유지한다.

- [x] **Step 2: 조이스틱 도착 지연과 맵 변경 시점을 검증하는 실패 테스트를 작성한다**

기존 `enters a portal immediately...` 테스트를 다음 의미로 변경한다.

```ts
it("shows portal arrival before fading into the destination map", () => {
  render(<GameWorld profile={profile} />);
  const joystick = screen.getByLabelText("가상 조이스틱");

  // 기존 입력 순서로 마지막 approach 타일까지 이동한다.
  // 마지막 advanceAnimation(2580) 직후에도 home이어야 한다.
  expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
  expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "225px", top: "135px" });
  expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");

  act(() => vi.advanceTimersByTime(149));
  expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-out");

  act(() => vi.advanceTimersByTime(249));
  expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  fireTransitionEnd(screen.getByTestId("world-portal-transition"), "opacity");
  expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
  expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "285px" });
  expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-in");

  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
});
```

- [x] **Step 3: 포털 클릭 자동 보행도 같은 전환을 사용하는 실패 테스트를 작성한다**

포털 클릭 후 경로의 마지막 RAF까지만 실행하고 `arrival` 상태, 기존 맵, 접근 타일을 확인한다. `150ms` 뒤 fade-out이 시작되고, `250ms`가 지나도 맵이 유지되며 opacity `transitionend` 뒤에만 목적 맵으로 바뀌는지 검증한다.

- [x] **Step 4: 테스트를 실행해 의도한 이유로 실패하는지 확인한다**

Run: `pnpm --filter @wedding-game/client test -- GameWorld.test.tsx`

Expected: 전환 레이어가 없고 포털 도착 즉시 맵이 바뀌어 새 타이밍 테스트가 FAIL한다.

---

### Task 2: 공통 포털 전환 상태와 입력 잠금

**Files:**
- Modify: `client/src/components/GameWorld.tsx`
- Test: `client/src/components/GameWorld.test.tsx`

**Interfaces:**
- Consumes: `WorldPortal`, `Point`, 기존 `moveToZone`, `sendRealtimeMove`
- Produces: `beginPortalTransition(portal: WorldPortal, approach: Point, now: number): void`, `PortalTransitionPhase`, `data-testid="world-portal-transition"`

- [x] **Step 1: 전환 상태 타입과 시간을 정의한다**

```ts
type PortalTransitionPhase = "arrival" | "fade-out" | "fade-in";
type PortalTransition = { portal: WorldPortal; phase: PortalTransitionPhase };

const portalArrivalDelayMs = 150;
const portalFadeOutMs = 250;
const portalFadeInMs = 300;
```

`portalTransition` state와 최신 상태를 동기화하는 `portalTransitionRef`를 추가한다.

- [x] **Step 2: 공통 전환 시작 함수를 구현한다**

`beginPortalTransition`은 전환이 이미 진행 중이면 반환하고, 아래 순서로 기존 맵의 최종 도착 모습을 확정한다.

```ts
const beginPortalTransition = useCallback((portal: WorldPortal, approach: Point, now: number) => {
  if (portalTransitionRef.current) return;

  const transition: PortalTransition = { portal, phase: "arrival" };
  portalTransitionRef.current = transition;
  positionRef.current = approach;
  directionRef.current = portal.facing;
  setPosition(approach);
  setDirection(portal.facing);
  setMoving(false);
  setStepFrame(1);
  setTarget(null);
  setPortalIntent(null);
  setJoystickVector({ x: 0, y: 0 });
  setTravelStatus(`${portal.label} 도착`);
  targetStepAtRef.current = null;
  tileInputStateRef.current = null;
  joystickWasMovingRef.current = false;
  setPortalTransitionState(transition);
  sendRealtimeMove(approach, false, portal.facing, activeZoneIdRef.current, now);
}, [sendRealtimeMove, setPortalIntent]);
```

- [x] **Step 3: 단계별 타이머, transition event와 정리를 구현한다**

`useEffect`는 `arrival`과 `fade-in`에 하나의 타이머를 등록하고 cleanup에서 취소한다. 일반 모션의 `fade-out`은 opacity `transitionend`가 맵 교체를 실행하며, `1000ms` fallback 타이머는 event 유실 시에만 실행된다. 모션 감소 환경은 CSS transition이 없으므로 `250ms` 타이머로 맵을 교체한다.

```ts
useEffect(() => {
  if (!portalTransition) return;

  const timer = window.setTimeout(() => {
    if (portalTransition.phase === "arrival") {
      setPortalTransition({ ...portalTransition, phase: "fade-out" });
      return;
    }
    if (portalTransition.phase === "fade-out") completePortalFadeOut();
    setPortalTransition(null);
  }, portalTransition.phase === "arrival"
    ? portalArrivalDelayMs
    : portalTransition.phase === "fade-out"
      ? prefersReducedMotion() ? portalFadeOutMs : portalFadeOutFallbackMs
      : portalFadeInMs);

  return () => window.clearTimeout(timer);
}, [moveToZone, portalTransition, setPortalTransition]);
```

상태 setter는 state와 ref를 함께 갱신해야 한다. `fade-in` 종료 시에만 ref를 `null`로 만든다.

- [x] **Step 4: 조이스틱과 포털 클릭 진입을 공통 함수로 연결한다**

- 조이스틱이 `portal.approach`에 도착하면 즉시 `moveToZone`하지 않고 `beginPortalTransition(portal, next, now)`을 호출한다.
- 포털 클릭 경로의 마지막 타일에 도착하면 `beginPortalTransition(portalIntent.portal, next, now)`을 호출한다.
- 이미 접근 타일에 있는 상태에서 포털을 클릭하면 `beginPortalTransition(portalItem, portalItem.approach, performance.now())`을 호출한다.

- [x] **Step 5: 전환 중 모든 이동 진입점을 차단하는 실패 테스트를 작성한다**

페이드인 단계에서 맵 클릭과 조이스틱 방향 입력을 보내고 RAF를 진행해도 목적 맵의 `spawn`이 유지되는지 확인한다. 페이드인 종료 후 같은 조이스틱 입력으로 한 타일 이동할 수 있는지도 확인한다.

- [x] **Step 6: 입력 핸들러와 이동 effect를 잠근다**

`handlePortalClick`, `handleMapClick`, `handleJoystickVectorChange`의 시작에서 `portalTransitionRef.current`가 있으면 반환한다. 이동 effect도 전환 상태에서는 새 RAF를 등록하지 않도록 한다.

- [x] **Step 7: 전환 상태를 노출하는 의미적 레이어를 렌더링한다**

`GameWorld` 최상단 section 안에 다음 레이어를 추가한다. 시각 스타일은 Task 3에서 적용한다.

```tsx
<div
  className={`world-portal-transition world-portal-transition--${portalTransition?.phase ?? "idle"}`}
  data-testid="world-portal-transition"
  data-phase={portalTransition?.phase ?? "idle"}
  aria-hidden="true"
/>
```

전환 중인 section에는 `aria-busy="true"`를 적용한다.

- [x] **Step 8: 관련 테스트가 통과하는지 확인한다**

Run: `pnpm --filter @wedding-game/client test -- GameWorld.test.tsx`

Expected: `GameWorld` 테스트 전체 PASS.

---

### Task 3: 페이드 스타일과 모션 감소 대응

**Files:**
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/styles.css`
- Test: `client/src/components/GameWorld.test.tsx`

**Interfaces:**
- Consumes: `portalTransition?.phase`
- Produces: `.world-portal-transition--<phase>` 시각 스타일

- [x] **Step 1: Task 2의 전환 레이어 상태 연결을 확인한다**

`GameWorld`가 `idle`, `arrival`, `fade-out`, `fade-in` class와 `data-phase`를 렌더링하는지 확인하고 CSS 클래스 계약을 그대로 사용한다.

- [x] **Step 2: 단계별 페이드 스타일을 구현한다**

```css
.world-portal-transition {
  position: absolute;
  inset: 0;
  z-index: 30;
  background: #211f26;
  opacity: 0;
  pointer-events: none;
  transition-property: opacity;
  transition-timing-function: ease-in;
}

.world-portal-transition--arrival {
  pointer-events: auto;
  transition-duration: 0ms;
}

.world-portal-transition--fade-out {
  opacity: 1;
  pointer-events: auto;
  transition-duration: 250ms;
}

.world-portal-transition--fade-in {
  opacity: 0;
  pointer-events: auto;
  transition-duration: 300ms;
  transition-timing-function: ease-out;
}

.world-portal-transition--idle {
  transition-duration: 0ms;
}
```

- [x] **Step 3: 모션 감소 스타일을 추가한다**

기존 `@media (prefers-reduced-motion: reduce)`에 다음 규칙을 추가한다.

```css
.world-portal-transition {
  transition: none;
}
```

- [x] **Step 4: DOM 상태 테스트를 통과시킨다**

Run: `pnpm --filter @wedding-game/client test -- GameWorld.test.tsx`

Expected: 전환 단계, 맵 변경 시점, 입력 잠금 테스트 전체 PASS.

---

### Task 4: 전체 및 실제 화면 검증

**Files:**
- Modify: `docs/superpowers/plans/2026-07-14-portal-fade-transition.md`

**Interfaces:**
- Consumes: 완성된 포털 전환 구현
- Produces: 검증 완료 체크리스트

- [x] **Step 1: 전체 테스트를 실행한다**

Run: `pnpm test`

Expected: 모든 패키지 테스트 PASS.

- [x] **Step 2: 타입 검사를 실행한다**

Run: `pnpm typecheck`

Expected: 오류 없이 종료 코드 0.

- [x] **Step 3: 프로덕션 빌드를 실행한다**

Run: `pnpm build`

Expected: 캐릭터 자산 검사와 client/shared/worker 빌드가 모두 PASS.

- [x] **Step 4: 변경 형식을 검사한다**

Run: `git diff --check`

Expected: 출력 없이 종료 코드 0.

- [x] **Step 5: 브라우저에서 두 입력 방식을 확인한다**

로컬 개발 서버에서 다음을 확인한다.

1. 조이스틱으로 포털에 진입하면 접근 타일에서 잠깐 멈춘다.
2. 기존 맵이 완전히 어두워진 뒤 다음 맵이 나타난다.
3. 포털 클릭 자동 보행도 같은 전환을 사용한다.
4. 전환 중 연속 입력으로 위치가 바뀌거나 중복 전환되지 않는다.
5. 모바일 크기와 데스크톱 크기에서 레이어가 월드 전체를 덮고 다른 UI와 겹침 문제가 없다.

- [x] **Step 6: 배포하지 않은 변경 상태를 보고한다**

사용자가 별도로 요청하기 전에는 커밋, 푸시, 배포를 수행하지 않는다.

---

### Task 5: 최종 경계 조건 보강

- [x] opacity `transitionend`의 target, property, phase를 검사하고 중복 event와 늦은 fallback을 무시한다.
- [x] 전환 중 메뉴·장소·NPC의 포인터 및 키보드 재진입을 차단한다.
- [x] 조이스틱이 실제로 누른 방향키·포인터를 추적하고 window `keyup`을 구독해 포커스 이동 뒤에도 원래 입력을 해제하며, 관계없는 해제 이벤트가 release latch를 풀지 못하게 한다.
- [x] Worker는 동일 zone·좌표, 증가한 seq, `moving=false`이면서 이동 종료 또는 방향 변경인 메시지만 throttle 안에서 `100ms` 창당 한 번 수락한다.
- [x] 일반 이동 spam, 동일 방향의 중복 정지, 목적지 spawn 중복 전송이 계속 차단되는지 회귀 테스트로 검증한다.

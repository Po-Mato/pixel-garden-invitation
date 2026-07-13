# Dawn Prism Entry Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 초기 캐릭터 선택 화면을 새벽 프리즘 웨딩 정원으로 재구성하고 모든 텍스트가 장식보다 앞에 선명하게 표시되도록 한다.

**Architecture:** 기존 `EntryScreen`의 상태와 제출 흐름, `CharacterCustomizer`의 프리셋 선택 흐름은 유지한다. 의미 없는 장식과 전면 조작 밴드에 필요한 최소 구조 클래스만 추가하고, 시각 구성과 쌓임 순서는 진입 화면 범위의 CSS에서 책임진다.

**Tech Stack:** React 18, TypeScript, CSS, Vitest, Testing Library, agent-browser

## Global Constraints

- 현재 브랜치와 `/Users/sjlee/Documents/New project 5` 워크트리에서 작업하며 새 worktree를 만들지 않는다.
- 사용자 요청 전까지 커밋과 푸시를 하지 않는다.
- 캐릭터 자산, 상태 모델, 저장 키, 게임 입장 데이터 흐름을 변경하지 않는다.
- 외부 이미지와 새 런타임 의존성을 추가하지 않는다.
- `320px` 너비와 `568px` 높이에서도 세로 문서 스크롤 없이 모든 입력과 버튼을 사용할 수 있어야 한다.
- 장식은 `pointer-events: none`이고 텍스트·캐릭터·입력·버튼보다 낮은 쌓임 순서를 가져야 한다.
- `prefers-reduced-motion`에서 새 장식 애니메이션을 정지한다.

---

### Task 1: 전면 콘텐츠와 장식 레이어 구조

**Files:**
- Modify: `client/src/components/EntryScreen.test.tsx`
- Modify: `client/src/components/CharacterCustomizer.test.tsx`
- Modify: `client/src/components/EntryScreen.tsx`
- Modify: `client/src/components/CharacterCustomizer.tsx`

**Interfaces:**
- Consumes: 기존 `EntryProfile`, `CharacterAppearance`, `onEnter`, `onChange` 인터페이스
- Produces: `.entry-screen__ambient`, `.entry-screen__controls`, `.character-customizer__stage`, `.character-customizer__selected-name`, `.customizer-option__label` 구조 클래스

- [x] **Step 1: 장식과 전면 콘텐츠 구조를 요구하는 테스트 작성**

```tsx
it("keeps ambient decoration outside the foreground entry controls", () => {
  const { container } = render(<EntryScreen onEnter={vi.fn()} />);
  expect(container.querySelector(".entry-screen__ambient")).toHaveAttribute("aria-hidden", "true");
  expect(container.querySelector(".entry-screen__controls")).toContainElement(screen.getByLabelText("닉네임"));
  expect(container.querySelector(".entry-screen__controls")).toContainElement(screen.getByRole("button", { name: "정원 입장" }));
});

it("separates decorative stage layers from readable preset labels", () => {
  const { container } = render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  const selectedCard = screen.getByRole("button", { name: "크림 롱 웨이브 원피스" });
  expect(container.querySelector(".character-customizer__stage")).toHaveAttribute("aria-hidden", "true");
  expect(selectedCard.querySelector(".customizer-option__label")).toHaveTextContent("크림 롱 웨이브 원피스");
  expect(container.querySelector(".character-customizer__selected-name")).toHaveTextContent("크림 롱 웨이브 원피스");
});
```

- [x] **Step 2: 컴포넌트 테스트를 실행해 새 구조가 없어 실패하는지 확인**

Run: `pnpm --filter @wedding-game/client test -- EntryScreen.test.tsx CharacterCustomizer.test.tsx`

Expected: `.entry-screen__ambient`, `.entry-screen__controls`, `.character-customizer__stage`, `.customizer-option__label` 관련 assertion 실패

- [x] **Step 3: 상태 흐름을 바꾸지 않고 구조 클래스 추가**

`EntryScreen`에서 헤더 앞에 `aria-hidden="true"`인 ambient 요소를 추가하고 닉네임 필드와 입장 버튼을 `.entry-screen__controls`로 감싼다. `CharacterCustomizer`의 preview 안에는 `aria-hidden="true"`인 stage 요소를 추가하고 카드 이름에 `.customizer-option__label`을 부여한다. 기존 버튼 이름, 이벤트 핸들러, `CharacterSprite` 속성은 유지한다.

- [x] **Step 4: 컴포넌트 테스트 통과 확인**

Run: `pnpm --filter @wedding-game/client test -- EntryScreen.test.tsx CharacterCustomizer.test.tsx`

Expected: 관련 테스트 전체 PASS

---

### Task 2: 새벽 프리즘 스타일과 레이어 계약

**Files:**
- Modify: `client/src/styles.test.ts`
- Modify: `client/src/styles.css`

**Interfaces:**
- Consumes: Task 1의 구조 클래스
- Produces: 진입 화면 색상 토큰, 명시적 쌓임 순서, 불투명 텍스트 표면, 두 줄 카드 라벨, 모션 감소 규칙

- [x] **Step 1: 레이어·라벨·반응형 CSS 계약 테스트 작성**

`client/src/styles.test.ts`의 entry screen describe에 다음 요구사항을 추가한다.

```ts
it("keeps readable entry content above decorative layers", () => {
  expect(styles).toMatch(/\.entry-screen__ambient\s*\{[^}]*z-index:\s*0;[^}]*pointer-events:\s*none;/s);
  expect(styles).toMatch(/\.entry-screen__header\s*\{[^}]*z-index:\s*2;/s);
  expect(styles).toMatch(/\.character-customizer__selected-name\s*\{[^}]*z-index:\s*5;[^}]*background:/s);
  expect(styles).toMatch(/\.entry-screen__controls\s*\{[^}]*z-index:\s*3;/s);
});

it("keeps Korean preset names readable in at most two lines", () => {
  const labelRule = styles.match(/\.customizer-option__label\s*\{([^}]*)}/s)?.[1] ?? "";
  expect(labelRule).toContain("word-break: keep-all;");
  expect(labelRule).toContain("-webkit-line-clamp: 2;");
});

it("adapts the entry composition for short mobile viewports", () => {
  expect(styles).toMatch(/@media \(max-height:\s*640px\)[\s\S]*\.character-customizer/);
  expect(styles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*entry-prism/);
});
```

- [x] **Step 2: CSS 계약 테스트가 기존 스타일에서 실패하는지 확인**

Run: `pnpm --filter @wedding-game/client test -- styles.test.ts`

Expected: 새 레이어와 라벨 규칙 assertion 실패

- [x] **Step 3: 진입 화면 범위의 CSS를 새벽 프리즘 정원으로 교체**

다음 구현 원칙을 적용한다.

```css
.entry-screen {
  position: relative;
  isolation: isolate;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.entry-screen__ambient {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.entry-screen__header { position: relative; z-index: 2; }
.entry-screen__controls { position: relative; z-index: 3; }
.character-customizer__stage { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.character-customizer__sprite { position: relative; z-index: 4; }
.character-customizer__selected-name { position: relative; z-index: 5; background: var(--entry-pearl); }
```

헤더에는 새벽 청록과 코랄 별빛, 무대에는 유리 온실 창과 꽃 아치·화단·프리즘 모자이크, 패널에는 진주 아이보리와 금빛 프레임을 사용한다. 장식은 가상 요소와 stage 자식으로 구현하고 텍스트 영역에는 복잡한 배경을 두지 않는다. 카드 라벨은 `display: -webkit-box`, `-webkit-box-orient: vertical`, `-webkit-line-clamp: 2`, `word-break: keep-all`, `overflow: hidden`을 사용한다.

- [x] **Step 4: 짧은 높이와 모션 감소 스타일 추가**

`@media (max-height: 640px)`에서 헤더 간격, 무대 장식, 캐러셀 카드 높이만 줄인다. `@media (prefers-reduced-motion: reduce)`에서 `entry-prism-twinkle`, `entry-petal-drift`, 선택 카드 부유 모션을 `animation: none`으로 정지한다.

- [x] **Step 5: CSS 계약과 컴포넌트 테스트 통과 확인**

Run: `pnpm --filter @wedding-game/client test -- styles.test.ts EntryScreen.test.tsx CharacterCustomizer.test.tsx`

Expected: 관련 테스트 전체 PASS

---

### Task 3: 실제 브라우저 반응형·레이어 검증

**Files:**
- Modify as needed: `client/src/styles.css`
- Evidence: `/tmp/dawn-prism-entry-320x568.png`
- Evidence: `/tmp/dawn-prism-entry-390x844.png`
- Evidence: `/tmp/dawn-prism-entry-430x932.png`

**Interfaces:**
- Consumes: Task 1~2의 완성 화면
- Produces: 세 뷰포트 스크린샷과 DOM 경계 검사 결과

- [x] **Step 1: 개발 서버 실행**

Run: `pnpm --filter @wedding-game/client dev --host 127.0.0.1`

Expected: Vite local URL 출력

- [x] **Step 2: 세 뷰포트 스크린샷 생성**

agent-browser로 `320x568`, `390x844`, `430x932`를 각각 열고 스크린샷을 `/tmp`에 저장한다. 각 캡처에서 헤더, 캐릭터, 이름 명패, 카드 이름, 닉네임 입력, 입장 버튼이 화면 안에 보여야 한다.

- [x] **Step 3: DOM 경계와 쌓임 순서 검사**

각 뷰포트에서 `document.documentElement.scrollHeight <= window.innerHeight`, 모든 주요 요소의 `getBoundingClientRect()`가 뷰포트 안에 있는지 확인한다. `getComputedStyle()`로 ambient/stage 장식보다 헤더, 이름 명패, controls의 `z-index`가 큰지 확인한다.

- [x] **Step 4: 실패한 뷰포트만 CSS 조정하고 재검사**

텍스트가 잘리면 글자 크기가 아니라 컨테이너 높이·간격·두 줄 제한을 조정한다. 캐릭터가 눌리면 스프라이트 크기를 바꾸지 않고 무대의 남는 높이를 조정한다. 수정 후 세 스크린샷과 경계 검사를 다시 수행한다.

---

### Task 4: 전체 회귀 검증

**Files:**
- Verify: `client/src/components/EntryScreen.tsx`
- Verify: `client/src/components/CharacterCustomizer.tsx`
- Verify: `client/src/styles.css`
- Verify: `client/src/**/*.test.ts*`

**Interfaces:**
- Consumes: 완성된 진입 화면
- Produces: 테스트·타입 검사·빌드·diff 검사 증거

- [x] **Step 1: 전체 테스트 실행**

Run: `pnpm test`

Expected: asset, shared, client, worker 테스트 전체 PASS

- [x] **Step 2: 타입 검사 실행**

Run: `pnpm typecheck`

Expected: 모든 workspace TypeScript 검사 PASS

- [x] **Step 3: 프로덕션 빌드 실행**

Run: `VITE_WORKER_URL=https://pixel-garden-worker.po-mato.workers.dev VITE_INVITATION_ID=sample-garden pnpm build`

Expected: client와 worker 빌드 PASS

- [x] **Step 4: 변경 범위와 whitespace 검사**

Run: `git diff --check`

Expected: 출력 없음. 변경은 설계·계획 문서, 두 컴포넌트와 해당 테스트, `styles.css`, `styles.test.ts`로 제한한다.

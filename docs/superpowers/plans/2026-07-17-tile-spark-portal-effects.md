# 타일 불꽃 포털 효과 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방향과 맞지 않는 사다리꼴 빛기둥을 제거하고 각 포털 진입 타일의 발광과 짧은 픽셀 불꽃을 강화해 배포한다.

**Architecture:** `GameWorld`에서는 포털 전체 기준 beam·particle DOM을 제거하고 세 타일만 렌더링한다. 각 타일의 중심 문양은 `::before`, 최대 24px 상승하는 불꽃은 `::after`로 구현하며 타일별 animation delay로 움직임을 분산한다. 포털 데이터, 이동 판정, 깊이와 미니맵은 변경하지 않는다.

**Tech Stack:** React 19, TypeScript, CSS pseudo-elements, CSS keyframes, Vitest, Testing Library, Vite, GitHub Actions Pages

## Global Constraints

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 새 worktree를 만들지 않고 현재 `main` 워크트리에서 순차 실행한다.
- 각 포털의 3타일 데이터, `90x30px`·`30x90px` 판정 영역과 최단 타일 보행은 변경하지 않는다.
- 포털 깊이 `worldDepth(approach.y) - 100`과 정보 버튼 `z-index: 9000`을 유지한다.
- `.world-portal__beam`과 `.world-portal__particle` DOM·CSS·keyframes를 모두 제거한다.
- 불꽃은 각 `30x30px` 타일에서 최대 `24px`만 상승한다.
- 목표 포털의 금빛 변수와 reduced-motion 정적 발광을 유지한다.
- 관련 없는 미추적 캐릭터 원안 디렉터리는 스테이징하거나 변경하지 않는다.
- 전체 테스트·타입 검사·빌드 후 `main`을 푸시하고 `.github/workflows/pages.yml`과 공개 URL을 검증한다.

---

### Task 1: 포털 전체 빛기둥과 입자 DOM 제거

**Files:**
- Modify: `client/src/components/GameWorld.tsx:699-714`
- Test: `client/src/components/GameWorld.test.tsx:974-988`

**Interfaces:**
- Consumes: 기존 `.world-portal__effect`, `.world-portal__tiles`, `WorldPortal.entryTiles`.
- Produces: beam·전역 particle 없이 세 `.world-portal__tile`만 포함하는 장식 DOM.

- [ ] **Step 1: beam·particle 부재를 요구하는 실패 테스트 작성**

`client/src/components/GameWorld.test.tsx`의 포털 장식 테스트를 다음 계약으로 교체한다.

```tsx
it("renders only three tile-local portal effects without global beams or particles", () => {
  render(<GameWorld profile={profile} />);
  const portal = screen.getByRole("button", { name: "동네로 나가기" });
  const effect = portal.querySelector(".world-portal__effect");

  expect(portal).toHaveAccessibleName("동네로 나가기");
  expect(effect).toHaveAttribute("aria-hidden", "true");
  expect(effect?.querySelectorAll(".world-portal__tile")).toHaveLength(3);
  expect(effect?.querySelector(".world-portal__beam")).not.toBeInTheDocument();
  expect(effect?.querySelector(".world-portal__particle")).not.toBeInTheDocument();
  expect(portal.querySelector(".world-portal__label")).toHaveTextContent("동네로 나가기");
});
```

- [ ] **Step 2: 컴포넌트 테스트가 기존 beam·particle DOM 때문에 실패하는지 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/components/GameWorld.test.tsx
```

Expected: `.world-portal__beam`과 `.world-portal__particle`이 존재해 FAIL.

- [ ] **Step 3: 전역 장식 DOM 제거**

`GameWorld.tsx`의 `.world-portal__effect`를 다음 구조로 줄인다.

```tsx
<span className="world-portal__effect" aria-hidden="true">
  <span className="world-portal__tiles">
    {portalItem.entryTiles.map((tile) => (
      <span key={`${tile.x}-${tile.y}`} className="world-portal__tile" />
    ))}
  </span>
</span>
```

- [ ] **Step 4: 컴포넌트 테스트 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/components/GameWorld.test.tsx
```

Expected: 48개 테스트 모두 PASS.

- [ ] **Step 5: 장식 DOM 커밋**

```bash
git add client/src/components/GameWorld.tsx client/src/components/GameWorld.test.tsx
git commit -m "refactor: remove portal beam markup"
```

---

### Task 2: 타일별 발광과 짧은 픽셀 불꽃 적용

**Files:**
- Modify: `client/src/styles.css:1776-1904,2305-2310`
- Test: `client/src/styles.test.ts:309-337`

**Interfaces:**
- Consumes: Task 1의 `.world-portal__tile` 세 개와 기존 포털 색상 변수.
- Produces: `portal-tile-pulse`, `portal-tile-spark`, `--portal-tile-delay`, 타일별 중심 문양과 최대 24px 불꽃.

- [ ] **Step 1: 타일 발광·불꽃 CSS 실패 테스트 작성**

`client/src/styles.test.ts`의 포털 스타일 테스트를 다음 계약으로 바꾼다.

```ts
it("renders three enhanced tiles with short local sparks and no trapezoid beam styles", () => {
  const effectRule = styles.match(/\.world-portal__effect\s*\{([^}]*)}/s)?.[1] ?? "";
  const tileRule = styles.match(/\.world-portal__tile\s*\{([^}]*)}/s)?.[1] ?? "";
  const runeRule = styles.match(/\.world-portal__tile::before\s*\{([^}]*)}/s)?.[1] ?? "";
  const sparkRule = styles.match(/\.world-portal__tile::after\s*\{([^}]*)}/s)?.[1] ?? "";
  const sparkFrames = styles.match(/@keyframes portal-tile-spark\s*\{([\s\S]*?)\n}/)?.[1] ?? "";

  expect(effectRule).toContain("drop-shadow(0 0 8px var(--portal-glow))");
  expect(tileRule).toContain("width: 30px;");
  expect(tileRule).toContain("height: 30px;");
  expect(tileRule).toContain("--portal-tile-delay: 0s;");
  expect(tileRule).toMatch(/animation:\s*portal-tile-pulse[^;]*var\(--portal-tile-delay\)/);
  expect(runeRule).toContain("content: \"\";");
  expect(sparkRule).toContain("content: \"\";");
  expect(sparkRule).toMatch(/animation:\s*portal-tile-spark[^;]*var\(--portal-tile-delay\)/);
  expect(sparkFrames).toContain("translate(-50%, -24px)");
  expect(styles).toMatch(/\.world-portal__tile:nth-child\(2\)\s*\{[^}]*--portal-tile-delay:\s*-0\.38s;/s);
  expect(styles).toMatch(/\.world-portal__tile:nth-child\(3\)\s*\{[^}]*--portal-tile-delay:\s*-0\.76s;/s);
  expect(styles).not.toContain(".world-portal__beam");
  expect(styles).not.toContain(".world-portal__particle");
  expect(styles).not.toContain("portal-beam-rise");
  expect(styles).not.toContain("portal-particle-rise");
  expect(styles).toMatch(
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.world-portal__tile,[\s\S]*\.world-portal__tile::after\s*\{[^}]*animation:\s*none !important;/
  );
});
```

- [ ] **Step 2: 스타일 테스트가 기존 beam·particle CSS와 약한 타일 효과 때문에 실패하는지 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/styles.test.ts
```

Expected: `portal-tile-spark`, delay와 강화된 그림자가 없고 beam·particle CSS가 남아 있어 FAIL.

- [ ] **Step 3: beam·particle CSS와 keyframes 제거**

`client/src/styles.css`에서 다음 블록을 삭제한다.

```text
.world-portal__beam
.world-portal__beam--outer
.world-portal__beam--core
.world-portal__particle
.world-portal__particle--one부터 --four
@keyframes portal-beam-rise
@keyframes portal-particle-rise
```

`.world-portal__effect`의 필터는 다음으로 강화한다.

```css
filter: drop-shadow(0 0 8px var(--portal-glow));
```

- [ ] **Step 4: 타일 발광과 중심 문양 구현**

타일 기본 규칙과 중심 문양을 다음 구조로 교체한다.

```css
.world-portal__tile {
  --portal-tile-delay: 0s;
  position: relative;
  box-sizing: border-box;
  width: 30px;
  height: 30px;
  border: 2px solid var(--portal-core);
  border-radius: 3px;
  background:
    radial-gradient(circle at center, var(--portal-core) 0 2px, color-mix(in srgb, var(--portal-accent) 88%, transparent) 3px 7px, transparent 8px),
    linear-gradient(135deg, transparent 38%, color-mix(in srgb, var(--portal-core) 78%, transparent) 39% 45%, transparent 46% 54%, color-mix(in srgb, var(--portal-core) 78%, transparent) 55% 61%, transparent 62%),
    repeating-linear-gradient(90deg, color-mix(in srgb, var(--portal-accent) 88%, transparent) 0 4px, color-mix(in srgb, var(--portal-deep) 78%, transparent) 4px 8px);
  box-shadow:
    inset 0 0 0 3px color-mix(in srgb, var(--portal-core) 54%, transparent),
    inset 0 0 8px color-mix(in srgb, var(--portal-core) 72%, transparent),
    0 0 0 1px color-mix(in srgb, var(--portal-deep) 82%, transparent),
    0 0 10px 3px var(--portal-glow);
  animation: portal-tile-pulse 1.15s steps(4, end) var(--portal-tile-delay) infinite;
}

.world-portal__tile::before {
  position: absolute;
  inset: 6px;
  border: 2px solid var(--portal-core);
  border-radius: 2px;
  background: color-mix(in srgb, var(--portal-core) 24%, transparent);
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--portal-deep) 68%, transparent), 0 0 5px var(--portal-glow);
  content: "";
}
```

- [ ] **Step 5: 타일별 짧은 불꽃과 지연 구현**

```css
.world-portal__tile::after {
  position: absolute;
  left: 50%;
  bottom: 20px;
  width: 3px;
  height: 4px;
  background: var(--portal-core);
  box-shadow:
    -7px 5px 0 color-mix(in srgb, var(--portal-accent) 78%, transparent),
    7px 2px 0 color-mix(in srgb, var(--portal-core) 72%, transparent);
  content: "";
  opacity: 0;
  animation: portal-tile-spark 1.3s steps(5, end) var(--portal-tile-delay) infinite;
}

.world-portal__tile:nth-child(2) { --portal-tile-delay: -0.38s; }
.world-portal__tile:nth-child(3) { --portal-tile-delay: -0.76s; }

@keyframes portal-tile-spark {
  0% { opacity: 0; transform: translate(-50%, 4px) scale(0.75); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -24px) scale(1); }
}
```

reduced-motion 블록을 다음으로 바꾼다.

```css
.world-portal__tile,
.world-portal__tile::after {
  animation: none !important;
}
```

- [ ] **Step 6: 스타일·컴포넌트 테스트 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/client exec vitest run src/styles.test.ts src/components/GameWorld.test.tsx
```

Expected: 두 파일의 75개 테스트 모두 PASS.

- [ ] **Step 7: 타일 효과 커밋**

```bash
git add client/src/styles.css client/src/styles.test.ts
git commit -m "style: replace portal beams with tile sparks"
```

---

### Task 3: 전체 회귀·시각 검증·배포

**Files:**
- Verify: `client/src/components/GameWorld.tsx`
- Verify: `client/src/styles.css`
- Verify: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: Tasks 1-2의 타일 전용 포털 장식.
- Produces: 테스트·빌드가 통과하고 공개 Pages에 반영된 포털 효과.

- [ ] **Step 1: 클라이언트 전체 검증**

Run:

```bash
pnpm --filter @wedding-game/client test
pnpm --filter @wedding-game/client typecheck
```

Expected: 전체 Vitest와 TypeScript 검사 PASS.

- [ ] **Step 2: 저장소 전체 테스트·타입 검사·빌드**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: 맵·캐릭터·shared·client·worker 검증과 프로덕션 빌드 모두 exit code 0.

- [ ] **Step 3: 로컬 preview와 시각 검증**

Run:

```bash
pnpm --filter @wedding-game/client exec vite preview --host 127.0.0.1 --port 58862
```

`http://127.0.0.1:58862/`에서 데스크톱 `1440x900`, 모바일 `390x844`, 가로 화면 `844x390`으로 다음을 확인한다.

```text
1. 가로·세로 포털 모두 사다리꼴이나 넓은 수직광이 없다.
2. 각 포털에 동일한 크기의 타일 세 개가 보인다.
3. 각 타일에서만 작은 불꽃이 짧게 상승한다.
4. 타일 중심 문양과 외곽광이 이전보다 선명하다.
5. 캐릭터가 타일과 불꽃보다 앞에 표시된다.
6. 포털 라벨, 미니맵과 조이스틱이 겹치거나 이동 입력을 발생시키지 않는다.
```

- [ ] **Step 4: 최종 범위 확인과 `main` 푸시**

Run:

```bash
git status -sb
git diff origin/main...HEAD --stat
git push origin main
```

Expected: 관련 문서·컴포넌트·스타일·테스트 커밋만 `main`으로 푸시되고 미추적 원안 디렉터리는 제외됨.

- [ ] **Step 5: Pages 실행 완료 대기**

Run:

```bash
run_id=$(gh run list --workflow pages.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$run_id" --exit-status
```

Expected: `Deploy client to GitHub Pages`의 build·deploy 단계가 success.

- [ ] **Step 6: 공개 URL 확인**

Run:

```bash
curl -fsSI https://po-mato.github.io/pixel-garden-invitation/
```

Expected: HTTP 200. 라이브 CSS·JS에 `portal-tile-spark`가 있고 `portal-beam-rise`, `.world-portal__beam`, `.world-portal__particle`은 없어야 한다. 라이브 브라우저에서도 가로·세로 포털을 다시 확인한다.

- [ ] **Step 7: 최종 커밋 일치 확인**

Run:

```bash
git rev-parse HEAD
git rev-parse origin/main
git status -sb
```

Expected: `HEAD`와 `origin/main`이 같고 관련 추적 파일은 깨끗함. 기존 미추적 캐릭터 원안 디렉터리는 그대로 유지됨.

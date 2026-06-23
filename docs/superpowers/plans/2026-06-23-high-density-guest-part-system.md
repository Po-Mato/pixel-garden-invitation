# 고밀도 하객 파츠 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하객 캐릭터를 `96x144` 고밀도 base/헤어/의상/악세사리 파츠 조합 시스템으로 전환한다.

**Architecture:** `shared/character-catalog.json`은 선택 가능한 ID를 계속 담당하고, 새 `character-assets/guest-part-manifest.json`이 각 ID를 소스/생성 에셋, 레이어, 프레임 크기로 매핑한다. 생성기와 감사 도구는 매니페스트를 읽어 고밀도 하객 파츠를 검증/생성하고, 클라이언트는 매니페스트 기반으로 레이어를 해석해 `CharacterSprite`가 프레임 크기와 표시 크기를 CSS 변수로 렌더링한다.

**Tech Stack:** TypeScript, React 18, Vite 8, Vitest, Node.js, Sharp, node:test, pnpm.

---

## 파일 구조

### 매니페스트와 공유 타입

- Create: `character-assets/guest-part-manifest.json` — 하객 파츠별 소스/생성 경로, 레이어, 프레임 규격, 표시 크기 규칙.
- Create: `shared/src/guestPartManifest.ts` — 매니페스트 타입과 런타임 접근자.
- Create: `shared/src/guestPartManifest.test.ts` — 카탈로그와 매니페스트 일치성 테스트.
- Modify: `shared/src/index.ts` — 매니페스트 API export.

### 생성기/감사/컨택트 시트

- Modify: `scripts/generate-character-assets.mjs` — 하객 파츠를 `288x576`/`192x144` 규격으로 검증하고 생성.
- Modify: `scripts/audit-character-assets.mjs` — 하객 파츠 고밀도 규격 감사.
- Modify: `scripts/render-character-contact-sheet.mjs` — 하객 `96x144` 프레임 추출과 표시 크기 샘플 지원.
- Modify: `scripts/characterAssetGenerator.test.mjs` — 고밀도 하객 생성기 계약 테스트.
- Modify: `scripts/characterAssetAudit.test.mjs` — 매니페스트/프레임 감사 테스트.

### 클라이언트 렌더러

- Modify: `client/src/character/frame.ts` — 프레임 크기 인자를 지원.
- Modify: `client/src/character/frame.test.ts` — `96x144` offset 테스트.
- Modify: `client/src/character/assets.ts` — 매니페스트 기반 레이어 해석.
- Modify: `client/src/character/assets.test.ts` — 하드코딩 URL 대신 매니페스트 기반 해석 검증.
- Modify: `client/src/components/CharacterSprite.tsx` — CSS 변수 기반 source/display dimension 렌더링.
- Modify: `client/src/components/CharacterSprite.test.tsx` — 하객 프레임 크기와 레이어 순서 검증.
- Modify: `client/src/styles.css` — 하객 world/customizer 표시 크기와 고밀도 pixel rendering.

### 에셋

- Modify: `character-assets/source/base/*`
- Modify: `character-assets/source/hair/*`
- Modify: `character-assets/source/outfits/*`
- Modify: `character-assets/source/accessories/*`

---

## Task 1: 매니페스트 계약 추가

**Files:**
- Create: `character-assets/guest-part-manifest.json`
- Create: `shared/src/guestPartManifest.ts`
- Create: `shared/src/guestPartManifest.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: 실패 테스트 작성**

`shared/src/guestPartManifest.test.ts`를 추가한다.

핵심 검증:

- 매니페스트 프레임은 `96x144`.
- 모든 base family, hair style, outfit, accessory ID가 매니페스트에 존재.
- 레이어 순서는 `back-accessory`, `back-hair`, `base`, `outfit`, `front-hair`, `face`, `jewelry`, `neckwear`, `carry`.

- [ ] **Step 2: RED 확인**

```bash
pnpm --filter @wedding-game/shared test -- guestPartManifest.test.ts
```

예상: `guestPartManifest.ts` 또는 JSON 파일이 없어 실패.

- [ ] **Step 3: 매니페스트와 타입 구현**

`character-assets/guest-part-manifest.json`을 추가하고, `shared/src/guestPartManifest.ts`에서 타입/상수/export를 제공한다.

- [ ] **Step 4: GREEN 확인**

```bash
pnpm --filter @wedding-game/shared test -- guestPartManifest.test.ts
pnpm --filter @wedding-game/shared typecheck
```

예상: 통과.

## Task 2: 생성기와 감사 도구를 고밀도 하객 규격으로 전환

**Files:**
- Modify: `scripts/generate-character-assets.mjs`
- Modify: `scripts/audit-character-assets.mjs`
- Modify: `scripts/characterAssetGenerator.test.mjs`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/characterAssetGenerator.test.mjs`에 다음 테스트를 추가한다.

- 기존 `144x288` 하객 base/hair/outfit/accessory 소스는 거부.
- 새 `288x576` walk sheet는 허용.
- 새 `192x144` idle sheet는 허용.
- 생성 결과의 하객 base/hair/outfit/accessory도 고밀도 크기.

- [ ] **Step 2: RED 확인**

```bash
node --test scripts/characterAssetGenerator.test.mjs
```

예상: 현재 소스/생성기 규격이 `48x72`라 실패.

- [ ] **Step 3: 생성기 수정**

생성기에 하객 프레임 상수를 추가한다.

```js
const guestFrame = { width: 96, height: 144 };
const guestIdleDimensions = { width: 192, height: 144 };
const guestWalkDimensions = { width: 288, height: 576 };
```

base/hair/outfit/accessory 검증은 guest 고밀도 규격을 사용하고, NPC 검증은 기존 `96x144` couple 규격을 유지한다.

- [ ] **Step 4: 감사 도구 수정**

`auditSheet()` 호출에서 하객 그룹은 `guestFrame`을 사용하도록 바꾼다.

- [ ] **Step 5: GREEN 확인**

```bash
node --test scripts/characterAssetGenerator.test.mjs
```

예상: 소스 교체 전에는 크기 테스트 일부가 계속 실패할 수 있다. 이 실패는 Task 4에서 해결한다.

## Task 3: 클라이언트 렌더러를 dimension-aware로 전환

**Files:**
- Modify: `client/src/character/frame.ts`
- Modify: `client/src/character/frame.test.ts`
- Modify: `client/src/character/assets.ts`
- Modify: `client/src/character/assets.test.ts`
- Modify: `client/src/components/CharacterSprite.tsx`
- Modify: `client/src/components/CharacterSprite.test.tsx`
- Modify: `client/src/styles.css`

- [ ] **Step 1: 실패 테스트 작성**

프레임 테스트에 `96x144` offset 검증을 추가한다.

```ts
expect(getWalkFrameStyle("left", 1, { width: 96, height: 144 })).toEqual({ x: -96, y: -144 });
```

`CharacterSprite` 테스트에는 CSS 변수 검증을 추가한다.

```ts
expect(sprite).toHaveStyle({
  "--character-source-width": "96px",
  "--character-source-height": "144px"
});
```

- [ ] **Step 2: RED 확인**

```bash
pnpm --filter @wedding-game/client test -- frame.test.ts assets.test.ts CharacterSprite.test.tsx
```

예상: 기존 `48x72` 하드코딩 때문에 실패.

- [ ] **Step 3: 프레임 계산 수정**

`getWalkFrameStyle(direction, stepFrame, frameSize = { width: 48, height: 72 })` 형태로 확장한다.

- [ ] **Step 4: 레이어 해석 수정**

`resolveCharacterLayers()`가 매니페스트의 generated path와 frame metadata를 사용하도록 수정한다.

- [ ] **Step 5: Sprite/CSS 수정**

`CharacterSprite`는 source size와 display size CSS 변수를 렌더링한다.

- [ ] **Step 6: GREEN 확인**

```bash
pnpm --filter @wedding-game/client test -- frame.test.ts assets.test.ts CharacterSprite.test.tsx
pnpm --filter @wedding-game/client typecheck
```

예상: 통과.

## Task 4: 고밀도 하객 파츠 소스 에셋 교체

**Files:**
- Modify: `character-assets/source/base/*`
- Modify: `character-assets/source/hair/*`
- Modify: `character-assets/source/outfits/*`
- Modify: `character-assets/source/accessories/*`

- [ ] **Step 1: base source를 `192x144`/`288x576`으로 교체**

masculine/feminine base idle/walk를 고밀도 규격으로 교체한다.

- [ ] **Step 2: hair source 32개를 `288x576`으로 교체**

각 hair ID는 `__back-walk.png`, `__front-walk.png`를 가진다.

- [ ] **Step 3: outfit source 10개를 `288x576`으로 교체**

각 outfit은 소재 디테일이 보이는 독립 실루엣을 가져야 한다.

- [ ] **Step 4: accessory source 10개를 `288x576`으로 교체**

각 accessory는 slot/layer에 맞게 body anchor에 정렬한다.

- [ ] **Step 5: 생성/감사 실행**

```bash
pnpm characters:generate
pnpm characters:audit
```

예상: 통과.

## Task 5: 컨택트 시트와 시각 검증

**Files:**
- Modify: `scripts/render-character-contact-sheet.mjs`

- [ ] **Step 1: 컨택트 시트 고밀도 하객 추출 수정**

하객 sample은 `96x144` 프레임을 추출한다.

- [ ] **Step 2: 컨택트 시트 생성**

```bash
pnpm characters:contact-sheet -- --mode=catalog --output=.superpowers/character-review/high-density-guest-part-system.png
```

- [ ] **Step 3: 이미지 확인**

검토 기준:

- 얼굴이 외계인/마스크처럼 보이지 않는다.
- 헤어/의상/악세사리가 독립 파츠로 교체된 것이 보인다.
- 모바일 실제 크기에서도 저렴해 보이지 않는다.

## Task 6: 전체 검증

**Files:**
- Modify if needed: `docs/character-art-direction-lock.md`

- [ ] **Step 1: 문서 lock 갱신**

고밀도 하객 파츠 시스템과 매니페스트를 `docs/character-art-direction-lock.md`에 반영한다.

- [ ] **Step 2: 전체 자동 검증**

```bash
pnpm characters:audit
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

- [ ] **Step 3: 브라우저 검증**

로컬에서 다음을 확인한다.

- desktop 커스터마이저.
- `390px` mobile 커스터마이저.
- 정원 입장.
- 네 방향 이동.
- accessory slot 변경.
- 신랑/신부 NPC crisp 유지.
- horizontal overflow 없음.
- console error/warn 없음.

- [ ] **Step 4: 커밋**

```bash
git add character-assets shared scripts client docs package.json
git commit -m "feat: add high-density guest part system"
```

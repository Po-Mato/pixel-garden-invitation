# 고밀도 하객 파츠 시스템 구현 계획

> **작업 에이전트용:** 필수 하위 스킬은 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`다. 이 계획은 작업 단위로 순서대로 실행하며, 진행 상태는 체크박스(`- [ ]`)로 추적한다.

**목표:** 하객 캐릭터를 `96x144` 고밀도 base/헤어/의상/악세사리 파츠 조합 시스템으로 전환한다.

**구조:** `shared/character-catalog.json`은 선택 가능한 ID를 계속 담당하고, 새 `character-assets/guest-part-manifest.json`이 각 ID를 소스/생성 에셋, 레이어, 프레임 크기로 매핑한다. 생성기와 감사 도구는 매니페스트를 읽어 고밀도 하객 파츠를 검증/생성하고, 클라이언트는 매니페스트 기반으로 레이어를 해석해 `CharacterSprite`가 프레임 크기와 표시 크기를 CSS 변수로 렌더링한다.

**기술 스택:** TypeScript, React 18, Vite 8, Vitest, Node.js, Sharp, node:test, pnpm.

## 2026-06-24 상태 변경

이 계획의 파츠 조합형 하객 시스템은 현재 런타임 기준이 아니다. 사용자 검토에서 파츠 경계 때문에 얼굴과 의상 품질이 반복적으로 무너지는 문제가 확인되어, 하객은 완성 캐릭터 프리셋 선택형으로 전환했다.

현재 기준:

- 설계: `docs/superpowers/specs/2026-06-24-complete-guest-character-presets-design.md`
- 구현 계획: `docs/superpowers/plans/2026-06-24-complete-guest-character-presets.md`
- 프리셋 카탈로그: `character-assets/guest-character-presets.json`
- 완성 하객 소스: `character-assets/source/guests/*`

`guest-part-manifest.json`과 `character-assets/source/base`, `hair`, `outfits`, `accessories`는 레거시 자료로만 유지한다.

## 2026-06-24 추가 품질 패스

기존 고밀도 전환은 구조적으로는 동작했지만, 하객 소스 아트가 여전히 저밀도 도형 조합처럼 보여 품질 문제가 남았다. 이번 추가 작업은 런타임 구조를 바꾸지 않고 하객 소스 파츠와 감사 기준을 재작업한다.

추가 범위:

- `scripts/author-guest-part-sources.mjs`를 추가해 base, hair, outfit, accessory 소스 PNG를 재생성 가능하게 한다.
- `pnpm characters:author-guests` 스크립트를 추가한다.
- 감사 도구에 프레임 점유 기준을 추가해 작은 캐릭터를 큰 캔버스 중앙에 넣는 회귀를 막는다.
- `quality-rules.json`에 base/hair/outfit의 상단 점유, 높이, 하단 기준을 추가한다.
- front-hair가 얼굴을 덮지 않도록 하객 헤어 레이어의 역할을 분리한다.
- 리뷰 산출물은 `.superpowers/character-review/guest-art-quality-pass-2.png`로 저장한다.

---

## 파일 구조

### 매니페스트와 공유 타입

- 생성: `character-assets/guest-part-manifest.json` — 하객 파츠별 소스/생성 경로, 레이어, 프레임 규격, 표시 크기 규칙.
- 생성: `shared/src/guestPartManifest.ts` — 매니페스트 타입과 런타임 접근자.
- 생성: `shared/src/guestPartManifest.test.ts` — 카탈로그와 매니페스트 일치성 테스트.
- 수정: `shared/src/index.ts` — 매니페스트 API export.

### 생성기/감사/컨택트 시트

- 수정: `scripts/generate-character-assets.mjs` — 하객 파츠를 `288x576`/`192x144` 규격으로 검증하고 생성.
- 수정: `scripts/audit-character-assets.mjs` — 하객 파츠 고밀도 규격 감사.
- 수정: `scripts/render-character-contact-sheet.mjs` — 하객 `96x144` 프레임 추출과 표시 크기 샘플 지원.
- 수정: `scripts/characterAssetGenerator.test.mjs` — 고밀도 하객 생성기 계약 테스트.
- 수정: `scripts/characterAssetAudit.test.mjs` — 매니페스트/프레임 감사 테스트.

### 클라이언트 렌더러

- 수정: `client/src/character/frame.ts` — 프레임 크기 인자를 지원.
- 수정: `client/src/character/frame.test.ts` — `96x144` offset 테스트.
- 수정: `client/src/character/assets.ts` — 매니페스트 기반 레이어 해석.
- 수정: `client/src/character/assets.test.ts` — 하드코딩 URL 대신 매니페스트 기반 해석 검증.
- 수정: `client/src/components/CharacterSprite.tsx` — CSS 변수 기반 소스/표시 크기 렌더링.
- 수정: `client/src/components/CharacterSprite.test.tsx` — 하객 프레임 크기와 레이어 순서 검증.
- 수정: `client/src/styles.css` — 하객 정원/커스터마이저 표시 크기와 고밀도 픽셀 렌더링.

### 에셋

- 수정: `character-assets/source/base/*`
- 수정: `character-assets/source/hair/*`
- 수정: `character-assets/source/outfits/*`
- 수정: `character-assets/source/accessories/*`

---

## Task 1: 매니페스트 계약 추가

**파일:**
- 생성: `character-assets/guest-part-manifest.json`
- 생성: `shared/src/guestPartManifest.ts`
- 생성: `shared/src/guestPartManifest.test.ts`
- 수정: `shared/src/index.ts`

- [ ] **1단계: 실패 테스트 작성**

`shared/src/guestPartManifest.test.ts`를 추가한다.

핵심 검증:

- 매니페스트 프레임은 `96x144`.
- 모든 base family, hair style, outfit, accessory ID가 매니페스트에 존재.
- 레이어 순서는 `back-accessory`, `back-hair`, `base`, `outfit`, `front-hair`, `face`, `jewelry`, `neckwear`, `carry`.

- [ ] **2단계: RED 확인**

```bash
pnpm --filter @wedding-game/shared test -- guestPartManifest.test.ts
```

예상: `guestPartManifest.ts` 또는 JSON 파일이 없어 실패.

- [ ] **3단계: 매니페스트와 타입 구현**

`character-assets/guest-part-manifest.json`을 추가하고, `shared/src/guestPartManifest.ts`에서 타입/상수/export를 제공한다.

- [ ] **4단계: GREEN 확인**

```bash
pnpm --filter @wedding-game/shared test -- guestPartManifest.test.ts
pnpm --filter @wedding-game/shared typecheck
```

예상: 통과.

## Task 2: 생성기와 감사 도구를 고밀도 하객 규격으로 전환

**파일:**
- 수정: `scripts/generate-character-assets.mjs`
- 수정: `scripts/audit-character-assets.mjs`
- 수정: `scripts/characterAssetGenerator.test.mjs`

- [ ] **1단계: 실패 테스트 작성**

`scripts/characterAssetGenerator.test.mjs`에 다음 테스트를 추가한다.

- 기존 `144x288` 하객 base/hair/outfit/accessory 소스는 거부.
- 새 `288x576` walk sheet는 허용.
- 새 `192x144` idle sheet는 허용.
- 생성 결과의 하객 base/hair/outfit/accessory도 고밀도 크기.

- [ ] **2단계: RED 확인**

```bash
node --test scripts/characterAssetGenerator.test.mjs
```

예상: 현재 소스/생성기 규격이 `48x72`라 실패.

- [ ] **3단계: 생성기 수정**

생성기에 하객 프레임 상수를 추가한다.

```js
const guestFrame = { width: 96, height: 144 };
const guestIdleDimensions = { width: 192, height: 144 };
const guestWalkDimensions = { width: 288, height: 576 };
```

base/hair/outfit/accessory 검증은 guest 고밀도 규격을 사용하고, NPC 검증은 기존 `96x144` couple 규격을 유지한다.

- [ ] **4단계: 감사 도구 수정**

`auditSheet()` 호출에서 하객 그룹은 `guestFrame`을 사용하도록 바꾼다.

- [ ] **5단계: GREEN 확인**

```bash
node --test scripts/characterAssetGenerator.test.mjs
```

예상: 소스 교체 전에는 크기 테스트 일부가 계속 실패할 수 있다. 이 실패는 Task 4에서 해결한다.

## Task 3: 클라이언트 렌더러를 dimension-aware로 전환

**파일:**
- 수정: `client/src/character/frame.ts`
- 수정: `client/src/character/frame.test.ts`
- 수정: `client/src/character/assets.ts`
- 수정: `client/src/character/assets.test.ts`
- 수정: `client/src/components/CharacterSprite.tsx`
- 수정: `client/src/components/CharacterSprite.test.tsx`
- 수정: `client/src/styles.css`

- [ ] **1단계: 실패 테스트 작성**

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

- [ ] **2단계: RED 확인**

```bash
pnpm --filter @wedding-game/client test -- frame.test.ts assets.test.ts CharacterSprite.test.tsx
```

예상: 기존 `48x72` 하드코딩 때문에 실패.

- [ ] **3단계: 프레임 계산 수정**

`getWalkFrameStyle(direction, stepFrame, frameSize = { width: 48, height: 72 })` 형태로 확장한다.

- [ ] **4단계: 레이어 해석 수정**

`resolveCharacterLayers()`가 매니페스트의 generated path와 frame metadata를 사용하도록 수정한다.

- [ ] **5단계: Sprite/CSS 수정**

`CharacterSprite`는 source size와 display size CSS 변수를 렌더링한다.

- [ ] **6단계: GREEN 확인**

```bash
pnpm --filter @wedding-game/client test -- frame.test.ts assets.test.ts CharacterSprite.test.tsx
pnpm --filter @wedding-game/client typecheck
```

예상: 통과.

## Task 4: 고밀도 하객 파츠 소스 에셋 교체

**파일:**
- 수정: `character-assets/source/base/*`
- 수정: `character-assets/source/hair/*`
- 수정: `character-assets/source/outfits/*`
- 수정: `character-assets/source/accessories/*`

- [ ] **1단계: base source를 `192x144`/`288x576`으로 교체**

masculine/feminine base idle/walk를 고밀도 규격으로 교체한다.

- [ ] **2단계: hair source 32개를 `288x576`으로 교체**

각 hair ID는 `__back-walk.png`, `__front-walk.png`를 가진다.

- [ ] **3단계: outfit source 10개를 `288x576`으로 교체**

각 outfit은 소재 디테일이 보이는 독립 실루엣을 가져야 한다.

- [ ] **4단계: accessory source 10개를 `288x576`으로 교체**

각 accessory는 slot/layer에 맞게 body anchor에 정렬한다.

- [ ] **5단계: 생성/감사 실행**

```bash
pnpm characters:generate
pnpm characters:audit
```

예상: 통과.

## Task 5: 컨택트 시트와 시각 검증

**파일:**
- 수정: `scripts/render-character-contact-sheet.mjs`

- [ ] **1단계: 컨택트 시트 고밀도 하객 추출 수정**

하객 sample은 `96x144` 프레임을 추출한다.

- [ ] **2단계: 컨택트 시트 생성**

```bash
pnpm characters:contact-sheet -- --mode=catalog --output=.superpowers/character-review/high-density-guest-part-system.png
```

- [ ] **3단계: 이미지 확인**

검토 기준:

- 얼굴이 외계인/마스크처럼 보이지 않는다.
- 헤어/의상/악세사리가 독립 파츠로 교체된 것이 보인다.
- 모바일 실제 크기에서도 저렴해 보이지 않는다.

## Task 6: 전체 검증

**파일:**
- 필요 시 수정: `docs/character-art-direction-lock.md`

- [ ] **1단계: 문서 lock 갱신**

고밀도 하객 파츠 시스템과 매니페스트를 `docs/character-art-direction-lock.md`에 반영한다.

- [ ] **2단계: 전체 자동 검증**

```bash
pnpm characters:audit
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

- [ ] **3단계: 브라우저 검증**

로컬에서 다음을 확인한다.

- desktop 커스터마이저.
- `390px` mobile 커스터마이저.
- 정원 입장.
- 네 방향 이동.
- accessory slot 변경.
- 신랑/신부 NPC crisp 유지.
- horizontal overflow 없음.
- console error/warn 없음.

- [ ] **4단계: 커밋**

```bash
git add character-assets shared scripts client docs package.json
git commit -m "feat: add high-density guest part system"
```

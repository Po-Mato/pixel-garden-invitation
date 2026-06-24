# 하객 방향별 원본 이미지 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하객 프리셋을 정면 이미지 파생 방식에서 방향별 원본 PNG를 픽셀화하는 방식으로 전환한다.

**Architecture:** 카탈로그는 각 프리셋의 방향별 원본 PNG 경로를 가진다. 방향 원본 생성 스크립트는 교체 가능한 master PNG를 만들고, 프리셋 소스 생성기는 이 master PNG만 읽어 walk/idle 시트를 조립한다.

**Tech Stack:** Node.js ESM, Sharp, node:test, Vitest, PNG 에셋

---

### Task 1: 카탈로그 계약 테스트

**Files:**

- Modify: `shared/src/guestCharacterPresets.test.ts`
- Modify: `shared/src/guestCharacterPresets.ts`
- Modify: `character-assets/guest-character-presets.json`

- [ ] **Step 1: 실패 테스트 추가**

`shared/src/guestCharacterPresets.test.ts`에 모든 프리셋이 `reference.directions.down/left/right/up` 경로를 갖는지 검사하는 테스트를 추가한다.

- [ ] **Step 2: 실패 확인**

Run:

```bash
pnpm --filter @wedding-game/shared test -- --run shared/src/guestCharacterPresets.test.ts
```

Expected: `reference.directions`가 없어 실패한다.

- [ ] **Step 3: 타입과 카탈로그 구현**

`GuestCharacterPreset.reference` 타입에 `directions`를 추가하고, 12개 프리셋 JSON에 방향 경로를 추가한다.

- [ ] **Step 4: 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/shared test -- --run shared/src/guestCharacterPresets.test.ts
```

Expected: PASS.

### Task 2: 방향 원본 PNG 생성 스크립트

**Files:**

- Create: `scripts/author-guest-direction-sources.mjs`
- Modify: `package.json`
- Create: `character-assets/reference/guest-directions/*/{down,left,right,up}.png`

- [ ] **Step 1: 생성 스크립트 테스트 추가**

`scripts/characterAssetGenerator.test.mjs`에 방향 원본 생성 결과가 12개 프리셋 × 4방향 = 48개 PNG인지 검사하는 테스트를 추가한다.

- [ ] **Step 2: 실패 확인**

Run:

```bash
node --test scripts/characterAssetGenerator.test.mjs --test-name-pattern "guest direction source"
```

Expected: `author-guest-direction-sources.mjs`가 없어 실패한다.

- [ ] **Step 3: 생성 스크립트 구현**

`scripts/author-guest-direction-sources.mjs`는 기존 통합 기준 crop을 이용해 방향별 독립 PNG를 생성한다. 결과 파일은 이후 수작업 교체가 가능한 master PNG로 취급한다.

- [ ] **Step 4: 방향 원본 생성**

Run:

```bash
pnpm characters:author-guest-directions
```

Expected: `Authored 48 guest direction source images` 출력.

### Task 3: 프리셋 소스 생성기 전환

**Files:**

- Modify: `scripts/author-guest-preset-sources.mjs`
- Modify: `scripts/characterAssetGenerator.test.mjs`

- [ ] **Step 1: 방향 원본을 읽는 실패 테스트 추가**

임시 카탈로그에 방향별 색상 PNG 4개를 만들고, `authorGuestPresetSources({ catalog, projectRoot, sourceRoot })`가 각 방향 row를 해당 PNG 색상에서 생성하는지 검사한다.

- [ ] **Step 2: 실패 확인**

Run:

```bash
node --test scripts/characterAssetGenerator.test.mjs --test-name-pattern "explicit directional source images"
```

Expected: 현재 생성기가 `catalog`, `projectRoot`, `reference.directions`를 사용하지 않아 실패한다.

- [ ] **Step 3: 생성기 구현**

`authorGuestPresetSources`는 `reference.directions`를 읽어 방향별 원본을 픽셀화한다. 정면 crop 기반 `renderSideFrame`, `renderUpFrame` 파생 로직은 제거한다.

- [ ] **Step 4: 통과 확인**

Run:

```bash
node --test scripts/characterAssetGenerator.test.mjs --test-name-pattern "explicit directional source images|guest preset authoring"
```

Expected: PASS.

### Task 4: 문서, 생성, 전체 검증

**Files:**

- Modify: `docs/character-art-direction-lock.md`
- Modify: `docs/superpowers/specs/2026-06-24-complete-guest-character-presets-design.md`
- Modify: `docs/superpowers/plans/2026-06-24-complete-guest-character-presets.md`

- [ ] **Step 1: 한국어 문서 갱신**

하객 방향 원본은 `guest-directions/{preset-id}/{direction}.png`를 기준으로 하고, walk 시트는 이 원본을 픽셀화해 조립한다고 명시한다.

- [ ] **Step 2: 산출물 재생성**

Run:

```bash
pnpm characters:author-guest-directions
pnpm characters:author-guest-presets
pnpm characters:generate
pnpm characters:contact-sheet -- --mode=guest-presets --output=.superpowers/character-review/guest-preset-contact-sheet.png
```

Expected: 방향별 원본, 하객 source sheet, generated sheet, 컨택트 시트가 갱신된다.

- [ ] **Step 3: 전체 검증**

Run:

```bash
pnpm characters:audit
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Expected: 모두 PASS.

- [ ] **Step 4: 커밋**

Run:

```bash
git add character-assets package.json scripts shared docs
git commit -m "feat: use explicit directional guest source images"
```

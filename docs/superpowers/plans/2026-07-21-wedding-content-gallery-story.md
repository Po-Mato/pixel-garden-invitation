# 사진·소개·스토리 실사용화 구현 계획

> **에이전트 작업자 필수 사항:** REQUIRED SUB-SKILL: 이 계획을 작업별로 구현할 때 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans` 하위 스킬을 사용한다. 모든 단계는 체크박스로 진행 상태를 기록한다.

**목표:** 얼굴 식별을 최소화한 화사한 정원 웨딩 임시 이미지 10장, 이승재·이건희 소개, 4단계 스토리를 실제 모바일 청첩장 콘텐츠로 제공하고 갤러리 전체 화면 감상까지 완성한다.

**아키텍처:** `shared/src/weddingGalleryAssets.json`과 `shared/src/weddingContent.ts`가 정적 콘텐츠의 단일 출처가 된다. 로컬 생성 원본은 배포에서 제외하고 Sharp 파이프라인이 복수 해상도 WebP를 만든다. 클라이언트는 소개·스토리·갤러리·라이트박스를 독립 컴포넌트로 분리하고 기존 `SpotModal`과 `GameWorld`의 입력 중지 정책을 재사용한다.

**기술 스택:** TypeScript, React 18, Vite, Vitest, Testing Library, Sharp, `lucide-react`, 내장 `image_gen`, GitHub Pages

## 전역 제약

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이며 새 worktree를 만들지 않는다.
- 실제 두 사람의 외모를 추정하거나 정면 얼굴을 생성하지 않는다. 뒷모습·옆모습·손·부케·실루엣을 사용한다.
- 실제 첫 만남 날짜·장소·성격·개인적 사건을 창작하지 않는다.
- 이미지 생성은 내장 `image_gen`만 사용하고 한 번에 한 장씩 생성한다.
- 첫 승인 이미지의 스타일을 나머지 이미지의 참조로 사용한다. 결과마다 `view_image`로 얼굴 노출, 손·신체 오류, 문자·워터마크, 스타일 불일치를 확인한다.
- 생성 원본은 `wedding-photo-sources/generated/`에 보관하고 Git에서 제외한다. 배포용 WebP만 `client/public/images/wedding-gallery/`에 커밋한다.
- 실제 사진 교체는 동일 ID의 원본 교체 후 `pnpm gallery:build` 실행만으로 가능해야 한다.
- Pages가 상대 경로로 배포되므로 공개 이미지 경로는 선행 `/`를 저장하지 않고 클라이언트에서 `import.meta.env.BASE_URL`과 결합한다.
- 전체 화면 감상 중 지도, 조이스틱, 포털, 미니맵, 하단 시트의 `Escape` 처리가 동작하지 않아야 한다.
- 기존 수정된 `.superpowers/sdd/task-*-report.md`와 미추적 하객 캐릭터 원본 디렉터리를 수정·스테이징하지 않는다.
- 구현은 실패 테스트 확인, 최소 구현, 테스트 통과, 작업별 검토, 작업별 커밋 순서를 따른다.
- 기능 완료 후 전체 테스트·타입 검사·빌드와 모바일·데스크톱 브라우저 검증을 거쳐 `main`을 푸시하고 Pages 배포까지 확인한다.

---

## 파일 구조

- 생성 `shared/src/weddingGalleryAssets.json`: 갤러리 10장 메타데이터와 에디토리얼 표시 순서
- 생성 `shared/src/weddingContent.ts`: 소개·공동 문구·스토리와 검증된 갤러리 런타임 타입
- 생성 `shared/src/weddingContent.test.ts`: 콘텐츠·갤러리 계약 테스트
- 수정 `shared/src/content.ts`, `shared/src/index.ts`: 공통 콘텐츠 연결과 내보내기
- 생성 `scripts/lib/weddingGalleryAssets.mjs`: 원본 검색, WebP 변환, 자산 감사
- 생성 `scripts/build-wedding-gallery-assets.mjs`, `scripts/audit-wedding-gallery-assets.mjs`: CLI 진입점
- 생성 `scripts/weddingGalleryAssets.test.mjs`: 임시 디렉터리 기반 파이프라인 테스트
- 수정 `package.json`, `.gitignore`: 갤러리 스크립트와 로컬 원본 제외
- 생성 `wedding-photo-sources/README.md`: 실제 사진 교체 절차
- 생성 `client/src/invitation/galleryAssets.ts`: `BASE_URL` 안전 경로와 `srcSet` 생성
- 생성 `client/src/invitation/galleryAssets.test.ts`: Pages 상대 경로 계약
- 생성 `client/src/components/CoupleProfilePanel.tsx`와 테스트
- 생성 `client/src/components/WeddingStoryTimeline.tsx`와 테스트
- 생성 `client/src/components/ResponsiveGalleryImage.tsx`와 테스트
- 생성 `client/src/components/WeddingGallery.tsx`와 테스트
- 생성 `client/src/components/PhotoLightbox.tsx`와 테스트
- 수정 `client/src/components/SpotModal.tsx`, 생성 `SpotModal.test.tsx`: 전용 패널 연결
- 수정 `client/src/components/GameWorld.test.tsx`: 월드 입력·중첩 모달·포커스 회귀
- 수정 `client/src/styles.css`, `client/src/styles.test.ts`: 반응형 편집 레이아웃과 감상 레이어

---

### Task 1: 공통 웨딩 콘텐츠와 갤러리 메타데이터 계약

**파일:**
- 생성: `shared/src/weddingGalleryAssets.json`
- 생성: `shared/src/weddingContent.ts`
- 생성: `shared/src/weddingContent.test.ts`
- 수정: `shared/src/content.ts`
- 수정: `shared/src/index.ts`

**인터페이스:**

```ts
export type GalleryOrientation = "landscape" | "portrait";
export type GalleryLayout = "hero" | "wide" | "half";

export type WeddingGalleryPhoto = {
  id: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
  orientation: GalleryOrientation;
  layout: GalleryLayout;
  assetPath: string;
  sources: readonly { assetPath: string; width: 640 | 1024 }[];
};

export type CoupleProfile = {
  role: "groom" | "bride";
  roleLabel: "신랑" | "신부";
  name: string;
  message: string;
  photoId: string;
};

export type WeddingStoryStep = {
  id: "hello" | "seasons" | "promise" | "wedding";
  title: string;
  body: string;
  photoId?: string;
};
```

- [ ] **Step 1: 메타데이터 파서와 콘텐츠 계약의 실패 테스트 작성**

`shared/src/weddingContent.test.ts`에 다음을 검증한다.

```ts
import { describe, expect, it } from "vitest";
import { invitationContent } from "./content";
import { parseWeddingGalleryManifest, weddingContent } from "./weddingContent";

describe("weddingContent", () => {
  it("contains ten unique editorial gallery photos", () => {
    expect(weddingContent.gallery).toHaveLength(10);
    expect(new Set(weddingContent.gallery.map((photo) => photo.id)).size).toBe(10);
    expect(weddingContent.gallery[0]).toMatchObject({ id: "01-cover", layout: "hero" });
    expect(weddingContent.gallery.every((photo) => photo.alt.trim().length > 0)).toBe(true);
    expect(weddingContent.gallery.flatMap((photo) => photo.sources).map((source) => source.width))
      .toEqual(Array.from({ length: 10 }, () => [640, 1024]).flat());
  });

  it("contains the approved profiles and joint message", () => {
    expect(weddingContent.coupleProfiles.map(({ role, name }) => ({ role, name }))).toEqual([
      { role: "groom", name: "이승재" },
      { role: "bride", name: "이건희" }
    ]);
    expect(weddingContent.coupleMessage).toBe(
      "저희 두 사람의 새로운 시작에 함께해 주시면 더없는 기쁨이겠습니다."
    );
    expect(weddingContent.coupleProfiles.map((profile) => profile.name)).toEqual([
      invitationContent.event.couple.groom,
      invitationContent.event.couple.bride
    ]);
  });

  it("keeps the four approved story steps in order", () => {
    expect(weddingContent.storyTimeline.map((step) => step.id)).toEqual([
      "hello", "seasons", "promise", "wedding"
    ]);
  });

  it("rejects duplicate ids and invalid ratios", () => {
    const valid = weddingContent.gallery.map(({ assetPath: _assetPath, sources: _sources, ...photo }) => photo);
    expect(() => parseWeddingGalleryManifest([...valid, valid[0]])).toThrow(/10장/);
    expect(() => parseWeddingGalleryManifest(valid.map((photo, index) =>
      index === 0 ? { ...photo, orientation: "portrait" } : photo
    ))).toThrow(/방향/);
  });
});
```

- [ ] **Step 2: 모듈 부재로 테스트가 실패하는지 확인**

```bash
pnpm --filter @wedding-game/shared test -- weddingContent.test.ts
```

예상: `weddingContent` 모듈을 찾지 못해 실패한다.

- [ ] **Step 3: 갤러리 JSON을 승인된 순서로 작성**

`shared/src/weddingGalleryAssets.json` 배열 순서를 표시 순서로 사용한다.

```json
[
  { "id": "01-cover", "alt": "햇살이 비치는 정원 통로에 나란히 선 신랑신부의 뒷모습", "caption": "햇살 가득한 정원에서, 함께 걷는 첫걸음", "width": 1536, "height": 1024, "orientation": "landscape", "layout": "hero" },
  { "id": "02-dress-bouquet", "alt": "흰 드레스 자락과 흰 꽃 부케를 든 신부의 옆모습", "width": 1024, "height": 1536, "orientation": "portrait", "layout": "half" },
  { "id": "03-side-walk", "alt": "밝은 정원에서 나란히 걷는 신랑신부의 옆모습", "width": 1024, "height": 1536, "orientation": "portrait", "layout": "half" },
  { "id": "06-hands-rings", "alt": "자연광 아래 서로 맞잡은 두 사람의 손과 결혼반지", "caption": "같은 방향을 바라보며", "width": 1536, "height": 1024, "orientation": "landscape", "layout": "wide" },
  { "id": "04-bench-silhouette", "alt": "정원 벤치에 앉아 있는 신랑신부의 부드러운 옆 실루엣", "width": 1024, "height": 1536, "orientation": "portrait", "layout": "half" },
  { "id": "05-veil-flowers", "alt": "흰 꽃 사이로 흐르는 웨딩 베일과 드레스의 뒷모습", "width": 1024, "height": 1536, "orientation": "portrait", "layout": "half" },
  { "id": "08-under-tree", "alt": "큰 나무 아래 마주 선 신랑신부의 옆모습과 정원 풍경", "width": 1536, "height": 1024, "orientation": "landscape", "layout": "wide" },
  { "id": "07-bouquet-still", "alt": "밝은 창가에 놓인 흰 꽃과 연분홍 꽃의 웨딩 부케", "width": 1024, "height": 1536, "orientation": "portrait", "layout": "half" },
  { "id": "10-sunlit-finale", "alt": "따뜻한 햇살 속 정원을 함께 걸어가는 신랑신부의 뒷모습", "width": 1024, "height": 1536, "orientation": "portrait", "layout": "half" },
  { "id": "09-garden-aisle", "alt": "흰 꽃과 초록 잎으로 장식된 화사한 야외 예식 통로 전경", "caption": "소중한 분들과 함께할 우리의 첫날", "width": 1536, "height": 1024, "orientation": "landscape", "layout": "wide" }
]
```

- [ ] **Step 4: 검증 파서와 승인 문구 구현**

`parseWeddingGalleryManifest`는 정확히 10장, 고유 ID, 비어 있지 않은 대체 텍스트, 양수 크기, 가로·세로 방향 일치, 허용 레이아웃을 검사한다. 성공 시 각 ID에서 다음 경로를 파생한다.

```ts
const assetRoot = "images/wedding-gallery";

function toRuntimePhoto(photo: ManifestPhoto): WeddingGalleryPhoto {
  return {
    ...photo,
    assetPath: `${assetRoot}/${photo.id}-1024.webp`,
    sources: [640, 1024].map((width) => ({
      assetPath: `${assetRoot}/${photo.id}-${width}.webp`,
      width: width as 640 | 1024
    }))
  };
}
```

소개와 스토리 본문은 승인 설계 문구를 그대로 사용한다. `content.ts`의 `invitationContent`에 `weddingContent`를 `content` 필드로 연결하고 `index.ts`에서 새 모듈을 내보낸다.

- [ ] **Step 5: 공유 테스트·타입 검사 통과 확인**

```bash
pnpm --filter @wedding-game/shared test -- weddingContent.test.ts content.test.ts
pnpm --filter @wedding-game/shared typecheck
```

- [ ] **Step 6: Task 1 변경만 검토하고 커밋**

```bash
git diff --check
git add shared/src/weddingGalleryAssets.json shared/src/weddingContent.ts shared/src/weddingContent.test.ts shared/src/content.ts shared/src/index.ts
git commit -m "feat: define wedding gallery and story content"
```

---

### Task 2: 갤러리 이미지 변환·감사 파이프라인

**파일:**
- 생성: `scripts/lib/weddingGalleryAssets.mjs`
- 생성: `scripts/build-wedding-gallery-assets.mjs`
- 생성: `scripts/audit-wedding-gallery-assets.mjs`
- 생성: `scripts/weddingGalleryAssets.test.mjs`
- 생성: `wedding-photo-sources/README.md`
- 수정: `package.json`
- 수정: `.gitignore`

**공개 API:**

```js
export async function loadWeddingGalleryManifest(options = {}) {}
export async function buildWeddingGalleryAssets(options = {}) {}
export async function auditWeddingGalleryAssets(options = {}) {}
```

- [ ] **Step 1: 파이프라인 실패 테스트 작성**

임시 프로젝트에 Sharp PNG 원본을 만들고 다음을 검증한다.

```js
test("builds exact 640 and 1024 WebP derivatives", async () => {
  await buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot });
  const files = (await readdir(outputRoot)).sort();
  assert.equal(files.length, 20);
  const metadata = await sharp(join(outputRoot, "01-cover-640.webp")).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 640);
});

test("rejects missing or ambiguous source files", async () => {
  await assert.rejects(() => buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot }), /원본/);
});

test("audit rejects missing, wrong-format, and wrong-ratio outputs", async () => {
  await assert.rejects(() => auditWeddingGalleryAssets({ rootDir, manifestPath, outputRoot }), /누락|WebP|비율/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
node --test scripts/weddingGalleryAssets.test.mjs
```

예상: 파이프라인 모듈 부재로 실패한다.

- [ ] **Step 3: Sharp 변환과 감사 구현**

- 원본 이름은 `${id}-source.png|jpg|jpeg|webp`만 허용한다.
- 같은 ID의 원본이 0개 또는 2개 이상이면 실패한다.
- EXIF 회전을 적용한 뒤 비율을 검사하고, 폭 640·1024로 리사이즈한다.
- `sharp().rotate().resize({ width, fit: "inside", withoutEnlargement: false }).webp({ quality: 82, effort: 6 })`를 사용한다.
- 감사 시 정확히 20개 파일, WebP 형식, 선언한 폭, 원본 메타데이터와 1% 이내 비율을 검사한다.
- 출력 디렉터리를 먼저 임시 디렉터리에 완성하고 감사 통과 후 교체해 부분 결과를 남기지 않는다.

- [ ] **Step 4: CLI와 루트 스크립트 연결**

`package.json`에 다음을 추가한다.

```json
{
  "scripts": {
    "gallery:build": "node scripts/build-wedding-gallery-assets.mjs",
    "gallery:audit": "node scripts/audit-wedding-gallery-assets.mjs",
    "gallery:test": "node --test scripts/weddingGalleryAssets.test.mjs"
  }
}
```

루트 `test`와 `build` 시작부에 `pnpm gallery:audit`을 추가하고 `test`에는 `pnpm gallery:test`도 추가한다. CI에서 로컬 원본 없이도 빌드할 수 있도록 `gallery:build`는 자동 실행하지 않는다.

`.gitignore`에는 다음 한 줄만 추가한다.

```gitignore
wedding-photo-sources/generated/
```

`wedding-photo-sources/README.md`에는 파일명, 권장 3:2·2:3 비율, `gallery:build`, `gallery:audit`, 실제 사진 교체 절차를 기록한다.

- [ ] **Step 5: 파이프라인 테스트 통과 확인**

```bash
pnpm gallery:test
pnpm --filter @wedding-game/shared test
```

- [ ] **Step 6: Task 2 변경만 검토하고 커밋**

```bash
git diff --check
git add .gitignore package.json scripts/lib/weddingGalleryAssets.mjs scripts/build-wedding-gallery-assets.mjs scripts/audit-wedding-gallery-assets.mjs scripts/weddingGalleryAssets.test.mjs wedding-photo-sources/README.md
git commit -m "build: add wedding gallery asset pipeline"
```

---

### Task 3: 임시 웨딩 이미지 10장 생성과 배포 자산 확정

**파일:**
- 로컬 생성: `wedding-photo-sources/generated/*-source.png` (Git 제외)
- 생성: `client/public/images/wedding-gallery/*-{640,1024}.webp`

- [ ] **Step 1: 이미지 생성 스킬과 생성 규칙 확인**

내장 `image_gen`을 한 번에 한 장씩 호출한다. 첫 장은 새 이미지로 생성하고, 승인된 `01-cover`를 2~10번의 스타일 참조 이미지로 사용한다. 공통 요구는 “화사한 정원 웨딩 실사 에디토리얼, 밝은 자연광, 흰 꽃과 싱그러운 초록, 같은 익명 커플, 얼굴 식별 최소화, 문자와 워터마크 없음”으로 유지한다.

- [ ] **Step 2: 아래 순서로 10장 생성·검수**

1. `01-cover`: 가로, 정원 통로에 선 커플 뒷모습
2. `02-dress-bouquet`: 세로, 드레스와 부케 중심 옆·뒷모습
3. `03-side-walk`: 세로, 나란히 걷는 옆모습, 얼굴 세부 비노출
4. `04-bench-silhouette`: 세로, 벤치의 부드러운 옆 실루엣
5. `05-veil-flowers`: 세로, 베일과 흰 꽃 디테일
6. `06-hands-rings`: 가로, 자연스러운 손과 반지 디테일
7. `07-bouquet-still`: 세로, 사람 없는 부케 정물
8. `08-under-tree`: 가로, 큰 나무 아래 옆·뒷모습
9. `09-garden-aisle`: 가로, 사람이 작거나 없는 정원 예식 통로 전경
10. `10-sunlit-finale`: 세로, 햇살 속 함께 걷는 뒷모습

각 결과를 `view_image`로 원본 크기에서 확인한다. 정면 얼굴, 왜곡된 손·팔다리, 인물 수 오류, 글자·로고·워터마크, 어두운 분위기, 다른 커플·의상·정원 스타일이면 저장하지 않고 같은 장만 재시도한다.

- [ ] **Step 3: 원본 파일명 확정과 WebP 생성**

승인 결과를 정확히 `${id}-source.png`로 저장한 뒤 실행한다.

```bash
pnpm gallery:build
pnpm gallery:audit
```

예상: 배포 디렉터리에 10장 × 2해상도 = 20개 WebP가 생성되고 감사에 통과한다.

- [ ] **Step 4: 배포본 contact sheet 생성·육안 검수**

파이프라인 보조 함수 또는 별도 임시 Sharp 명령으로 10장 썸네일 contact sheet를 `.superpowers/character-review/wedding-gallery-contact-sheet.png`에 만들고 `view_image`로 다음을 확인한다.

- 같은 밝기·색조·정원·의상 분위기
- 4장 가로·6장 세로 방향
- 대표 이미지가 첫 화면 역할을 할 충분한 피사체 여백
- 세로 2열 배치에서 얼굴이나 부케가 잘리지 않음
- 640 출력에서도 손·반지·베일이 뭉개지지 않음

- [ ] **Step 5: 배포 자산만 검토하고 커밋**

```bash
git status --short
git add client/public/images/wedding-gallery
git commit -m "assets: add garden wedding editorial gallery"
```

`wedding-photo-sources/generated/`와 기존 미추적 캐릭터 원본이 스테이징되지 않았는지 `git diff --cached --name-only`로 확인한다.

---

### Task 4: 소개 패널과 4단계 스토리 타임라인

**파일:**
- 생성: `client/src/invitation/galleryAssets.ts`
- 생성: `client/src/invitation/galleryAssets.test.ts`
- 생성: `client/src/components/CoupleProfilePanel.tsx`
- 생성: `client/src/components/CoupleProfilePanel.test.tsx`
- 생성: `client/src/components/WeddingStoryTimeline.tsx`
- 생성: `client/src/components/WeddingStoryTimeline.test.tsx`
- 수정: `client/src/components/SpotModal.tsx`
- 생성: `client/src/components/SpotModal.test.tsx`

- [ ] **Step 1: Pages 경로와 전용 패널 실패 테스트 작성**

`resolveGalleryAssetPath`는 선행 슬래시를 제거하고 `BASE_URL` 끝 슬래시를 정규화한다.

```ts
expect(resolveGalleryAssetPath("images/wedding-gallery/01-cover-1024.webp", "./"))
  .toBe("./images/wedding-gallery/01-cover-1024.webp");
expect(resolveGalleryAssetPath("images/wedding-gallery/01-cover-1024.webp", "/pixel-garden-invitation/"))
  .toBe("/pixel-garden-invitation/images/wedding-gallery/01-cover-1024.webp");
```

컴포넌트 테스트는 다음을 검증한다.

```ts
expect(screen.getByRole("heading", { name: "신랑 이승재" })).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "신부 이건희" })).toBeInTheDocument();
expect(screen.getAllByRole("listitem")).toHaveLength(4);
expect(screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual([
  "첫 인사", "함께한 시간", "결혼을 약속한 마음", "우리의 결혼식"
]);
```

`SpotModal.test.tsx`는 `couple`, `story`가 일반 문구와 함께 전용 패널을 렌더링하고 RSVP·방명록 분기가 유지됨을 확인한다. `gallery` 분기는 Task 5에서 연결한다.

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm --filter @wedding-game/client test -- galleryAssets.test.ts CoupleProfilePanel.test.tsx WeddingStoryTimeline.test.tsx SpotModal.test.tsx
```

- [ ] **Step 3: 경로 유틸리티와 전용 패널 구현**

```ts
export function resolveGalleryAssetPath(assetPath: string, baseUrl = import.meta.env.BASE_URL): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${assetPath.replace(/^\/+/, "")}`;
}
```

`CoupleProfilePanel`은 두 프로필을 `section` 두 개로 세로 배치하고 역할·이름·소개·대표 사진을 표시한다. `WeddingStoryTimeline`은 순서 있는 목록과 세로 기준선을 사용한다. 두 컴포넌트 모두 `invitationContent.content`만 읽으며 문구를 중복 하드코딩하지 않는다.

`SpotModal` 분기는 다음처럼 명시한다.

```tsx
{spotId === "couple" && <CoupleProfilePanel />}
{spotId === "story" && <WeddingStoryTimeline />}
```

- [ ] **Step 4: 관련 테스트와 타입 검사 통과 확인**

```bash
pnpm --filter @wedding-game/client test -- galleryAssets.test.ts CoupleProfilePanel.test.tsx WeddingStoryTimeline.test.tsx SpotModal.test.tsx
pnpm --filter @wedding-game/client typecheck
```

- [ ] **Step 5: Task 4 변경만 검토하고 커밋**

```bash
git diff --check
git add client/src/invitation/galleryAssets.ts client/src/invitation/galleryAssets.test.ts client/src/components/CoupleProfilePanel.tsx client/src/components/CoupleProfilePanel.test.tsx client/src/components/WeddingStoryTimeline.tsx client/src/components/WeddingStoryTimeline.test.tsx client/src/components/SpotModal.tsx client/src/components/SpotModal.test.tsx
git commit -m "feat: add couple profiles and wedding story"
```

---

### Task 5: 반응형 이미지와 에디토리얼 갤러리

**파일:**
- 생성: `client/src/components/ResponsiveGalleryImage.tsx`
- 생성: `client/src/components/ResponsiveGalleryImage.test.tsx`
- 생성: `client/src/components/WeddingGallery.tsx`
- 생성: `client/src/components/WeddingGallery.test.tsx`
- 수정: `client/src/components/SpotModal.tsx`
- 수정: `client/src/components/SpotModal.test.tsx`

**컴포넌트 계약:**

```ts
type ResponsiveGalleryImageProps = {
  photo: WeddingGalleryPhoto;
  priority?: boolean;
  sizes: string;
};

type WeddingGalleryProps = {
  photos?: readonly WeddingGalleryPhoto[];
  onPhotoOpen?: (index: number) => void;
};
```

- [ ] **Step 1: 로딩·실패·배치 실패 테스트 작성**

- 대표 사진은 `loading="eager"`, `fetchPriority="high"`다.
- 나머지는 `loading="lazy"`, `decoding="async"`다.
- `srcSet`에 640w·1024w가 있고 Pages base path가 적용된다.
- 모든 이미지에 `width`, `height`, `alt`가 있다.
- `error` 후 같은 `aspect-ratio`의 대체 설명이 보인다.
- 갤러리에는 정확히 10개 사진 버튼이 있고 JSON 순서를 유지한다.
- `hero|wide|half` 클래스가 메타데이터와 일치한다.
- 사진 버튼을 누르면 해당 인덱스를 `onPhotoOpen` 콜백에 전달한다. Task 6에서 기본 전체 화면 상태를 연결한다.

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm --filter @wedding-game/client test -- ResponsiveGalleryImage.test.tsx WeddingGallery.test.tsx
```

- [ ] **Step 3: 반응형 이미지 구현**

`ResponsiveGalleryImage`는 `useState(false)`로 오류 상태를 관리한다. 성공 상태에서는 다음 속성을 사용한다.

```tsx
<img
  src={resolveGalleryAssetPath(photo.assetPath)}
  srcSet={buildGallerySrcSet(photo.sources)}
  sizes={sizes}
  width={photo.width}
  height={photo.height}
  alt={photo.alt}
  loading={priority ? "eager" : "lazy"}
  fetchPriority={priority ? "high" : "auto"}
  decoding="async"
  onError={() => setFailed(true)}
/>
```

오류 상태는 `role="img"`, `aria-label={photo.alt}`, `style={{ aspectRatio: `${photo.width} / ${photo.height}` }}`를 유지한다.

- [ ] **Step 4: 에디토리얼 목록 구현**

`WeddingGallery`는 `figure`를 중첩 카드로 만들지 않고 하나의 CSS grid 흐름으로 렌더링한다. 사진 자체를 전체 영역 버튼으로 사용하고 캡션은 사진 아래에 둔다. 2열 사진의 `sizes`는 `(max-width: 520px) 44vw, 180px`, 전체 폭 사진은 `(max-width: 520px) 88vw, 354px`로 전달한다.

이 단계에서 `SpotModal`의 `gallery` 분기를 연결한다.

```tsx
{spotId === "gallery" && <WeddingGallery />}
```

`SpotModal.test.tsx`에 사진 10장 렌더링과 `사진 갤러리` 제목 회귀를 추가한다.

- [ ] **Step 5: 관련 테스트 통과 확인**

```bash
pnpm --filter @wedding-game/client test -- ResponsiveGalleryImage.test.tsx WeddingGallery.test.tsx SpotModal.test.tsx
pnpm --filter @wedding-game/client typecheck
```

- [ ] **Step 6: Task 5 변경만 검토하고 커밋**

```bash
git diff --check
git add client/src/components/ResponsiveGalleryImage.tsx client/src/components/ResponsiveGalleryImage.test.tsx client/src/components/WeddingGallery.tsx client/src/components/WeddingGallery.test.tsx client/src/components/SpotModal.tsx client/src/components/SpotModal.test.tsx
git commit -m "feat: add editorial wedding gallery"
```

---

### Task 6: 전체 화면 사진 감상과 중첩 모달 접근성

**파일:**
- 생성: `client/src/components/PhotoLightbox.tsx`
- 생성: `client/src/components/PhotoLightbox.test.tsx`
- 수정: `client/src/components/WeddingGallery.tsx`
- 수정: `client/src/components/WeddingGallery.test.tsx`

**컴포넌트 계약:**

```ts
type PhotoLightboxProps = {
  photos: readonly WeddingGalleryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};
```

- [ ] **Step 1: 전체 화면 동작 실패 테스트 작성**

다음을 각각 독립 테스트로 작성한다.

- `createPortal`로 `document.body` 아래에 `role="dialog"`, `aria-modal="true"` 생성
- 선택 사진, `1 / 10`, 캡션 표시
- 첫 사진에서 이전 버튼, 마지막 사진에서 다음 버튼 비활성
- 버튼과 `ArrowLeft`·`ArrowRight` 이동, 경계에서 순환하지 않음
- 48px 이상이며 수평 이동이 수직 이동보다 큰 포인터 스와이프만 이동
- `Escape` 한 번은 라이트박스만 닫고 하단 시트는 유지
- `Tab`·`Shift+Tab` 포커스 고정
- 닫을 때 선택했던 갤러리 버튼으로 포커스 복귀
- 열려 있는 동안 `document.body.style.overflow === "hidden"`, 닫을 때 원래 값 복원
- 이미지 실패 후에도 닫기·이전·다음 동작 유지

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm --filter @wedding-game/client test -- PhotoLightbox.test.tsx WeddingGallery.test.tsx
```

- [ ] **Step 3: 포털·키보드·포커스 구현**

- 열기 시 `document.activeElement`와 기존 body overflow를 저장한다.
- 닫기 cleanup에서 overflow와 포커스를 복원한다.
- 문서 `keydown`은 capture 단계에 등록한다.
- `Escape`, 방향키, `Tab`은 처리 후 `preventDefault()`와 `stopPropagation()`을 호출해 하위 `BottomSheet`와 월드로 전달되지 않게 한다.
- 닫기, 이전, 다음 버튼에는 `lucide-react`의 `X`, `ChevronLeft`, `ChevronRight`를 사용하고 `aria-label`, `title`을 제공한다.
- 사진은 `object-fit: contain`으로 전체를 표시하고 캡션·카운터는 safe area 안에 둔다.

- [ ] **Step 4: 포인터 스와이프 구현**

`pointerdown`의 좌표와 pointer ID를 저장하고 같은 포인터의 `pointerup`에서 다음 조건을 만족할 때만 이동한다.

```ts
const horizontal = endX - startX;
const vertical = endY - startY;
const isSwipe = Math.abs(horizontal) >= 48 && Math.abs(horizontal) > Math.abs(vertical);
```

좌측 스와이프는 다음, 우측 스와이프는 이전이며 경계에서는 상태를 변경하지 않는다.

- [ ] **Step 5: 관련 테스트 통과 확인**

```bash
pnpm --filter @wedding-game/client test -- PhotoLightbox.test.tsx WeddingGallery.test.tsx BottomSheet.test.tsx
pnpm --filter @wedding-game/client typecheck
```

- [ ] **Step 6: Task 6 변경만 검토하고 커밋**

```bash
git diff --check
git add client/src/components/PhotoLightbox.tsx client/src/components/PhotoLightbox.test.tsx client/src/components/WeddingGallery.tsx client/src/components/WeddingGallery.test.tsx
git commit -m "feat: add accessible wedding photo viewer"
```

---

### Task 7: 시각 디자인과 월드 입력 회귀 강화

**파일:**
- 수정: `client/src/styles.css`
- 수정: `client/src/styles.test.ts`
- 수정: `client/src/components/GameWorld.test.tsx`

- [ ] **Step 1: 스타일·월드 회귀 실패 테스트 작성**

`styles.test.ts`는 다음 계약을 정적 검사한다.

- 갤러리 grid는 안정적인 2열과 전체 폭 변형을 갖는다.
- 이미지·fallback에 `aspect-ratio` 또는 명시 크기가 있다.
- 라이트박스 `z-index`가 하단 시트 41, 관리자 대화상자 80, 월드 지점 9000보다 높다.
- `env(safe-area-inset-*)`와 `@media (prefers-reduced-motion: reduce)`가 있다.
- 520px 이하에서 2열 폭이 컨테이너를 넘지 않는다.
- 카드 반경은 8px 이하이며 섹션 안에 장식 카드가 중첩되지 않는다.

`GameWorld.test.tsx`에는 다음 사용자 경로를 추가한다.

```ts
it.each([
  ["소개 보기", "신랑신부 정원"],
  ["사진 보기", "사진 갤러리"],
  ["스토리 보기", "연애 스토리 꽃길"]
])("pauses world input for %s opened from the menu", ...);
```

갤러리 전용 회귀는 다음을 확인한다.

- 맵 이동 중 갤러리를 열면 경로가 중지된다.
- 라이트박스에서 방향키를 눌러도 캐릭터 좌표가 바뀌지 않는다.
- 첫 `Escape`는 라이트박스만 닫고 갤러리 시트를 유지한다.
- 두 번째 `Escape`는 시트를 닫고 초대장 메뉴 버튼으로 포커스를 복원한다.
- 조이스틱 키를 누른 상태로 갤러리를 열면 release 전까지 입력 잠금 정책이 유지된다.

- [ ] **Step 2: 회귀 테스트 실패 확인**

```bash
pnpm --filter @wedding-game/client test -- styles.test.ts GameWorld.test.tsx
```

- [ ] **Step 3: 소개·스토리·갤러리 스타일 구현**

- `.couple-profile-panel`: 세로 흐름, 인물별 unframed section, 작은 역할 레이블과 안정적인 대표 이미지 비율
- `.wedding-story`: 단일 세로선, 4개 단계, 44px 이상 단계 표시
- `.wedding-gallery`: 2열 grid, `hero`·`wide`는 `grid-column: 1 / -1`, `half`는 한 열
- `.wedding-gallery__trigger`: 이미지 버튼, 2px 이하 테두리, 반경 6px, 명확한 focus-visible
- `.photo-lightbox`: `z-index: 10000`, 검정 단색 계열 배경, full viewport, safe-area 패딩
- `.photo-lightbox__stage`: 고정 가능한 `min-height: 0`, 이미지 `max-width/max-height: 100%`, `object-fit: contain`
- 작은 화면과 가로 화면에서 캡션이 사진을 덮지 않도록 grid 행을 분리한다.
- `prefers-reduced-motion`에서는 뷰어 opacity·transform 전환을 제거한다.

- [ ] **Step 4: 전체 클라이언트 회귀 통과 확인**

```bash
pnpm --filter @wedding-game/client test
pnpm --filter @wedding-game/client typecheck
```

- [ ] **Step 5: Task 7 변경만 검토하고 커밋**

```bash
git diff --check
git add client/src/styles.css client/src/styles.test.ts client/src/components/GameWorld.test.tsx
git commit -m "style: polish wedding content experience"
```

---

### Task 8: 전체 검증, 브라우저 QA, 독립 리뷰, 배포

**파일:**
- 필요 시 위 Task 파일의 결함만 수정
- 수정 금지: 무관한 캐릭터 원본과 `.superpowers/sdd` 보고서

- [ ] **Step 1: 자산·테스트·타입·프로덕션 빌드 실행**

```bash
pnpm gallery:audit
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

모든 명령이 0으로 종료되어야 한다. `client/dist/images/wedding-gallery/`에 정확히 20개 WebP가 포함됐는지 확인한다.

- [ ] **Step 2: 로컬 프로덕션 빌드를 HTTP로 실행**

```bash
pnpm --filter @wedding-game/client exec vite preview --host 127.0.0.1 --port 4173
```

이미 사용 중이면 다른 포트를 선택한다. 최종 응답 전에 서버 세션을 종료한다.

- [ ] **Step 3: 브라우저 QA**

다음 뷰포트에서 실제 스크린샷과 네트워크 상태를 확인한다.

1. `390x844`: 세로 스크롤, 2열 사진 폭, safe area, 스와이프, fallback 레이아웃
2. `844x390`: 라이트박스 사진·캡션·버튼 비겹침
3. `1440x1000`: 전체 화면 이전·다음 버튼, 방향키, 포커스 표시

각 뷰포트에서 초대장 메뉴와 실제 맵 지점 양쪽으로 `couple`, `gallery`, `story`를 연다. 10개 기본 이미지와 20개 `srcSet` URL이 200 응답 및 디코드 성공인지 확인한다. `Escape` 2단계 닫기와 캐릭터 좌표 불변도 확인한다.

- [ ] **Step 4: 독립 코드 리뷰와 결함 수정**

현재 Task diff를 별도 리뷰 작업자에게 제공하고 다음을 우선 검토한다.

- Pages 상대 경로 누락
- 전체 화면 이벤트가 BottomSheet·GameWorld에 전파되는 문제
- 포커스 고정·복귀 누락
- 이미지 실패 시 탐색 중단
- 실제 사진 교체 시 메타데이터·감사 불일치
- 작은 화면 오버플로·버튼/캡션 겹침

발견된 유효 결함은 해당 테스트를 먼저 추가한 뒤 수정하고 관련 테스트와 전체 검증을 반복한다.

- [ ] **Step 5: 최종 구현 커밋**

브라우저 또는 리뷰 보정이 있을 때만 관련 파일을 커밋한다.

```bash
git add <이번 보정 파일만>
git commit -m "fix: harden wedding gallery experience"
```

- [ ] **Step 6: GitHub Pages 배포**

```bash
git status --short --branch
git push origin main
gh run list --workflow pages.yml --limit 1
gh run watch <run-id> --exit-status
```

Worker·D1 변경이 없으므로 Worker는 재배포하지 않는다. Pages 실행 성공 후 `https://po-mato.github.io/pixel-garden-invitation/`에서 새 번들 해시, 갤러리 이미지 10장, 모바일 소개·스토리·라이트박스를 다시 확인한다.

- [ ] **Step 7: 완료 보고**

다음을 한국어로 간결히 보고한다.

- 추가된 콘텐츠와 이미지 장수
- 전체 화면 감상·입력 차단·접근성 결과
- 실행한 테스트·타입 검사·빌드 결과
- Pages 배포 run과 공개 URL 검증 결과
- 원본은 로컬 보존되고 실제 사진은 동일 ID로 교체 가능하다는 점

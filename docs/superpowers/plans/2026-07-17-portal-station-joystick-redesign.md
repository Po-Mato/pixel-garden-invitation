# 포털·지하철역·조이스틱 재설계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배경 출입구 중심에 맞는 포털, 일관된 통합형 지하철 개찰구, 이미지 기반 웨딩 나침반 조이스틱을 구현하고 배포한다.

**Architecture:** 포털의 타일 보행 목적지와 시각·인식 중심을 분리해 기존 경로를 보존한다. 지하철역은 배경의 중복 개찰구를 제거하고 단일 투명 전경으로 교체한다. 조이스틱은 승인된 생성 시트를 투명 PNG 베이스와 손잡이로 분리하고 기존 입력 로직에 이미지 레이어만 연결한다.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Sharp, Vite, 내장 `image_gen`, GitHub Actions Pages

## Global Constraints

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 새 worktree를 만들지 않고 현재 `main` 워크트리에서 순차 실행한다.
- 이미지 생성과 편집은 내장 `image_gen`을 사용한다.
- 조이스틱은 진주 아이보리, 샴페인 골드, 로즈 보석의 웨딩 나침반 디자인을 사용한다.
- 포털 원형 진과 인식 타원은 같은 `80x34px` 영역을 사용한다.
- 포털 클릭 목적지는 `approach`, 시각·인식·미니맵 중심은 `visualCenter`를 사용한다.
- 지하철역 충돌 본체 세 개와 통행 가능한 두 개 통로를 유지한다.
- 전체 테스트와 빌드 후 `main` 푸시로 GitHub Pages에 배포한다.

---

### Task 1: 웨딩 나침반 조이스틱 이미지 생성과 분리

**Files:**
- Create: `ui-assets/reference/joystick/wedding-compass-design-source.png`
- Create: `scripts/split-joystick-design-sheet.mjs`
- Create: `scripts/joystickAsset.test.mjs`
- Create: `client/public/assets/ui/joystick-wedding-compass-base.png`
- Create: `client/public/assets/ui/joystick-wedding-compass-thumb.png`

**Interfaces:**
- Consumes: 승인된 웨딩 나침반 디자인과 Sharp.
- Produces: `splitJoystickDesignSheet({ input, baseOutput, thumbOutput })` 및 런타임 PNG 두 개.

- [ ] **Step 1: 분리기의 실패 테스트 작성**

`scripts/joystickAsset.test.mjs`에 마젠타 배경 위 좌우 두 도형을 만든 뒤 분리 결과를 검사한다.

```js
test("splits the two largest joystick components into normalized transparent assets", async () => {
  const result = await splitJoystickDesignSheet({ input, baseOutput, thumbOutput });

  assert.deepEqual(result, {
    base: { width: 180, height: 180 },
    thumb: { width: 68, height: 68 }
  });
  assert.equal((await sharp(baseOutput).metadata()).channels, 4);
  assert.equal((await sharp(thumbOutput).metadata()).channels, 4);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test scripts/joystickAsset.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `split-joystick-design-sheet.mjs`.

- [ ] **Step 3: 알파 연결 요소 분리기 구현**

`scripts/split-joystick-design-sheet.mjs`는 RGBA 알파가 16보다 큰 픽셀을 4방향 flood fill로 묶고, 면적이 큰 두 요소를 x순으로 정렬한다. 왼쪽을 베이스, 오른쪽을 손잡이로 지정하고 각각 8px 패딩을 포함해 추출한 뒤 투명 contain 리사이즈한다.

```js
export async function splitJoystickDesignSheet({ input, baseOutput, thumbOutput }) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const components = findAlphaComponents(data, info, 16)
    .sort((a, b) => b.area - a.area)
    .slice(0, 2)
    .sort((a, b) => a.left - b.left);

  if (components.length !== 2) throw new Error("joystick design sheet must contain two visible components");

  await writeComponent(input, components[0], baseOutput, 180);
  await writeComponent(input, components[1], thumbOutput, 68);
  return { base: { width: 180, height: 180 }, thumb: { width: 68, height: 68 } };
}
```

- [ ] **Step 4: 분리기 테스트 통과 확인**

Run: `node --test scripts/joystickAsset.test.mjs`

Expected: PASS.

- [ ] **Step 5: 이미지 생성 전 승인 디자인 입력 확인**

조이스틱은 신규 이미지이므로 참조 입력 없이 내장 `image_gen`을 한 단위로 실행한다.

Prompt:

```text
모바일 픽셀 게임용 웨딩 나침반 조이스틱 디자인 시트. 왼쪽에는 손잡이 없는 진주 아이보리 원형 베이스, 샴페인 골드 이중 테두리와 네 방향 나침반 장식, 작은 로즈 보석. 오른쪽에는 분리된 둥근 로즈 자개 손잡이와 금색 테두리. 두 물체가 서로 닿지 않음. 정교한 고해상도 픽셀아트. 완전히 평평한 선명한 마젠타 배경. 글자, 방향 문자, 그림자, 도표 금지.
```

캐릭터나 인포그래픽이 나오면 저장하지 않고 같은 단위만 재시도한다.

- [ ] **Step 6: 생성 시트 투명화 및 에셋 분리**

선택 결과를 `ui-assets/reference/joystick/wedding-compass-design-source.png`에 복사하기 전 마젠타 키를 제거한다.

Run:

```bash
uv run --with pillow python "$HOME/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py" \
  --input .superpowers/generated/joystick-wedding-compass-magenta.png \
  --out ui-assets/reference/joystick/wedding-compass-design-source.png \
  --auto-key border --soft-matte --transparent-threshold 12 \
  --opaque-threshold 220 --despill --force
node scripts/split-joystick-design-sheet.mjs \
  --input ui-assets/reference/joystick/wedding-compass-design-source.png \
  --base-output client/public/assets/ui/joystick-wedding-compass-base.png \
  --thumb-output client/public/assets/ui/joystick-wedding-compass-thumb.png
```

Expected: base `180x180 RGBA`, thumb `68x68 RGBA`, 네 모서리 alpha `0`.

- [ ] **Step 7: 이미지 검수**

`view_image`로 생성 시트, 베이스, 손잡이를 각각 확인한다. 외곽 잘림, 마젠타 테두리, 문자, 두 요소 결합이 있으면 같은 생성 단위부터 다시 실행한다.

- [ ] **Step 8: 커밋**

```bash
git add ui-assets/reference/joystick scripts/split-joystick-design-sheet.mjs scripts/joystickAsset.test.mjs client/public/assets/ui
git commit -m "feat: add wedding compass joystick assets"
```

### Task 2: 이미지 기반 조이스틱 렌더링

**Files:**
- Modify: `client/src/components/VirtualJoystick.tsx`
- Modify: `client/src/components/VirtualJoystick.test.tsx`
- Modify: `client/src/styles.css`
- Modify: `client/src/styles.test.ts`

**Interfaces:**
- Consumes: Task 1의 base/thumb PNG.
- Produces: 기존 `VirtualJoystickProps`를 유지하는 이미지 기반 조이스틱.

- [ ] **Step 1: 실패 테스트 작성**

`VirtualJoystick.test.tsx`에서 베이스와 손잡이 이미지, 정규화된 이동 상태를 검사한다.

```tsx
const base = control.querySelector(".virtual-joystick__base");
const thumb = control.querySelector(".virtual-joystick__thumb");
expect(base).toHaveAttribute("src", "/assets/ui/joystick-wedding-compass-base.png");
expect(thumb).toHaveAttribute("src", "/assets/ui/joystick-wedding-compass-thumb.png");

fireEvent.keyDown(control, { key: "ArrowRight" });
expect(thumb).toHaveStyle({ "--joystick-x": "1", "--joystick-y": "0" });
```

`styles.test.ts`에는 `--joystick-travel: 30px`, 모바일 `22px`, 이미지 클래스 존재 검사를 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @wedding-game/client test -- VirtualJoystick.test.tsx styles.test.ts`

Expected: FAIL because image elements and CSS variables do not exist.

- [ ] **Step 3: 컴포넌트 구현**

픽셀 오프셋 상태를 방향 벡터 상태로 바꾸고 이미지 두 장을 렌더링한다.

```tsx
const [thumbVector, setThumbVector] = useState<Point>(zeroVector);

function applyVector(vector: Point) {
  setThumbVector(vector);
  onVectorChange(vector);
}

const assetBase = import.meta.env.BASE_URL;

return (
  <div className="virtual-joystick" ...>
    <img
      className="virtual-joystick__base"
      src={`${assetBase}assets/ui/joystick-wedding-compass-base.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
    <img
      className="virtual-joystick__thumb"
      src={`${assetBase}assets/ui/joystick-wedding-compass-thumb.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ "--joystick-x": thumbVector.x, "--joystick-y": thumbVector.y } as React.CSSProperties}
    />
  </div>
);
```

- [ ] **Step 4: CSS 구현**

```css
.virtual-joystick {
  --joystick-travel: 30px;
  width: 90px;
  height: 90px;
  background: transparent;
}

.virtual-joystick__base {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.virtual-joystick__thumb {
  position: relative;
  z-index: 1;
  width: 34px;
  height: 34px;
  object-fit: contain;
  transform: translate(
    calc(var(--joystick-x) * var(--joystick-travel)),
    calc(var(--joystick-y) * var(--joystick-travel))
  );
  transition: transform 60ms steps(2, end);
  pointer-events: none;
}

@media (max-width: 720px) {
  .virtual-joystick { --joystick-travel: 22px; }
  .virtual-joystick__thumb { width: 27px; height: 27px; }
}
```

기존 `::before`, `::after`, 내부 `span` 도형 규칙은 제거한다. `[aria-disabled="true"]`에는 `filter: grayscale(.35) brightness(.78)`만 적용한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @wedding-game/client test -- VirtualJoystick.test.tsx styles.test.ts`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add client/src/components/VirtualJoystick.tsx client/src/components/VirtualJoystick.test.tsx client/src/styles.css client/src/styles.test.ts
git commit -m "feat: render image-based wedding joystick"
```

### Task 3: 포털 시각 중심과 인식 범위 정렬

**Files:**
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`
- Modify: `client/src/components/WorldMiniMap.tsx`
- Modify: `client/src/components/WorldMiniMap.test.tsx`
- Modify: `client/src/components/GameWorld.test.tsx`
- Modify: `client/src/styles.test.ts`

**Interfaces:**
- Produces: `portalVisualCenter(portal: WorldPortal): Point`와 `WorldPortal.visualCenter?: Point`.
- Consumes: `portalEntryRect`를 사용하는 기존 GameWorld 포털 렌더링.

- [ ] **Step 1: 포털 계약 실패 테스트 작성**

`world.test.ts`에 모든 포털의 시각 중심과 접근점 포함 여부를 고정한다.

```ts
const expectedVisualCenters = {
  "home-to-neighborhood": { x: 300, y: 105 },
  "neighborhood-to-home": { x: 105, y: 360 },
  "neighborhood-to-station": { x: 1095, y: 360 },
  "station-to-neighborhood": { x: 105, y: 420 },
  "station-to-train": { x: 735, y: 420 },
  "train-to-station": { x: 105, y: 270 },
  "train-to-venue": { x: 1335, y: 270 },
  "venue-to-train": { x: 480, y: 795 },
  "venue-to-lobby": { x: 480, y: 105 },
  "lobby-to-venue": { x: 540, y: 795 },
  "lobby-to-bridal": { x: 105, y: 390 },
  "lobby-to-restroom": { x: 975, y: 390 },
  "lobby-to-hall": { x: 540, y: 105 },
  "bridal-to-lobby": { x: 360, y: 555 },
  "hall-to-lobby": { x: 390, y: 1815 },
  "hall-to-banquet": { x: 390, y: 105 },
  "restroom-to-lobby": { x: 105, y: 330 },
  "banquet-to-hall": { x: 600, y: 825 }
} as const;

for (const zone of gardenWorld.zones) {
  for (const portal of zone.portals) {
    expect(portalVisualCenter(portal)).toEqual(expectedVisualCenters[portal.id]);
    expect(pointInPortalEntry(portal, portal.approach)).toBe(true);
  }
}
```

`portalEntrySize` 기대값을 `{ width: 80, height: 34 }`로 변경한다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @wedding-game/client test -- src/game/world.test.ts`

Expected: FAIL because `visualCenter` and `portalVisualCenter` do not exist and size is `76x28`.

- [ ] **Step 3: 포털 모델과 헬퍼 구현**

```ts
export type WorldPortal = Rect & {
  id: string;
  label: string;
  to: WorldZoneId;
  approach: Point;
  visualCenter?: Point;
  facing: Direction;
  spawn: Point;
};

export const portalEntrySize = { width: 80, height: 34 } as const;

export function portalVisualCenter(portal: WorldPortal): Point {
  return portal.visualCenter ?? portal.approach;
}
```

`portalEntryRect`와 `pointInPortalEntry`는 `portalVisualCenter(portal)`을 사용한다. `portal()` 팩토리 마지막 인수로 `visualCenter?: Point`를 추가하고 Step 1의 18개 좌표를 각 선언에 입력한다.

- [ ] **Step 4: 미니맵을 시각 중심에 연결**

`WorldMiniMap.tsx`에서 포털 전체 rect 대신 실제 진 rect를 투영한다.

```tsx
{zone.portals.map((portal) => (
  <rect
    key={portal.id}
    data-testid="minimap-portal"
    className={`world-minimap__portal${portal.id === targetPortalId ? " world-minimap__portal--target" : ""}`}
    {...projectMiniMapRect(portalEntryRect(portal), zone.bounds, layout)}
  />
))}
```

`WorldMiniMap.test.tsx`에서 렌더된 `x/y`가 `projectMiniMapRect(portalEntryRect(zone.portals[0]), ...)`와 같은지 검사한다.

- [ ] **Step 5: 포털 렌더링과 조이스틱 진입 테스트 갱신**

`GameWorld.test.tsx`의 `76 by 28` 계약을 `80 by 34`로 변경하고, 각 버튼 style 중심이 `visualCenter`와 같은지 검사한다. 시각 중심에서 1px 안쪽은 진입, 1px 바깥은 미진입인 타원 경계 테스트를 유지한다.

- [ ] **Step 6: 포털 관련 테스트 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/client test -- src/game/world.test.ts src/components/WorldMiniMap.test.tsx src/components/GameWorld.test.tsx src/styles.test.ts
```

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add client/src/game/world.ts client/src/game/world.test.ts client/src/components/WorldMiniMap.tsx client/src/components/WorldMiniMap.test.tsx client/src/components/GameWorld.test.tsx client/src/styles.test.ts
git commit -m "fix: align portals with map entrances"
```

### Task 4: 지하철역 개찰구 배경과 전경 재설계

**Files:**
- Modify: `map-assets/reference/v2/subway-station/pixel-background-source.png`
- Delete: `map-assets/reference/v2/subway-station/ticket-gate-front-source.png`
- Create: `map-assets/reference/v2/subway-station/ticket-gate-bank-front-source.png`
- Modify: `client/public/assets/maps/v2/subway-station/background.webp`
- Delete: `client/public/assets/maps/v2/subway-station/ticket-gate-front.png`
- Create: `client/public/assets/maps/v2/subway-station/ticket-gate-bank-front.png`
- Modify: `map-assets/reference/v2/manifest.json`
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/world.test.ts`
- Modify: `client/src/components/GameWorld.test.tsx`
- Modify: `scripts/lib/mapForegroundAuditRenderer.mjs`
- Modify: `scripts/mapAssetAudit.test.mjs`

**Interfaces:**
- Produces: 단일 `station-gate-bank` 전경 `240x120`, `depthY=480`.
- Preserves: 세 blocker와 두 통행 경로.

- [ ] **Step 1: 단일 개찰구 은행 실패 테스트 작성**

`world.test.ts` 기대값을 다음 하나로 바꾼다.

```ts
expect(station.decorations.filter((item) => item.kind === "ticket-gate")).toEqual([
  expect.objectContaining({
    id: "station-gate-bank",
    x: 360,
    y: 360,
    width: 240,
    height: 120,
    asset: "ticket-gate-bank-front.png",
    depthY: 480
  })
]);
```

`GameWorld.test.tsx`는 `img[data-decoration="ticket-gate"]`가 1개이며 정확한 src와 rect를 갖는지 검사한다. `mapAssetAudit.test.mjs`의 station overlay 계약도 새 파일명과 `240x120`으로 바꾼다.

- [ ] **Step 2: 실패 확인**

Run:

```bash
pnpm --filter @wedding-game/client test -- src/game/world.test.ts src/components/GameWorld.test.tsx
node --test scripts/mapAssetAudit.test.mjs
```

Expected: 기존 전경 3개와 manifest 파일명 때문에 FAIL.

- [ ] **Step 3: 배경 원본 표시 후 개찰구 영역만 제거**

`view_image`로 `pixel-background-source.png`를 표시한 뒤 내장 `image_gen` 편집을 실행한다.

Prompt:

```text
이 지하철 역사 픽셀 배경에서 중앙의 금속 개찰구 기둥 3개와 연결 난간만 제거하고 같은 회색 바닥 타일로 자연스럽게 복원. 좌측 계단, 우측 승강장, 벤치, 기둥, 노선 띠, 안전선, 외벽과 전체 구도는 그대로 유지. 새 물체와 글자 금지.
```

출력 비율이 원본 `1300x1210`과 3% 이상 다르거나 다른 구조가 바뀌면 저장하지 않고 같은 단위만 재시도한다.

- [ ] **Step 4: 통합 개찰구 전경 생성**

정리된 배경과 기존 `ticket-gate-front-source.png`를 `view_image`로 표시한 뒤 참조 이미지로 사용한다.

Prompt:

```text
탑다운 지하철역용 통합 개찰구 은행 1개. 스테인리스 본체 3개와 사이의 통과 가능한 통로 2개, 투명 유리 플랩, 초록 진행 화살표와 작은 카드 인식등. 세 본체의 높이와 원근이 동일하고 하나의 연속된 전경. 정교한 고해상도 픽셀아트. 평평한 선명한 마젠타 배경. 바닥, 사람, 글자, 그림자 금지.
```

마젠타 키를 제거해 `ticket-gate-bank-front-source.png`로 저장하고 네 모서리 alpha가 0인지 확인한다.

- [ ] **Step 5: manifest와 런타임 배치 구현**

Manifest station overlay:

```json
{
  "source": "ticket-gate-bank-front-source.png",
  "output": "ticket-gate-bank-front.png",
  "width": 240,
  "height": 120
}
```

World decoration:

```ts
decoration("station-gate-bank", "ticket-gate", "통합 개찰구", 360, 360, 240, 120, {
  asset: "ticket-gate-bank-front.png",
  depthY: 480
})
```

`DEFAULT_FOREGROUND_PLACEMENTS["subway-station"]`도 이 배치 하나로 변경한다. 기존 세 blocker는 수정하지 않는다.

- [ ] **Step 6: 지하철역 에셋 빌드와 감사 시트 생성**

Run:

```bash
node scripts/build-map-assets.mjs --zone subway-station
pnpm maps:audit
pnpm maps:foreground-audit
```

Expected: map audit PASS, station background `900x840`, gate bank `240x120 RGBA`.

- [ ] **Step 7: 통행 경로와 렌더링 테스트 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/client test -- src/game/world.test.ts src/components/GameWorld.test.tsx
pnpm maps:test
```

Expected: PASS, `x=435`와 `x=525` 통로 경로가 유지됨.

- [ ] **Step 8: 구형 전경 삭제 및 커밋**

새 전경과 감사가 성공한 후 구형 source/output 두 파일만 삭제한다.

```bash
git add -u map-assets/reference/v2/subway-station client/public/assets/maps/v2/subway-station
git add map-assets/reference/v2/subway-station/ticket-gate-bank-front-source.png client/public/assets/maps/v2/subway-station/ticket-gate-bank-front.png map-assets/reference/v2/manifest.json client/src/game/world.ts client/src/game/world.test.ts client/src/components/GameWorld.test.tsx scripts/lib/mapForegroundAuditRenderer.mjs scripts/mapAssetAudit.test.mjs
git commit -m "fix: redesign subway station gates"
```

### Task 5: 전체 시각 검증과 배포

**Files:**
- Verify: `.superpowers/character-review/map-foreground-artifact-audit.png`
- Verify: `client/public/assets/ui/joystick-wedding-compass-base.png`
- Verify: `client/public/assets/ui/joystick-wedding-compass-thumb.png`
- Verify: `client/public/assets/maps/v2/subway-station/background.webp`
- Verify: `client/public/assets/maps/v2/subway-station/ticket-gate-bank-front.png`

**Interfaces:**
- Consumes: Tasks 1-4의 코드와 에셋.
- Produces: 검증된 `main` 배포와 공개 URL 확인 결과.

- [ ] **Step 1: 전체 자동 검증**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: 모든 명령 exit 0.

- [ ] **Step 2: 로컬 모바일 시각 검증**

Vite 서버를 실행하고 `390x844`에서 다음을 캡처한다.

- 모든 맵 포털이 출입구 중앙에 있는지 확인한다.
- 지하철역 개찰구 두 통로와 캐릭터 깊이를 확인한다.
- 조이스틱 중립·상·하·좌·우에서 손잡이가 베이스 안에 있는지 확인한다.
- 조이스틱, 미니맵, 초대장 메뉴 클릭이 맵 목표 이동을 만들지 않는지 확인한다.

- [ ] **Step 3: 데스크톱 시각 검증**

`1280x800`에서 지하철역과 조이스틱을 캡처하고 에셋 겹침, 흰색·마젠타 잔여, UI 겹침이 없는지 확인한다.

- [ ] **Step 4: 작업 상태 확인**

Run: `git status -sb`

Expected: 의도한 커밋 외에는 기존 미추적 원안 디렉터리만 남음.

- [ ] **Step 5: main 푸시와 Pages 배포 확인**

```bash
git push origin main
```

GitHub Actions `Deploy client to GitHub Pages` 실행이 `completed/success`가 될 때까지 확인한다.

- [ ] **Step 6: 공개 사이트 확인**

URL: `https://po-mato.github.io/pixel-garden-invitation/`

확인 항목:

- 새 JS/CSS 번들 HTTP 200
- 조이스틱 base/thumb HTTP 200
- 지하철역 background/gate bank HTTP 200
- 모바일 브라우저 초기 화면 로드 오류 없음


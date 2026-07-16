# 맵 아티팩트 2차 보정 구현 계획

> **에이전트 작업 지침:** 구현 시 `superpowers:executing-plans`를 사용해 작업별로 실행한다. 이미지 편집 결과는 맵별 합성 시트로 승인한 뒤 다음 작업으로 진행한다.

**목표:** 화장실 중복 칸막이, 동네 나무 기준선, 버진로드 중앙 장식, 연회장 테이블 접합을 보정한다.

**구조:** 불필요한 전경은 계약에서 제거하고, 필요한 전경은 배경 기준으로 앵커 또는 자산만 교체한다. 맵 감사기는 전경이 없는 맵도 허용하며, 실제 런타임 좌표와 동일한 합성 시트로 모든 결과를 검증한다.

**기술 스택:** 내장 이미지 생성·편집 도구, PNG/WebP, Sharp, TypeScript, Vitest, Node.js 테스트 러너

## 전역 제약

- 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 새 worktree를 만들지 않는다.
- 충돌 영역, 포털, 스폰, 미니맵, 이동 경로와 맵 크기는 유지한다.
- 보정 대상 네 맵 외 배경과 전경은 변경하지 않는다.
- 사용자 요청 전에는 커밋, 푸시, 배포하지 않는다.

---

### 작업 1: 화장실 전경 없는 맵 계약

**파일:**
- 수정: `scripts/lib/mapAssetAudit.mjs`
- 수정: `scripts/mapAssetAudit.test.mjs`
- 수정: `map-assets/reference/v2/manifest.json`
- 수정: `client/src/game/world.ts`
- 수정: `client/src/game/world.test.ts`
- 수정: `client/src/components/GameWorld.test.tsx`
- 수정: `scripts/lib/mapForegroundAuditRenderer.mjs`

**인터페이스:**
- 소비: `zone.overlays: Array<MapOverlay>`
- 생산: 빈 배열도 허용하는 맵 매니페스트와 화장실 배경 전용 렌더링

- [ ] **1단계:** 빈 `overlays` 배열은 허용하지만 필드 누락과 배열 외 값은 거부하는 감사 테스트를 작성한다.

```js
test("allows a zone whose background needs no foreground overlay", async () => {
  await withFixture(async ({ rootDir, manifestPath }) => {
    const overlaylessManifest = {
      ...manifest,
      zones: manifest.zones.map((zone) => ({ ...zone, overlays: [] }))
    };
    await writeFile(manifestPath, `${JSON.stringify(overlaylessManifest, null, 2)}\n`);
    const result = await auditFixture({ rootDir, manifestPath });
    assert.equal(result.errors.length, 0);
  });
});
```

- [ ] **2단계:** 현재 `overlays.length === 0` 검사 때문에 실패하는지 확인한다.

```bash
node --test scripts/mapAssetAudit.test.mjs
```

- [ ] **3단계:** 감사기 조건을 배열 여부만 검사하도록 수정한다.

```js
if (!Array.isArray(zone.overlays)) {
  errors.push(`manifest overlays must be an array for ${zone.id}`);
} else {
  addDuplicateErrors(errors, zone.overlays.map((overlay) => overlay?.output).filter(Boolean), `${zone.id} overlay output`);
  for (const overlay of zone.overlays) {
    // 기존 overlay 유효성 및 파일 감사 유지
  }
}
```

- [ ] **4단계:** 화장실 매니페스트의 `overlays`를 빈 배열로 만들고 `restroom-stall-front` 장식을 제거한다. `blocked`의 `{ x: 420, y: 240, width: 150, height: 240 }`는 유지한다.
- [ ] **5단계:** 전역 매니페스트 테스트를 `assetDecorations.length === overlayOutputs.size` 계약으로 바꾸고, 화장실에 `stall-front` 이미지가 렌더링되지 않는 컴포넌트 테스트를 작성한다.

```tsx
expect(container.querySelector('img[data-decoration-label="화장실 칸 전경"]')).not.toBeInTheDocument();
```

- [ ] **6단계:** 전경 감사 기본 배치에서 `restroom`을 빈 배열로 변경한다.

```js
restroom: []
```

- [ ] **7단계:** 관련 테스트를 실행한다.

```bash
node --test scripts/mapAssetAudit.test.mjs scripts/mapForegroundAuditRenderer.test.mjs
pnpm --filter @wedding-game/client exec vitest run src/game/world.test.ts src/components/GameWorld.test.tsx
```

### 작업 2: 동네 나무 기준선 통일

**파일:**
- 수정: `client/src/game/world.ts`
- 수정: `client/src/game/world.test.ts`
- 수정: `scripts/lib/mapForegroundAuditRenderer.mjs`

**인터페이스:**
- 소비: `tree-canopy.png` 90x150
- 생산: 세 수관의 `y = 90`, `depthY = 240` 기준선

- [ ] **1단계:** 세 나무가 같은 `y`와 `depthY`를 사용하는 실패 테스트를 작성한다.

```ts
expect(neighborhood.decorations.filter((item) => item.kind === "tree")).toEqual([
  expect.objectContaining({ x: 214, y: 90, width: 90, height: 150, depthY: 240 }),
  expect.objectContaining({ x: 513, y: 90, width: 90, height: 150, depthY: 240 }),
  expect.objectContaining({ x: 860, y: 90, width: 90, height: 150, depthY: 240 })
]);
```

- [ ] **2단계:** 월드 테스트가 첫째·셋째 나무의 현재 `y = 120`, `depthY = 270` 때문에 실패하는지 확인한다.
- [ ] **3단계:** `world.ts`와 감사 배치의 첫째·셋째 나무를 `y = 90`, `depthY = 240`으로 수정한다.
- [ ] **4단계:** 월드 테스트와 전경 감사 시트를 실행해 세 수관의 하단이 동일 화단 기준선에 놓이는지 확인한다.

```bash
pnpm --filter @wedding-game/client exec vitest run src/game/world.test.ts
pnpm maps:foreground-audit
```

### 작업 3: 버진로드 장식 정리

**파일:**
- 수정: `map-assets/reference/v2/ceremony-hall/pixel-background-source.png`
- 수정: `client/public/assets/maps/v2/ceremony-hall/background.webp`
- 수정: `client/src/game/world.ts`
- 수정: `client/src/game/world.test.ts`
- 수정: `scripts/lib/mapForegroundAuditRenderer.mjs`

**인터페이스:**
- 소비: 예식홀 배경과 `aisle-bouquet-front.png`
- 생산: 중앙 카펫이 비어 있고 꽃장식 경계가 `x = 240` 또는 `x = 480`인 예식홀

- [ ] **1단계:** 꽃장식이 `hall-aisle`의 `{ x: 300, width: 180 }` 내부를 침범하지 않는 실패 테스트를 작성한다.

```ts
for (const bouquet of hall.decorations.filter((item) => item.kind === "aisle-bouquet")) {
  const overlapsAisle = bouquet.x < 480 && bouquet.x + bouquet.width > 300;
  expect(overlapsAisle, bouquet.id).toBe(false);
}
```

- [ ] **2단계:** 기존 네 장식이 카펫을 30px씩 침범해 테스트가 실패하는지 확인한다.
- [ ] **3단계:** 배경을 `view_image`로 표시하고 내장 이미지 편집 도구로 중앙 카펫의 네 작은 녹색·금색 받침만 제거한다. 좌석, 카펫 문양, 단상, 출입문은 그대로 유지한다.
- [ ] **4단계:** 결과의 세로 비율과 카펫 연속성을 확인한 뒤에만 `pixel-background-source.png`를 교체하고 예식홀 맵을 다시 빌드한다.

```bash
pnpm maps:build -- --zone ceremony-hall
```

- [ ] **5단계:** 왼쪽 꽃장식 2개를 `x = 240`, 오른쪽 꽃장식 2개를 `x = 480`으로 이동하고 `depthY`는 각각 기존 `y + 90` 값을 유지한다.
- [ ] **6단계:** 감사 배치도 같은 좌표로 갱신하고 테스트·맵 감사를 실행한다.

```bash
pnpm --filter @wedding-game/client exec vitest run src/game/world.test.ts src/components/GameWorld.test.tsx
pnpm maps:audit
pnpm maps:foreground-audit
```

### 작업 4: 연회장 테이블 전경 교체

**파일:**
- 참조: `map-assets/reference/v2/banquet/pixel-background-source.png`
- 수정: `map-assets/reference/v2/banquet/table-front-source.png`
- 수정: `client/public/assets/maps/v2/banquet/table-front.png`

**인터페이스:**
- 소비: 아이보리 반원 테이블 상단과 골드 의자가 있는 연회장 배경
- 생산: 투명 배경의 1:1 테이블 하단 전경, 앱 출력 180x180

- [ ] **1단계:** 배경과 기존 전경을 `view_image`로 표시한다.
- [ ] **2단계:** 기존 전경을 참조해 내장 이미지 편집 도구로 다음 요구의 단일 투명 자산을 생성한다.

```text
밝은 아이보리 웨딩 연회장 반원 테이블의 하단 전경. 배경 테이블과 같은 천 색과 금색 의자 3개, 같은 탑다운 원근. 중앙 정렬, 정사각형 투명 배경, 그림자 최소화, 글자 금지.
```

- [ ] **3단계:** 검은색·흰색 배경이 남지 않고, 상단 접합선이 수평이며, 의자 3개가 배경 원근과 일치하는 결과만 저장한다.
- [ ] **4단계:** 연회장 자산을 빌드하고 기존 여섯 좌표에 합성한다.

```bash
pnpm maps:build -- --zone banquet
pnpm maps:foreground-audit
```

- [ ] **5단계:** 여섯 테이블에서 상단 배경과 하단 전경의 폭·천 색·의자 중심을 검사한다. 접합이 어긋나면 자산만 다시 생성하고 좌표·충돌 영역은 변경하지 않는다.
- [ ] **6단계:** 맵 감사를 실행한다.

```bash
pnpm maps:audit
pnpm maps:test
```

### 작업 5: 네 맵 런타임 시각 검증

**파일:**
- 갱신: `.superpowers/character-review/map-foreground-artifact-audit.png`
- 갱신: `.superpowers/map-review/v2/{neighborhood,restroom,ceremony-hall,banquet}-{desktop,mobile}.png`

- [ ] **1단계:** 전경 감사 시트를 다시 생성하고 `view_image`로 네 맵을 확인한다.

```bash
pnpm maps:foreground-audit
```

- [ ] **2단계:** 로컬 개발 서버에서 동네, 화장실, 예식홀, 연회장을 데스크톱과 390px 모바일 뷰포트로 캡처한다.
- [ ] **3단계:** 화장실 중복문 없음, 세 나무 기준선 일치, 카펫 중앙 비움, 여섯 테이블 접합선 없음과 캐릭터 전경 가림을 확인한다.
- [ ] **4단계:** 전체 테스트, 타입 검사와 프로덕션 빌드를 실행한다.

```bash
pnpm test
pnpm typecheck
pnpm build
```

- [ ] **5단계:** `git diff --check`와 `git status --short`로 기존 포털 수정 및 미추적 하객 원본을 보존했는지 확인한다.

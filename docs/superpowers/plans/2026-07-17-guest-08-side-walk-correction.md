# 8번 하객 측면 보행 보정 구현 계획

> **에이전트 작업 지침:** 구현 시 `superpowers:executing-plans`를 사용해 작업별로 실행한다. 각 이미지 생성 결과는 저장 전에 눈으로 검수한다.

**목표:** 8번 하객 좌우 보행을 전진·중립·반대발 전진의 세 프레임으로 교체하면서 기존 3등신과 캐릭터 외형을 유지한다.

**구조:** 기존 v2 비픽셀 원안을 두 방향만 교체한 뒤 기존 픽셀화 파이프라인으로 앱 원본과 월드용 시트를 다시 생성한다. 자동 테스트는 8번 좌우 행에서 중앙 프레임의 하단 발 폭이 양쪽 보행 프레임보다 좁은지 확인한다.

**기술 스택:** 내장 이미지 생성·편집 도구, PNG, Sharp, Node.js 테스트 러너

## 전역 제약

- 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 새 worktree를 만들지 않는다.
- `guest-08/left`, `guest-08/right` 외 원안은 변경하지 않는다.
- 정면과 뒷면, 머리 크기, 얼굴 형태, 드레스 길이와 전체 키는 유지한다.
- 사용자 요청 전에는 커밋, 푸시, 배포하지 않는다.

---

### 작업 1: 8번 좌우 보행 회귀 테스트

**파일:**
- 수정: `scripts/characterAssetGenerator.test.mjs`
- 입력: `character-assets/source/guests/feminine-teal-modern-hanbok__walk.png`

**인터페이스:**
- 소비: 96x144 프레임, 좌우 행 인덱스 1과 2
- 생산: 중앙 프레임 발 폭이 양쪽 프레임보다 좁다는 테스트 계약

- [ ] **1단계:** 테스트 파일에 하단 알파 폭 측정 헬퍼를 추가한다.

```js
async function lowerAlphaSpan(file, left, top, width = 96, height = 144) {
  const { data, info } = await sharp(file)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const xs = [];
  for (let y = Math.floor(height * 0.875); y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 0) xs.push(x);
    }
  }
  return Math.max(...xs) - Math.min(...xs) + 1;
}
```

- [ ] **2단계:** 좌우 각 행에서 2컷의 발 폭이 1·3컷보다 최소 4px 좁은 테스트를 작성한다.

```js
test("guest 08 side walk closes the feet on the neutral frame", async () => {
  const file = join(root, "character-assets/source/guests/feminine-teal-modern-hanbok__walk.png");
  for (const row of [1, 2]) {
    const spans = await Promise.all([0, 1, 2].map((column) =>
      lowerAlphaSpan(file, column * 96, row * 144)
    ));
    assert.ok(spans[1] <= spans[0] - 4, `row ${row} neutral vs step 1: ${spans}`);
    assert.ok(spans[1] <= spans[2] - 4, `row ${row} neutral vs step 3: ${spans}`);
  }
});
```

- [ ] **3단계:** 테스트를 실행해 현재 동일한 벌어진 다리 원본 때문에 실패하는지 확인한다.

```bash
node --test scripts/characterAssetGenerator.test.mjs
```

예상 결과: `guest 08 side walk closes the feet on the neutral frame` 실패.

### 작업 2: 왼쪽 보행 원안 교체

**파일:**
- 참조: `character-assets/reference/guest-walk-ratio-redraw-sources/v2/_sheets/guest-08/left-walk-cycle-source.png`
- 수정: `character-assets/reference/guest-walk-ratio-redraw-sources/v2/_sheets/guest-08/left-walk-cycle-source.png`
- 수정: `character-assets/reference/guest-walk-ratio-redraw-sources/v2/guest-08/left/step-01-source.png`
- 수정: `character-assets/reference/guest-walk-ratio-redraw-sources/v2/guest-08/left/step-02-source.png`
- 수정: `character-assets/reference/guest-walk-ratio-redraw-sources/v2/guest-08/left/step-03-source.png`

**인터페이스:**
- 소비: 기존 왼쪽 3컷 원안
- 생산: 동일 캐릭터의 왼발 전진·중립·오른발 전진 3컷 시트

- [ ] **1단계:** 기존 왼쪽 시트를 `view_image`로 표시한다.
- [ ] **2단계:** 내장 이미지 편집 도구에 기존 시트를 참조하고 다음 요구로 한 장만 생성한다.

```text
같은 여성 SD 캐릭터의 왼쪽 보행 3컷. 첫 컷 앞발 전진, 둘째 컷 두 다리를 모은 중립, 셋째 컷 반대발 전진. 같은 머리와 얼굴, 같은 키와 드레스 길이. 흰 배경. 글자와 도표 금지.
```

- [ ] **3단계:** 결과에서 방향, 3등신, 머리·얼굴 크기, 핸드백, 세 다리 자세를 확인한다. 하나라도 다르면 저장하지 않고 같은 방향만 재시도한다.
- [ ] **4단계:** 승인 결과를 `.superpowers/generated/guest-08-left-walk-cycle-source.png`에 저장하고 분리 스크립트로 세 컷을 갱신한다.

```bash
node scripts/split-guest-ratio-redraw-sheet.mjs \
  --input .superpowers/generated/guest-08-left-walk-cycle-source.png \
  --guest guest-08 \
  --direction left \
  --out-root character-assets/reference/guest-walk-ratio-redraw-sources/v2
```

### 작업 3: 오른쪽 보행 원안 교체

**파일:**
- 참조: `character-assets/reference/guest-walk-ratio-redraw-sources/v2/_sheets/guest-08/right-walk-cycle-source.png`
- 수정: `character-assets/reference/guest-walk-ratio-redraw-sources/v2/_sheets/guest-08/right-walk-cycle-source.png`
- 수정: `character-assets/reference/guest-walk-ratio-redraw-sources/v2/guest-08/right/step-01-source.png`
- 수정: `character-assets/reference/guest-walk-ratio-redraw-sources/v2/guest-08/right/step-02-source.png`
- 수정: `character-assets/reference/guest-walk-ratio-redraw-sources/v2/guest-08/right/step-03-source.png`

**인터페이스:**
- 소비: 기존 오른쪽 3컷 원안
- 생산: 동일 캐릭터의 오른발 전진·중립·왼발 전진 3컷 시트

- [ ] **1단계:** 기존 오른쪽 시트를 `view_image`로 표시한다.
- [ ] **2단계:** 내장 이미지 편집 도구에 기존 시트를 참조하고 다음 요구로 한 장만 생성한다.

```text
같은 여성 SD 캐릭터의 오른쪽 보행 3컷. 첫 컷 앞발 전진, 둘째 컷 두 다리를 모은 중립, 셋째 컷 반대발 전진. 같은 머리와 얼굴, 같은 키와 드레스 길이. 흰 배경. 글자와 도표 금지.
```

- [ ] **3단계:** 결과를 왼쪽과 같은 기준으로 검수하고 승인 결과만 `.superpowers/generated/guest-08-right-walk-cycle-source.png`에 저장한다.
- [ ] **4단계:** 분리 스크립트로 오른쪽 세 컷을 갱신한다.

```bash
node scripts/split-guest-ratio-redraw-sheet.mjs \
  --input .superpowers/generated/guest-08-right-walk-cycle-source.png \
  --guest guest-08 \
  --direction right \
  --out-root character-assets/reference/guest-walk-ratio-redraw-sources/v2
```

### 작업 4: 픽셀 자산 및 앱 시트 갱신

**파일:**
- 수정: `character-assets/reference/guest-walk-ratio-redraw-pixel-sources/v2/guest-08/left/*.png`
- 수정: `character-assets/reference/guest-walk-ratio-redraw-pixel-sources/v2/guest-08/right/*.png`
- 수정: `character-assets/reference/guest-walk-ratio-redraw-pixel-sources/v2/_sheets/guest-08/{left,right}-walk-cycle-pixel.png`
- 수정: `character-assets/source/guests/feminine-teal-modern-hanbok__walk.png`
- 수정: `client/public/characters/generated/guests/feminine-teal-modern-hanbok__walk.png`
- 수정: `client/public/characters/generated/guests/world/feminine-teal-modern-hanbok__walk.png`

**인터페이스:**
- 소비: 승인된 v2 좌우 원안
- 생산: 96x144 앱 프레임과 48x72 월드 프레임

- [ ] **1단계:** 8번만 픽셀화하고 앱 원본을 다시 작성한다.

```bash
pnpm characters:refresh-ratio-guests -- guest-08
```

- [ ] **2단계:** 생성 앱 자산을 갱신한다.

```bash
pnpm characters:generate
```

- [ ] **3단계:** 작업 1 테스트와 캐릭터 감사를 실행한다.

```bash
node --test scripts/characterAssetGenerator.test.mjs
pnpm characters:audit
```

예상 결과: 테스트와 감사 모두 종료 코드 0.

### 작업 5: 8번 리뷰 및 최종 검증

**파일:**
- 갱신: `.superpowers/character-review/guest-walk-ratio-redraw-v2-guest-08.png`
- 갱신: `.superpowers/character-review/guest-walk-ratio-redraw-v2-guest-08-ratio-audit.png`

- [ ] **1단계:** 일반 리뷰와 비율 감사 시트를 생성한다.

```bash
node scripts/render-guest-walk-review-sheet.mjs \
  --guest guest-08 \
  --source-root character-assets/reference/guest-walk-ratio-redraw-sources/v2 \
  --out .superpowers/character-review/guest-walk-ratio-redraw-v2-guest-08.png \
  --scale 0.28
node scripts/render-guest-walk-ratio-audit-sheet.mjs \
  --guest guest-08 \
  --source-root character-assets/reference/guest-walk-ratio-redraw-sources/v2 \
  --out .superpowers/character-review/guest-walk-ratio-redraw-v2-guest-08-ratio-audit.png \
  --scale 0.28
```

- [ ] **2단계:** 원안 리뷰, 비율 감사, 좌우 픽셀 시트, 월드용 시트를 `view_image`로 확인한다.
- [ ] **3단계:** 변경 파일이 8번 좌우 및 파생 시트에만 한정되는지 `git diff --stat`으로 확인한다.

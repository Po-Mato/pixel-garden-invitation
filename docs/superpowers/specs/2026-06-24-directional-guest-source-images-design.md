# 하객 방향별 원본 이미지 분리 설계

작성일: 2026-06-24

## 목적

하객 캐릭터의 `up`, `down`, `left`, `right` 이미지를 정면 이미지에서 런타임 또는 시트 생성 시 억지 파생하지 않는다. 각 하객은 방향별 원본 PNG 4장을 먼저 갖고, 생성기는 이 원본들을 픽셀화해 최종 walk/idle 시트를 조립한다.

## 문제 정의

이전 구현은 승인된 정면 crop 한 장을 기준으로 좌/우/뒤를 코드에서 변형했다. 이 방식은 파일 계약상 방향 행이 존재하더라도 실제 아트 소스는 정면 한 장뿐이어서, 좌/우/뒤 방향감이 약하고 검수·교체 단위도 불명확하다.

## 새 구조

각 프리셋은 다음 방향 원본 파일을 가진다.

```text
character-assets/reference/guest-directions/{preset-id}/down.png
character-assets/reference/guest-directions/{preset-id}/left.png
character-assets/reference/guest-directions/{preset-id}/right.png
character-assets/reference/guest-directions/{preset-id}/up.png
```

`character-assets/guest-character-presets.json`의 각 프리셋에는 `reference.directions`를 추가한다.

```json
{
  "reference": {
    "image": "character-assets/reference/guest-foundation-unified-reference-v1.png",
    "crop": { "left": 104, "top": 40, "width": 143, "height": 387 },
    "directions": {
      "down": "character-assets/reference/guest-directions/feminine-long-wave-dress/down.png",
      "left": "character-assets/reference/guest-directions/feminine-long-wave-dress/left.png",
      "right": "character-assets/reference/guest-directions/feminine-long-wave-dress/right.png",
      "up": "character-assets/reference/guest-directions/feminine-long-wave-dress/up.png"
    }
  }
}
```

## 생성 흐름

1. `scripts/author-guest-direction-sources.mjs`가 방향별 원본 PNG를 생성한다.
2. `scripts/author-guest-preset-sources.mjs`는 `reference.directions` 파일만 읽는다.
3. 각 방향 원본을 배경 제거, trim, `96x144` 픽셀 프레임으로 정렬한다.
4. walk 시트는 `down`, `left`, `right`, `up` 행에 해당 방향 프레임을 배치한다.
5. idle 시트는 `down` 방향 원본을 기준으로 만든다.

## 고정 규칙

- walk 방향 이미지를 정면 crop에서 즉석 파생하지 않는다.
- 방향 원본 PNG가 없으면 생성은 실패해야 한다.
- 방향 원본은 추후 수작업 또는 더 좋은 이미지 생성 결과로 교체할 수 있는 독립 자산이다.
- 문서와 사용자 검수 문구는 한국어를 유지한다.

## 검증 기준

- 모든 프리셋이 `down`, `left`, `right`, `up` 방향 원본 경로를 가진다.
- 생성기는 방향별 원본 PNG에서 프레임을 읽어 walk 시트를 만든다.
- `left`, `right`, `up` 행이 `down` 프레임 복제이면 테스트가 실패한다.
- `pnpm characters:audit`, `pnpm characters:test`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `git diff --check`가 통과한다.

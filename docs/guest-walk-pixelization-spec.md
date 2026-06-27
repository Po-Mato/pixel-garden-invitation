# 하객 보행 원안 픽셀화 스펙

이 문서는 하객 12명의 보행 원안 이미지를 모바일 청첩장용 픽셀 스프라이트로 변환할 때의 기준이다. 현재 원안 단계의 목표는 캐릭터별 방향, 의상, 액세서리, 3컷 보행 흐름을 확정하는 것이며, 최종 게임 적용 이미지는 별도 픽셀화 단계에서 만든다.

## 입력 원안

원안 소스는 비픽셀 기준 이미지로 유지한다.

- 원본 시트: `character-assets/reference/guest-walk-cycle-sources/v1/guest-XX/{down,left,right,up}-walk-cycle-source.png`
- 분리 컷: `character-assets/reference/guest-walk-direction-sources/v1/guest-XX/{down,left,right,up}/step-01-source.png`부터 `step-03-source.png`

각 `guest-XX / direction` 단위는 3컷 보행 원안 1장과 분리된 3개 step 파일을 함께 가진다. 방향별 원안 시트는 픽셀화 전 리뷰와 재분리의 기준 파일이며, 분리 컷은 픽셀화 작업의 직접 입력으로 사용한다.

## 출력 목표

- 최종 하객 스프라이트 프레임은 기존 프리셋 파이프라인과 같은 `96x144` 기준으로 맞춘다.
- 12명 모두 같은 바닥 기준선과 비슷한 머리/몸 크기로 정렬한다.
- 배경은 투명하게 유지한다.
- 모바일 표시 크기에서도 얼굴, 헤어, 의상, 액세서리의 핵심 인상이 읽혀야 한다.
- 픽셀화 결과는 흐릿한 축소 이미지가 아니라, 선명한 실루엣과 제한된 색 덩어리로 정리된 스프라이트여야 한다.

## 방향 규칙

- `down`: 정면.
- `up`: 후면. 얼굴, 정면, 측면 인상이 보이면 실패로 본다.
- `left`: 왼쪽을 바라보는 측면.
- `right`: 오른쪽을 바라보는 측면.

한 방향의 1/2/3컷 안에서 시선 방향이 바뀌면 실패로 본다. 가방, 숄, 한복 장식, 헤어 실루엣처럼 캐릭터 식별에 필요한 요소는 컷 사이에서 사라지거나 반대편으로 튀지 않아야 한다.

## 보행 컷 규칙

기본 순서는 다음을 목표로 한다.

- `step-01`: 캐릭터 기준 오른발이 앞으로 나오는 컷.
- `step-02`: 거의 가만히 서 있는 중립 컷.
- `step-03`: 캐릭터 기준 왼발이 앞으로 나오는 컷.

다만 긴 치마, 한복 치마, 측면 실루엣처럼 좌우 발 구분이 실제 표시 크기에서 명확하지 않은 경우에는 좌우 발 판정보다 자연스러운 보행감과 캐릭터 일관성을 우선한다. 측면 원안에서 발 방향 판정이 애매한 컷은 원안 단계에서 더 이상 무리하게 보정하지 않고, 픽셀화 단계에서 모바일 크기 기준으로 어색하지 않을 정도만 정리한다.

## 픽셀화 기준

- 원안의 세부 묘사를 그대로 축소하지 말고, 작은 화면에서 읽히는 큰 형태부터 정리한다.
- 얼굴은 작고 단정한 하객 인상으로 유지한다. 눈, 입, 머리카락이 검은 덩어리처럼 뭉치면 실패로 본다.
- 의상은 웨딩 하객 복장으로 읽혀야 하며, 한복/수트/원피스/가방 같은 캐릭터별 핵심 차이를 남긴다.
- 각 컷의 몸 중심이 과하게 흔들리거나 발이 프레임 밖으로 잘리면 실패로 본다.
- `step-02`는 idle 대체로도 쓸 수 있을 정도의 중립 포즈에 가깝게 둔다.

## 검수 절차

픽셀화 전후로 다음을 확인한다.

```bash
node scripts/render-guest-walk-review-sheet.mjs --all --out .superpowers/character-review/guest-walk-v1-contact-sheet.png
pnpm characters:author-guest-presets
pnpm characters:audit
pnpm characters:generate
pnpm characters:contact-sheet -- --mode=guest-presets --output=.superpowers/character-review/guest-preset-contact-sheet.png
pnpm characters:test
```

릴리스 후보로 묶기 전에는 다음까지 통과시킨다.

```bash
pnpm test
pnpm typecheck
pnpm build
```

## 다음 작업 순서

1. 현재 `guest-walk-*sources/v1` 원안을 기준으로 픽셀화 입력을 확정한다.
2. 방향별 `step-01/02/03`을 `96x144` 프레임에 맞춰 픽셀 스프라이트로 변환한다.
3. 기존 `character-assets/source/guests` 하객 프리셋 시트를 새 보행 컷 기준으로 갱신한다.
4. `guest-preset-contact-sheet`와 모바일 화면 표시 크기에서 12명 전체를 함께 검토한다.
5. 검수 통과 후 런타임 하객 프리셋에 반영한다.

# 캐릭터 아트 방향 고정 문서

이 프로젝트의 신랑/신부 NPC 아트는 Codex 세션 `019eabf9-3872-7d40-9d46-157edc38abc5`에서 승인된 레퍼런스를 기준으로 고정한다.

기준 파일:

- `character-assets/reference/approved-couple.png`
- `character-assets/reference/approved-couple.json`
- `character-assets/reference/couple-source-lock.json`

고정 방향:

- 아트 방향: 장식성이 살아 있는 로맨틱 웨딩 패션 픽셀 아트.
- 비율: A2 균형형 컴팩트 비율.
- 얼굴: F1 기준의 선명하고 정돈된 얼굴.
- idle 포즈: 승인 레퍼런스 상단 행의 정지 초상 포즈. 정원 NPC는 걷는 중이 아니라 웨딩 초상처럼 서 있는 인상이어야 한다.
- walk 포즈: 승인 레퍼런스 하단 행의 컴팩트한 게임플레이 보행 포즈. 걷는 자세는 `*-walk.png`에만 사용한다.
- 신랑: 레이어가 보이는 어두운 헤어, 블랙 핏 턱시도, 새틴 라펠, 흰 셔츠, 보타이, 부토니에, 정돈된 구두.
- 신부: 허리까지 내려오는 다크 브라운 웨이브, 진주/플로럴 헤드피스, 아이보리 레이스 드레스, 부케, 레이어드 스커트/트레인 디테일.

절대 규칙:

- 신랑/신부 NPC를 단순 블록 아트, 저디테일 범용 픽셀 캐릭터, 승인 레퍼런스의 패션/디테일 언어가 빠진 에셋으로 교체하지 않는다.
- `character-assets/source/npc/*` 변경은 의도적인 아트 방향 변경으로 취급한다.
- 병합 전에는 `approved-couple.png`와 시각 비교 후 lock 메타데이터를 갱신하고 아래 검증을 실행한다.

```bash
pnpm characters:contact-sheet -- --mode=couple --output=.superpowers/character-review/couple-art-review.png
pnpm characters:audit -- --scope=couple
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
```

## 하객 완성 캐릭터 프리셋 고정

2026-06-24 이후 하객 캐릭터는 부위별 조합형 파츠 시스템을 런타임 기준으로 사용하지 않는다. 하객은 확정된 기초 이미지 기준의 완성 캐릭터 프리셋을 선택하는 방식으로 고정한다.

기준 파일:

- `character-assets/guest-character-presets.json`
- `character-assets/source/guests/*`
- `client/public/characters/generated/guests/*`
- `.superpowers/character-review/guest-preset-contact-sheet.png`

고정 규칙:

- 사용자는 헤어, 의상, 액세서리를 따로 조합하지 않는다.
- 각 하객은 얼굴, 헤어, 의상, 액세서리가 함께 설계된 완성 스프라이트다.
- 얼굴이 외계인처럼 보이거나 눌려 보이는 프리셋은 실패로 본다.
- 머리카락이 얼굴 중앙을 큰 검은 마스크처럼 덮으면 실패로 본다.
- 기준 이미지의 둥근 얼굴, 작고 분리된 눈, 작은 입, 웨딩 하객 포멀 의상 톤을 유지한다.
- 기존 `guest-part-manifest.json`과 `base`, `hair`, `outfits`, `accessories` 소스는 레거시 자료이며 하객 런타임 품질 기준이 아니다.

회귀 방지 검증:

```bash
pnpm characters:author-guest-presets
pnpm characters:audit
pnpm characters:generate
pnpm characters:contact-sheet -- --mode=guest-presets --output=.superpowers/character-review/guest-preset-contact-sheet.png
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
```

## 하객 캐릭터 파츠 레거시 기록

아래 파츠 조합형 내용은 2026-06-24 이전 실험 기록이다. 현재 하객 런타임 기준은 위의 “하객 완성 캐릭터 프리셋 고정”이며, 이 섹션은 레거시 파츠 자료를 해석할 때만 참고한다.

하객 캐릭터도 승인된 신랑/신부 아트 방향을 따른다. 단, 이 레거시 설계에서는 하객을 교체 가능한 파츠 시스템으로 관리하며 소스 프레임은 `96x144`, 정원 표시 크기는 `48x72`, 커스터마이저 미리보기는 `96x144`로 정했다.

기준 파일:

- `character-assets/guest-part-manifest.json`
- `shared/character-catalog.json`
- `character-assets/source/base/*`
- `character-assets/source/hair/*`
- `character-assets/source/outfits/*`
- `character-assets/source/accessories/*`

고정 방향:

- 품질 목표: 신랑/신부의 시각 디테일을 하객용 파츠 시스템에 맞게 축소하되, 저가형 블록 캐릭터처럼 보이지 않게 유지한다.
- 비율: A2 균형형 컴팩트 비율. 사각 머리, 블록 몸통, 외계인 같은 얼굴 실루엣은 금지한다.
- 얼굴: F1 기준의 명확한 눈/입/볼 디테일을 유지한다. 큰 검은 마스크처럼 보이는 얼굴 덩어리를 만들지 않는다.
- 구성: 하객은 `base`, `back-hair`, `front-hair`, `outfit`, `accessory` 계열 파츠의 조합으로만 구성한다.
- 헤어/의상/액세서리는 각각 독립 소스 PNG로 관리한다. 런타임에서 최종 아트를 절차적으로 그리지 않는다.
- 헤어와 의상 catalog 항목은 서로 다른 실루엣을 가져야 한다. 같은 형태의 색상만 바꾸는 것은 hair color 또는 outfit palette 변형에만 허용한다.
- 신부 전용 드레스/트레인/부케 디테일과 신랑 전용 블랙 턱시도/부토니에 표현은 NPC 전용으로 유지한다.

프레임 규격:

- 하객 walk 소스: `288x576` (`96x144` 프레임, 3열 × 4행).
- 하객 idle 소스: `192x144` (`96x144` 프레임, 2열 × 1행).
- 정원 표시 크기: `48x72`.
- 커스터마이저 표시 크기: `96x144`.

하객 레이어 순서:

1. `back-accessory`
2. `back-hair`
3. `base`
4. `outfit`
5. `front-hair`
6. `face`
7. `jewelry`
8. `neckwear`
9. `carry`

현재 구현에서는 하객 파츠를 변경하지 않는다. `guest-part-manifest.json`과 `shared/src/guestPartManifest.test.ts`는 레거시 파츠 자료 보존용 계약이다.

## 하객 기초 기준 이미지 고정

하객 캐릭터 재작업의 기준은 다음 파일로 고정한다.

- `character-assets/reference/guest-foundation-concept-reference-v1.png`
- `character-assets/reference/guest-foundation-sprite-reference-v1.png`

구현은 스프라이트 기준 이미지를 그대로 축소하지 않는다. 기준 이미지의 둥근 얼굴, 중앙 얼굴을 가리지 않는 헤어, 단정한 포멀 의상, 사람다운 어깨/팔/손/다리 비율을 `96x144` 완성 하객 프리셋 시스템에 맞게 재해석한다.

하객 재작업은 항상 완성 프리셋의 정면 얼굴과 몸 비율부터 검토한다. 얼굴, 헤어, 의상, 액세서리를 분리 검토하지 않고 하나의 완성 캐릭터로 평가한다.

## 하객 파츠 품질 패스 2 레거시 기록

아래 내용은 파츠 조합형 시스템을 유지하려던 시점의 품질 패스 기록이다. 현재 실행 기준은 `pnpm characters:author-guest-presets`와 `--mode=guest-presets`다.

```bash
pnpm characters:author-guests
pnpm characters:audit
pnpm characters:generate
pnpm characters:contact-sheet -- --mode=catalog --output=.superpowers/character-review/guest-art-quality-pass-2.png
```

추가 고정 규칙:

- base는 프레임 상단부터 하단까지 충분히 점유해야 한다. 작은 캐릭터를 중앙에 배치한 뒤 확대하는 방식은 실패로 본다.
- front-hair는 정수리, 앞머리, 옆머리만 담당한다. 얼굴 전체나 눈 라인을 덮어 하객이 무표정한 검은 덩어리처럼 보이면 안 된다.
- 헤어 스타일은 같은 모양의 색상 변형이 아니라 서로 다른 실루엣이어야 한다. 감사 도구의 alpha difference 실패는 실제 아트 품질 실패로 취급한다.
- 의상은 목선부터 신발/스커트 끝까지 이어지는 고유 실루엣을 가져야 한다. 재킷, 니트, 한복, 드레스, 슬랙스는 외곽선만 보아도 구분되어야 한다.
- 하객은 신랑/신부 NPC만큼 장식적일 필요는 없지만, 승인 커플 레퍼런스의 둥근 얼굴, 정돈된 헤어 결, 웨딩 하객 의상 레이어 언어를 따라야 한다.

## A안 로맨틱 포멀 하객 파츠 원형 레거시 기록

아래 내용은 파츠 조합형 하객 원형을 만들던 시점의 기록이다. 현재 하객 캐릭터는 이 방향을 참고하되, 최종 구현은 완성 프리셋 단위로 고정한다.

핵심 고정 규칙:

- 얼굴은 base가 책임진다. 헤어를 지운 틈으로 얼굴을 만드는 방식은 금지한다.
- 정면 얼굴은 눌린 삼각형이나 외계인형이 아니라, 둥글고 세로 공간이 있는 F1 얼굴이어야 한다.
- 눈은 작고 분리된 픽셀로 유지한다. 큰 검은 눈덩이, 마스크형 눈, 눈 밑 검은 줄은 금지한다.
- 코, 입, 볼은 작은 포인트로만 표현한다. 입/턱선이 과한 V자로 내려오면 얼굴이 짜부되거나 날카롭게 보이므로 실패로 본다.
- 귀는 얼굴보다 과하게 커지면 안 된다. 남성 짧은 헤어에서도 사람 귀 크기로 읽혀야 한다.
- front-hair는 눈/코/입 중앙 보호 영역을 침범하지 않는다. 감사 기준은 `x=37`, `y=31`, `width=22`, `height=15`, `maximumOpaquePixels=16`이다. 이마와 눈썹 위 앞머리는 허용한다.
- 헤어는 정수리 볼륨, 앞머리 방향, 사이드락/뒤머리 길이로 스타일 차이를 만든다. 얼굴 중앙을 가려서 스타일 차이를 만들지 않는다.
- 몸은 막대팔과 사각 몸통이 아니라, 어깨에서 허리로 줄어드는 몸통, 약한 곡선의 팔, 작은 손으로 읽혀야 한다.
- 의상은 포멀 하객 복장으로 읽혀야 한다. 수트는 라펠/셔츠/타이/바지선, 드레스는 목선/허리선/치맛단, 한복은 저고리 여밈과 하의 폭이 구분되어야 한다.

이번 원형을 검토할 때 사용하는 리뷰 산출물:

- `.superpowers/character-review/romantic-formal-guest-feminine-4x.png`
- `.superpowers/character-review/romantic-formal-guest-masculine-4x.png`
- `.superpowers/character-review/romantic-formal-guest-alt-4x.png`
- `.superpowers/character-review/romantic-formal-guest-contact-sheet.png`

회귀 방지 검증:

```bash
pnpm characters:author-guests
pnpm characters:audit
pnpm characters:generate
pnpm characters:contact-sheet -- --mode=catalog --output=.superpowers/character-review/romantic-formal-guest-contact-sheet.png
```

```bash
pnpm characters:contact-sheet -- --mode=catalog --output=.superpowers/character-review/guest-art-review.png
pnpm characters:audit
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
```

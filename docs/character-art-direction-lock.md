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
- `character-assets/reference/guest-foundation-unified-reference-v1.png`
- `character-assets/reference/guest-foundation-unified-proportion-guide-v1.png`
- `character-assets/source/guests/*`
- `client/public/characters/generated/guests/*`
- `.superpowers/character-review/guest-preset-contact-sheet.png`

고정 규칙:

- 사용자는 헤어, 의상, 액세서리를 따로 조합하지 않는다.
- 현재 런타임 하객 프리셋은 단일 통합 기준 이미지에서 나온 12명을 사용한다.
- 각 하객은 얼굴, 헤어, 의상, 액세서리가 함께 설계된 완성 스프라이트다.
- `scripts/author-guest-preset-sources.mjs`는 단순 도형이나 새 procedural 캐릭터를 그리지 않는다. 기준 이미지 crop을 배경 투명화한 뒤 `96x144` 프레임으로 정렬한다.
- 12명은 서로 다른 기준 이미지를 섞지 않는다. 머리 크기와 몸 비율이 흔들리면 실패로 본다.
- 얼굴이 외계인처럼 보이거나 눌려 보이는 프리셋은 실패로 본다.
- 머리카락이 얼굴 중앙을 큰 검은 마스크처럼 덮으면 실패로 본다.
- 기준 이미지의 둥근 얼굴, 작고 분리된 눈, 작은 입, 웨딩 하객 포멀 의상 톤을 유지한다.
- 하객 프리셋을 추가 확장하려면 먼저 같은 품질의 새 기준 이미지를 확정하고, 카탈로그에 `reference.image`와 `reference.crop`을 추가한다.
- 기존 `guest-part-manifest.json`과 `base`, `hair`, `outfits`, `accessories` 소스는 레거시 자료였으며 현재 저장소에서 제거했다.

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

## 삭제된 하객 파츠 조합형 레거시

2026-06-24 이전의 `guest-part-manifest.json`, `shared/src/guestPartManifest.ts`, `character-assets/source/base`, `hair`, `outfits`, `accessories` 기반 조합형 시스템은 제거했다.

현재 하객 런타임 기준은 완성 캐릭터 프리셋 12명이다. 하객 추가 확장은 새 기준 이미지와 `guest-character-presets.json`의 `reference.crop`을 통해서만 진행한다.

## 하객 기초 기준 이미지 고정

하객 캐릭터 재작업의 기준은 다음 파일로 고정한다.

- `character-assets/reference/guest-foundation-unified-reference-v1.png`
- `character-assets/reference/guest-foundation-unified-proportion-guide-v1.png`

현재 구현은 단일 통합 기준 이미지의 12명 crop을 직접 사용한다. crop은 배경을 투명화한 뒤 `96x144` 완성 하객 프리셋 프레임에 맞춰 정렬한다. 이 방식은 서로 다른 기준 이미지가 섞여 캐릭터별 머리 크기와 몸 비율이 흔들리는 문제를 막기 위한 고정 규칙이다.

`guest-foundation-unified-proportion-guide-v1.png`는 비율 검수용 파일이다. 하객 기준 이미지를 교체할 때는 이 파일처럼 4x3 슬롯, 동일 머리 크기, 동일 발 기준선, 동일 정면 idle 포즈를 먼저 확인한다.

하객 재작업은 항상 완성 프리셋의 정면 얼굴과 몸 비율부터 검토한다. 얼굴, 헤어, 의상, 액세서리를 분리 검토하지 않고 하나의 완성 캐릭터로 평가한다.

## 삭제된 하객 파츠 조합형 기록

과거 `base`, `hair`, `outfits`, `accessories`를 조합하던 품질 패스와 A안 원형은 현재 실행 기준이 아니다. 해당 기록은 git 히스토리에서만 확인하고, 새 하객 작업은 완성 프리셋 기준 이미지와 `guest-character-presets.json`만 기준으로 진행한다.

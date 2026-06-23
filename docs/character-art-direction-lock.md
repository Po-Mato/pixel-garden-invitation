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

## 하객 캐릭터 파츠 고정

하객 캐릭터도 승인된 신랑/신부 아트 방향을 따른다. 단, 하객은 교체 가능한 파츠 시스템으로 관리하며 소스 프레임은 `96x144`, 정원 표시 크기는 `48x72`, 커스터마이저 미리보기는 `96x144`로 고정한다.

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

향후 하객 파츠를 변경할 때는 `guest-part-manifest.json`과 `shared/src/guestPartManifest.test.ts` 계약을 유지하고, 실제 크기와 확대 컨택트 시트를 모두 검토한다.

```bash
pnpm characters:contact-sheet -- --mode=catalog --output=.superpowers/character-review/guest-art-review.png
pnpm characters:audit
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
```

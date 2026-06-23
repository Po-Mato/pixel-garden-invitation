# 고밀도 하객 파츠 시스템 설계

작성일: 2026-06-23  
프로젝트 루트: `/Users/sjlee/Documents/New project 5`  
상태: A안 확정, 작성된 설계 검토 후 구현 예정

## 목표

현재 저밀도 하객 캐릭터 에셋을 고밀도 교체형 파츠 시스템으로 전환한다.

이번 설계는 두 가지 문제를 동시에 해결한다.

1. 현재 하객 아트는 기술 검증은 통과해도 실제 미감 기준으로는 부족하다.
2. 커스터마이저는 레이어 합성을 하고 있지만, “몸을 제외한 헤어/의상/악세사리 파츠 라이브러리”로 명확하게 관리되는 구조가 부족하다.

새 시스템은 몸/base와 나머지 스타일 파츠를 명확히 분리한다.

- 기본 몸: 패밀리, 피부색, 얼굴, 손, 발, 기준 앵커.
- 헤어: 뒤 헤어와 앞 헤어로 분리되는 교체형 파츠.
- 의상: 독립 교체형 의상 파츠.
- 악세사리: 얼굴, 주얼리, 넥웨어, 소지품, 뒤쪽 악세사리 파츠.

## 고정 방향

- 하객 캐릭터 소스 프레임을 기존 `48x72`에서 `96x144` 고밀도 프레임으로 올린다.
- 정원 화면에서 보이는 크기는 맵 밸런스를 해치지 않도록 CSS 표시 크기로 제어한다.
- 승인된 신랑/신부 아트가 최상위 품질 기준이다.
- 하객은 신랑/신부 아트 방향의 최소 85% 품질을 목표로 한다.
- 직전에 만든 `48x72` 하객 보정 PNG는 품질 기준이 아니다. 다음 구현에서 대체할 대상이다.
- 런타임 코드는 조합, 검증, 팔레트 확장, 표시만 담당한다. 최종 캐릭터 형상은 런타임에서 절차적으로 그리지 않는다.
- 몸/base는 family와 skin tone으로 선택 가능하지만, 몸을 제외한 외형 스타일은 모두 교체형 파츠 에셋에서 온다.

## 근본 원인

하객 퀄리티가 낮은 근본 원인은 `48x72` 격자 안에서 아트 밀도 문제를 해결하려고 한 것이다.

`48x72`에서는 다음 문제가 반복된다.

- 얼굴 디테일이 어두운 마스크처럼 뭉개진다.
- 헤어 실루엣이 덩어리처럼 보이거나 머리만 커 보인다.
- 수트/드레스의 소재 디테일이 실제 정원 크기에서 살아남지 못한다.
- 악세사리가 너무 작아 읽히지 않는다.
- 자동 검증은 크기, 투명도, 실루엣 차이를 볼 수 있지만 “예쁘고 고급스러운가”를 보장하지 못한다.

신랑/신부는 `96x144` 고밀도 NPC 프레임으로 올린 뒤 품질이 살아났다. 하객도 같은 밀도 전략이 필요하다. 단, 신랑/신부처럼 단일 완성 NPC가 아니라 base 위에 파츠를 조립하는 구조여야 한다.

## 에셋 모델

### 프레임 규격

하객 소스 파츠 규격은 다음과 같다.

- 걷기 소스 시트: `288x576`, `96x144` 프레임 3열 × 4행.
- 필요한 경우 idle 소스 시트: `192x144`, `96x144` 정면 프레임 2개.
- 방향 순서: down, left, right, up.
- 걷기 열 순서: step 0, neutral, step 2.
- 투명 PNG.
- 선명한 픽셀 경계 유지.
- 안티앨리어싱과 blur 금지.

생성 파일은 기존처럼 아래 경로에 결정적으로 생성한다.

```text
client/public/characters/generated/
```

하객 생성 결과물은 고밀도 `96x144`를 유지하고, 렌더러가 CSS 표시 크기를 제어하는 방식을 기본으로 한다.

nearest-neighbor 방식의 축소는 시각 QA를 통과할 때만 예외적으로 허용한다.

### 파츠 그룹

관리되는 하객 파츠 라이브러리는 다음 그룹으로 구성한다.

| 그룹 | 역할 | 소스 경로 | 팔레트 확장 |
| --- | --- | --- | --- |
| `base` | 몸, 피부, 얼굴, 손, 발, 기준 앵커 | `character-assets/source/base` | 피부 팔레트 |
| `hair-back` | 몸/의상 뒤에 깔리는 헤어 | `character-assets/source/hair` | 헤어 팔레트 |
| `hair-front` | 얼굴/몸 위에 올라오는 헤어 | `character-assets/source/hair` | 헤어 팔레트 |
| `outfit` | 의상과 필요한 경우 신발 | `character-assets/source/outfits` | 의상 팔레트 |
| `accessory-face` | 안경 등 얼굴 오버레이 | `character-assets/source/accessories` | 고정 색상 |
| `accessory-jewelry` | 귀걸이, 목걸이 | `character-assets/source/accessories` | 고정 색상 |
| `accessory-neckwear` | 넥타이, 보타이, 브로치 | `character-assets/source/accessories` | 고정 색상 |
| `accessory-carry` | 핸드백 등 손에 드는 아이템 | `character-assets/source/accessories` | 고정 색상 |
| `accessory-back` | 숄더백 등 뒤쪽 악세사리 | `character-assets/source/accessories` | 고정 색상 |

사용자에게 노출되는 선택 ID는 계속 `shared/character-catalog.json`이 담당한다.

하지만 에셋 관리는 별도 매니페스트로 명확히 분리한다.

```text
character-assets/guest-part-manifest.json
```

매니페스트는 다음 정보를 가진다.

- 프레임 크기.
- 각 카탈로그 ID의 소스 파일.
- 생성 파일 패턴.
- 레이어 슬롯.
- 호환성 규칙.
- 품질 lock 메타데이터.
- 표시 크기 규칙.

## 레이어 조합 순서

뒤에서 앞으로 다음 순서를 고정한다.

1. `back-accessory`
2. `back-hair`
3. `base`
4. `outfit`
5. `front-hair`
6. `face`
7. `jewelry`
8. `neckwear`
9. `carry`

렌더러는 카탈로그 ID만 보고 URL을 하드코딩하지 않는다.

반드시 `guest-part-manifest.json`을 통해 선택된 appearance를 실제 파츠 에셋 레이어로 해석한다.

이렇게 해야 헤어, 의상, 악세사리 파츠를 독립적으로 교체하고 감사할 수 있다.

## 커스터마이저 동작

사용자가 보는 카테고리는 유지한다.

- 기본: family, skin tone.
- 헤어: hair style.
- 헤어 색: hair palette.
- 의상: outfit.
- 의상 색: outfit palette.
- 액세서리: face, jewelry, neckwear, carry.

내부 구현은 파츠 라이브러리 기반으로 바꾼다.

각 옵션 타일은 상징 아이콘이 아니라 실제 고밀도 조합 preview를 렌더링해야 한다.

family 변경 시:

- 몸/base는 선택된 family 기본값으로 변경된다.
- 호환되지 않는 hair/outfit ID는 reset된다.
- 악세사리는 선언된 슬롯/레이어와 호환될 때만 유지된다.

몸 이외 파츠 변경 시:

- 해당 파츠만 변경된다.
- 몸/base는 유지된다.
- 호환성 문제가 없으면 다른 파츠 선택은 유지된다.

## 아트 요구사항

하객 파츠는 승인된 신랑/신부 방향을 따른다.

- 예쁘고 멋진 결혼식 하객으로 보여야 한다.
- 사람처럼 읽혀야 하며 외계인/마스크 얼굴 금지.
- 얼굴 윤곽, 눈, 코, 입, 블러시가 정제되어야 한다.
- 헤어는 덩어리가 아니라 strand cluster와 highlight가 있어야 한다.
- 의상은 소재가 구분되어야 한다: satin, wool, silk, lace, knit, leather, metal.
- 실제 모바일 정원 크기에서도 실루엣이 읽혀야 한다.
- 사각형 머리 금지.
- 서로 다른 헤어스타일/의상 ID가 단순 색 변경만으로 구분되면 안 된다.
- 신부 전용 train/gown/bouquet 구성은 하객 의상에 복사하지 않는다.
- 신랑 전용 boutonniere/tuxedo 처리는 하객 의상에 복사하지 않는다.

base body는 모든 의상과 조합 가능해야 하므로 과하게 튀면 안 된다.

하지만 base body도 저퀄이면 안 된다. 얼굴과 비율의 품질 기준을 base가 책임진다.

## 카탈로그 범위

이번 작업에서 선택지 개수는 유지한다.

- family 2개.
- skin tone 5개.
- hairstyle 16개.
- hair color 6개.
- outfit 10개.
- outfit palette는 outfit당 4개.
- accessory 10개.

새 카테고리를 추가하지 않는다.

이번 작업은 카탈로그 확장이 아니라 품질과 구조 업그레이드다.

## 툴링 변경

### 생성기

`scripts/generate-character-assets.mjs`는 하객 `96x144` 파츠 규격을 지원해야 한다.

신랑/신부 NPC의 기존 `96x144` 처리는 유지한다.

필수 상수:

- guest frame: `96x144`
- guest idle sheet: `192x144`
- guest walk sheet: `288x576`
- couple NPC frame: 기존 `96x144` 유지

기존 하객 `48x72` 전제는 생성기, 렌더러, 테스트에서 제거한다.

### 감사

에셋 감사는 다음을 검증해야 한다.

- 모든 카탈로그 ID가 매니페스트 항목을 가진다.
- 모든 매니페스트 항목이 소스 파일을 가진다.
- 소스 크기가 고밀도 규격과 일치한다.
- 생성 결과물 크기가 고밀도 규격과 일치한다.
- 각 레이어가 허용된 marker/fixed color만 사용한다.
- base/body의 발 기준선이 안정적이다.
- family 내 각 hairstyle은 구분되는 실루엣을 가진다.
- family 내 각 outfit은 구분되는 실루엣을 가진다.
- front-hair는 얼굴이 읽히는 얼굴 노출 영역을 남긴다.
- accessory의 비어 있지 않은 프레임은 몸 기준 앵커와 정렬된다.
- 생성된 하객 결과물 개수가 카탈로그에서 계산되는 기대값과 일치한다.

### 컨택트 시트

컨택트 시트는 다음을 포함해야 한다.

- canonical dark-brown palette 기준 모든 hair style.
- 대표 style 기준 모든 hair color.
- 모든 outfit과 palette.
- slot별 모든 accessory.
- 대표 full composed guest 조합.
- 실제 표시 크기 샘플.
- nearest-neighbor 확대 샘플.

review sheet만 봐도 파츠가 독립적으로 교체되고 정렬되는지 확인 가능해야 한다.

## 렌더러 변경

`CharacterSprite`는 dimension-aware renderer로 바뀐다.

- 하객 프레임 너비/높이는 매니페스트 메타데이터에서 읽는다.
- CSS 변수로 소스 프레임 크기와 표시 크기를 지정한다.
- 걷기 프레임 offset은 소스 프레임 크기 기준으로 계산한다.
- idle 프레임 offset도 idle 소스 프레임 크기 기준으로 계산한다.
- 레이어 로드 실패 시 실패한 레이어만 숨기고 전체 캐릭터는 유지한다.

정원 표시 목표:

- 하객은 현재 정원 내 표시 면적과 시각적으로 비슷해야 한다.
- 정확한 CSS 표시 크기는 구현 중 모바일 QA 후 확정한다.
- 소스 픽셀은 고밀도를 유지한다.

커스터마이저 preview 목표:

- 정원 표시보다 크게 보여준다.
- nearest-neighbor scaling만 사용한다.
- blur 금지.

## 데이터 흐름

1. `shared/character-catalog.json`이 선택 가능한 ID와 호환성을 정의한다.
2. `character-assets/guest-part-manifest.json`이 ID를 소스/생성 에셋과 레이어 슬롯으로 매핑한다.
3. 생성기가 카탈로그, 팔레트, 매니페스트를 읽는다.
4. 생성기가 결정적인 생성 PNG를 만든다.
5. 클라이언트가 선택된 `CharacterAppearance`를 매니페스트를 통해 레이어로 해석한다.
6. `CharacterSprite`가 고밀도 레이어들을 렌더링한다.
7. 실시간 payload는 그대로 유지한다. `CharacterAppearance` ID가 바뀌지 않기 때문이다.

## 테스트 전략

구현은 test-first로 진행한다.

구현 전에 먼저 실패해야 하는 RED 테스트:

- 생성기가 기존 `144x288` 하객 소스 시트를 거부한다.
- 생성기가 `288x576` 하객 walk sheet와 `192x144` 하객 idle sheet를 허용한다.
- 매니페스트가 모든 body, hair, outfit, accessory ID를 포함해야 한다.
- `resolveCharacterLayers`가 하드코딩된 경로가 아니라 매니페스트 메타데이터로 레이어를 해석해야 한다.
- `getWalkFrameStyle`이 설정 가능한 `96x144` 프레임 크기를 지원해야 한다.
- `CharacterSprite`가 하객 프레임/표시 크기 CSS 변수를 렌더링해야 한다.
- 컨택트 시트가 `96x144` 하객 프레임을 해석해야 한다.
- 감사는 서로 다른 hairstyle/outfit이 실루엣을 공유하면 실패해야 한다.

최종 검증:

```bash
pnpm characters:audit
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
```

브라우저 검증:

- desktop 커스터마이저.
- `390px` mobile 커스터마이저.
- 정원 입장 흐름.
- 네 방향 이동.
- accessory 슬롯 변경.
- 신랑/신부 NPC crisp 유지.
- horizontal overflow 없음.
- console error/warn 없음.
- 새로고침 후 생성된 하객 appearance 유지.

## 마이그레이션 계획

1. 기존 저밀도 하객 에셋이 남아 있는 상태에서 매니페스트와 테스트를 먼저 추가한다.
2. 생성기, 감사, 컨택트 시트 툴링을 고밀도 하객 파츠 규격으로 수정한다.
3. 클라이언트 프레임 계산, 레이어 해석, sprite CSS를 설정 가능한 dimension 기반으로 수정한다.
4. guest base body 소스 에셋을 교체한다.
5. 모든 hair 소스 에셋을 교체한다.
6. 모든 outfit 소스 에셋을 교체한다.
7. 모든 accessory 소스 에셋을 교체한다.
8. 생성 에셋과 컨택트 시트를 다시 만든다.
9. 전체 자동 검증과 브라우저 QA를 실행한다.
10. 거부된 저밀도 하객 소스 전제를 제거하거나 격리한다.

## 범위 제외

- 카탈로그 개수 추가.
- 실시간 프로토콜 필드 추가.
- 기존 idle/walk 외 animation state 추가.
- map layout 또는 collision rule 변경.
- 승인된 신랑/신부 reference 교체.
- 런타임에서 최종 art를 절차적으로 그리는 방식.
- 런타임 AI 생성.

## 완료 기준

다음을 모두 만족해야 완료로 본다.

- 하객이 실제 모바일 표시 크기에서 저렴하거나 외계인 같거나 blocky하게 보이지 않는다.
- 헤어, 의상, 악세사리가 명시적인 교체형 파츠 에셋으로 관리된다.
- 몸/base는 유지하면서 몸 외 파츠만 독립 변경할 수 있다.
- 모든 선택 가능한 카탈로그 ID가 매니페스트를 통해 해석된다.
- 고밀도 생성 파츠가 커스터마이저와 정원에서 정상 렌더링된다.
- 컨택트 시트에서 before/after 품질 차이가 명확하다.
- 자동 테스트, typecheck, build, browser QA가 모두 통과한다.

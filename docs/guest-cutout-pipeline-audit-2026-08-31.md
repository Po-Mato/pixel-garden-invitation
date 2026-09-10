# 하객 캐릭터 제작 파이프라인 감사

감사일: 2026-08-31  
범위: 하객 12명, 신랑·신부 퍼펫, 선택 화면·게임 화면 소비 경로  
상태: 파일럿 전 읽기 전용 감사 기록. 이후 사용자 승인에 따라 컷아웃 파이프라인으로 전환됨.

## 감사 당시 전체 흐름

1. `character-assets/reference/guest-foundation-unified-reference-v1.png`의 12명 기준 이미지와
   `guest-directions/*`의 방향 PNG가 캐릭터 정체성 기준이다.
2. 여러 세대의 프레임별 AI 원화가 `guest-flat-walk-sources`,
   `guest-depth-walk-sources`, `guest-unified-rig-sources`에 누적되어 있다.
3. 현재 우선 입력은 `character-assets/reference/guest-unified-rig-sources/v10`의
   3열×4행 PNG다. 열은 보행 A·중립·보행 B이고 행은 정면·왼쪽·오른쪽·뒷면이다.
4. `scripts/build-guest-selection-preview-assets.mjs`가 세 프레임을 4프레임으로 확장하고
   머리·몸통·어깨·하체·발 픽셀을 프레임별로 보정한다.
5. 고해상도 중간 산출물은 `character-assets/source/guests-preview`에, 96×144 런타임
   원본은 `character-assets/source/guests`에 저장된다.
6. `scripts/generate-character-assets.mjs`가 이 소스를
   `client/public/characters/generated/guests`로 복사하고, 호환용 48×72 축소 시트와
   초상 PNG도 만든다.
7. 선택 화면은 `guests/preview/*` 고해상도 시트를 96×144로 표시하고, 게임은
   `guests/*`의 96×144 프레임을 48×72로 표시한다. `guests/world/*`는 생성되지만
   현재 캐릭터 렌더링 경로에서는 사용하지 않는다.

## 신랑·신부 퍼펫 구조

`scripts/build-couple-puppet-assets.mjs`는 승인 원본에서 머리와 몸을 잘라 512×768
캔버스의 다음 레이어를 만든다.

- `body`
- `head-open`
- `head-blink`
- `preview`

리그는 `root`와 `head` 두 관절만 가진 전면 초상 퍼펫이다. 호흡·머리 기울기·눈 깜빡임
기준은 제공하지만, 팔·다리 보행 관절이 없으므로 하객 전신 보행 리그로 그대로 재사용할
수는 없다. 승인된 커플의 컴팩트한 비율, 절제된 명암, 포멀 의상 디테일은 시각 기준으로
사용한다.

## 프레임 PNG 후처리 목록

감사 당시 `scripts/build-guest-selection-preview-assets.mjs`에는 다음 처리가 있었다.

- 머리와 몸을 분리해 서로 다른 세로 비율로 변형
- 머리 밴드와 얼굴 폭을 프레임별로 가로 변형
- 한쪽 프로필 머리 상단 밴드를 반전해 다른 쪽에 복사
- 1번 하객의 상체·가방 밴드를 기준 프레임에서 다른 프레임으로 복사
- 1번 하객의 하체·발 밴드를 기준 프레임에서 교체
- 약한 보행 차이를 만들기 위한 하체·발 픽셀 명암 조작
- 정면·뒷면 보행 차이가 작을 때 반전한 첫 프레임의 하체를 3번 프레임에 복사
- 3번 하객의 정장 하체 픽셀 명암 조작
- 1번을 제외한 오른쪽 방향 전체를 왼쪽 방향의 반전으로 교체
- 런타임에서 프레임별 상체 중심을 맞추기 위한 가로 픽셀 이동

`client/src/styles.css`에도 완성 프레임을 클립해 복제하고 1~2px 옮기는 의상별 보조
모션이 있었다.

## 자산 위치와 규격

| 구분 | 위치 | 규격/역할 |
|---|---|---|
| 통합 캐릭터 기준 | `character-assets/reference/guest-foundation-unified-reference-v1.png` | 12명 정체성·복장 기준 |
| 방향 원본 | `character-assets/reference/guest-directions/*` | 방향별 완성 PNG |
| AI/보행 중간 원본 | `character-assets/reference/guest-*-walk-sources/*` | 여러 세대의 프레임 시트 |
| 현재 우선 입력 | `character-assets/reference/guest-unified-rig-sources/v10` | 1086×1448, 3열×4행 |
| 선택 고해상도 소스 | `character-assets/source/guests-preview` | 프레임 192×288, 시트 768×1152 |
| 게임 고밀도 소스 | `character-assets/source/guests` | 프레임 96×144, 시트 384×576 |
| 공개 생성물 | `client/public/characters/generated/guests` | 빌드 시 자동 복사·축소 |
| 선택 화면 실제 표시 | `CharacterCustomizer`의 `preview` | 96×144 |
| 선택 목록 실제 표시 | `thumbnail` | 논리 48×72, 현재 카드에서 추가 축소 |
| 게임 실제 표시 | `world` | 48×72 |

## 좌우 반전 위험 캐릭터

현재 v10 생성기는 오른쪽 행을 왼쪽 행의 정확한 반전으로 강제한다. 반면 기존 실제
방향 원본의 오른쪽과 왼쪽 반전본은 캐릭터별로 11.12~15.51% 채널 차이가 있다.
따라서 12명 모두 반전 위험 대상이다.

| 번호 | 프리셋 | 잘못될 수 있는 비대칭 요소 |
|---:|---|---|
| 01 | 크림 롱 웨이브 원피스 | 가르마, 오른손 가방, 허리끈 |
| 02 | 로즈 여성 한복 | 가르마·화관, 저고리 여밈, 고름·노리개 |
| 03 | 네이비 클래식 수트 | 왼쪽 가슴 포켓 스퀘어, 가르마, 라펠 겹침 |
| 04 | 차콜 클래식 수트 | 포켓 스퀘어, 가르마, 라펠 겹침 |
| 05 | 세이지 리본 원피스 | 가르마, 리본 매듭, 손가방 |
| 06 | 샴페인 블라우스 스커트 | 가르마, 목 리본, 한쪽 손가방 |
| 07 | 라벤더 쉬폰 원피스 | 가르마, 한쪽 클러치, 소매·드레스 장식 |
| 08 | 더스티 로즈 랩 원피스 | 가르마, 랩 여밈과 허리끈 방향 |
| 09 | 베이지 썸머 수트 | 가르마, 포켓 스퀘어, 라펠 겹침 |
| 10 | 네이비 포멀 원피스 | 가르마, 랩 여밈, 한쪽 클러치 |
| 11 | 그린 블레이저 크림 팬츠 | 가르마, 포켓 스퀘어, 라펠 겹침 |
| 12 | 블루 모던 한복 | 가르마, 깃 여밈, 허리끈·노리개 |

## 의상 유형 분류

- 정장·바지형: 03, 04, 09, 11
- 원피스형: 01, 05, 07, 08, 10
- 스커트형: 06
- 여성 한복형: 02
- 남성 한복형: 12
- 가방·큰 액세서리형: 01, 05, 06, 07, 10

## 결론

감사 당시 파이프라인은 완성 프레임을 원본으로 삼기 때문에 비율·보행·방향 문제를 발견할수록
픽셀 보정이 누적되는 구조였다. 새 파이프라인은 편집 가능한 방향별 벡터 파츠와 공용 골격을
원본으로 삼고, PNG는 언제나 자동 렌더링해야 한다는 결론을 냈다.

## 승인 후 정리 결과

- `scripts/build-guest-selection-preview-assets.mjs`와 그 픽셀 보정 전용 테스트를 제거했다.
- CSS의 의상·머리 클립 복사와 프레임별 `translateX` 처리를 제거했다.
- 하객 공개 PNG 소비 경로를 `character-assets/generated/cutout-v1`로 전환했다.
- 기존 `character-assets/source/guests*`는 런타임 입력에서 제외했으며 참고용으로만 남겼다.
- 실제 운영 배포는 전체 UI 검수와 최종 사용자 승인 전까지 수행하지 않는다.

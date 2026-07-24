# 3D 마스터 기반 캐릭터 제작과 Live2D 적용 기준

## 목표

- 게임 속 보행 캐릭터는 캐릭터별 3D 마스터를 기준으로 네 방향과 세 보행 자세를 만든다.
- 게임 실행 중에는 3D 엔진을 불러오지 않고 미리 렌더한 2D 스프라이트를 사용한다.
- Live2D는 입장 화면, 신랑·신부 소개, NPC 대화처럼 표정과 호흡이 중요한 가까운 화면에만 사용한다.
- 모든 결과는 큰 머리 1, 턱 아래 몸 2의 컴팩트한 3등신과 같은 바닥선을 유지한다.

## 제작 흐름

1. 네 방향 턴어라운드로 얼굴, 머리카락, 의상, 액세서리를 확정한다.
2. Blender 마스터에서 네 방향과 보행 세 자세를 렌더해 포즈 기준을 만든다.
3. 포즈 기준과 턴어라운드를 함께 사용해 고품질 3D 툰 렌더 시트를 만든다.
4. 배경을 투명하게 만들고 각 방향을 3컷으로 분리한다.
5. 모든 컷을 `96x144` 프레임, 캐릭터 높이 `126px`, 발끝 기준선 `132px`로 정규화한다.
6. `288x576` 보행 시트와 `192x144` 대기 시트를 만든다.
7. 기준선 리뷰, 투명도 검사, 녹색 잔여 픽셀 검사, 기존 이미지 비교를 통과한 결과만 앱에 적용한다.

## 캐릭터별 파일

- 턴어라운드: `character-assets/reference/guest-3d-master-sources/v1/guest-01/guest-01-turnaround-concept.png`
- 3D 마스터: `character-assets/reference/guest-3d-master-sources/v1/guest-01/blender/guest-01-master.blend`
- 교환용 모델: `character-assets/reference/guest-3d-master-sources/v1/guest-01/blender/guest-01-master.glb`
- 방향·보행 렌더: `character-assets/reference/guest-3d-master-sources/v1/guest-01/walk-renders`
- 앱 적용 후보와 감사 결과: `character-assets/reference/guest-3d-master-sources/v1/guest-01/pilot`

`guest-02`도 같은 구조를 사용하며, 여성 한복 프리셋과 Live2D 리깅 계획은 다음 경로에 있다.

- 턴어라운드: `character-assets/reference/guest-3d-master-sources/v1/guest-02/guest-02-turnaround-concept.png`
- 3D 마스터: `character-assets/reference/guest-3d-master-sources/v1/guest-02/blender/guest-02-master.blend`
- 앱 적용 후보와 감사 결과: `character-assets/reference/guest-3d-master-sources/v1/guest-02/pilot`
- Live2D 계획: `character-assets/live2d/guest-02/model-plan.json`

`guest-03`은 남성 네이비 정장 프리셋으로 같은 구조와 검증 기준을 사용한다.

- 턴어라운드: `character-assets/reference/guest-3d-master-sources/v1/guest-03/guest-03-turnaround-concept.png`
- 3D 마스터: `character-assets/reference/guest-3d-master-sources/v1/guest-03/blender/guest-03-master.blend`
- 앱 적용 후보와 감사 결과: `character-assets/reference/guest-3d-master-sources/v1/guest-03/pilot`
- Live2D 계획: `character-assets/live2d/guest-03/model-plan.json`

`guest-04`는 갈색 웨이브 헤어와 차콜 블레이저 프리셋으로 같은 구조와 검증 기준을 사용한다.

- 턴어라운드: `character-assets/reference/guest-3d-master-sources/v1/guest-04/guest-04-turnaround-concept.png`
- 3D 마스터: `character-assets/reference/guest-3d-master-sources/v1/guest-04/blender/guest-04-master.blend`
- 앱 적용 후보와 감사 결과: `character-assets/reference/guest-3d-master-sources/v1/guest-04/pilot`
- Live2D 계획: `character-assets/live2d/guest-04/model-plan.json`

`guest-05`는 갈색 로우 번 헤어, 아이보리 볼레로, 세이지 리본 원피스 프리셋으로 같은 구조와 검증 기준을 사용한다.

- 턴어라운드: `character-assets/reference/guest-3d-master-sources/v1/guest-05/guest-05-turnaround-concept.png`
- 3D 마스터: `character-assets/reference/guest-3d-master-sources/v1/guest-05/blender/guest-05-master.blend`
- 앱 적용 후보와 감사 결과: `character-assets/reference/guest-3d-master-sources/v1/guest-05/pilot`
- Live2D 계획: `character-assets/live2d/guest-05/model-plan.json`

`guest-06`은 반묶음 브레이드가 있는 긴 갈색 웨이브 헤어, 샴페인 리본 블라우스, 네이비 플레어 스커트, 왼쪽 체인 숄더백 프리셋으로 같은 구조와 검증 기준을 사용한다.

- 턴어라운드: `character-assets/reference/guest-3d-master-sources/v1/guest-06/guest-06-turnaround-concept.png`
- 3D 마스터: `character-assets/reference/guest-3d-master-sources/v1/guest-06/blender/guest-06-master.blend`
- 앱 적용 후보와 감사 결과: `character-assets/reference/guest-3d-master-sources/v1/guest-06/pilot`
- Live2D 계획: `character-assets/live2d/guest-06/model-plan.json`

`guest-07`은 반묶음 브레이드가 있는 긴 갈색 웨이브 헤어, 흰색 크롭 볼레로, 라벤더 쉬폰 드레스, 오른손 은색 클러치 프리셋으로 같은 구조와 검증 기준을 사용한다.

- 턴어라운드: `character-assets/reference/guest-3d-master-sources/v1/guest-07/guest-07-turnaround-concept.png`
- 3D 마스터: `character-assets/reference/guest-3d-master-sources/v1/guest-07/blender/guest-07-master.blend`
- 앱 적용 후보와 감사 결과: `character-assets/reference/guest-3d-master-sources/v1/guest-07/pilot`
- Live2D 계획: `character-assets/live2d/guest-07/model-plan.json`

`guest-08`은 긴 볼륨 갈색 웨이브 헤어, 더스티 로즈 랩 원피스, 왼손 토프 핸드백 프리셋으로 같은 구조와 검증 기준을 사용한다.

- 턴어라운드: `character-assets/reference/guest-3d-master-sources/v1/guest-08/guest-08-turnaround-concept.png`
- 3D 마스터: `character-assets/reference/guest-3d-master-sources/v1/guest-08/blender/guest-08-master.blend`
- 앱 적용 후보와 감사 결과: `character-assets/reference/guest-3d-master-sources/v1/guest-08/pilot`
- Live2D 계획: `character-assets/live2d/guest-08/model-plan.json`

`guest-09`는 짙은 브라운 가르마 헤어, 베이지 썸머 수트, 흰색 오픈칼라 셔츠, 왼쪽 라펠 흰 부토니에 프리셋으로 같은 구조와 검증 기준을 사용한다.

- 턴어라운드: `character-assets/reference/guest-3d-master-sources/v1/guest-09/guest-09-turnaround-concept.png`
- 3D 마스터: `character-assets/reference/guest-3d-master-sources/v1/guest-09/blender/guest-09-master.blend`
- 앱 적용 후보와 감사 결과: `character-assets/reference/guest-3d-master-sources/v1/guest-09/pilot`
- Live2D 계획: `character-assets/live2d/guest-09/model-plan.json`

`guest-10`은 검은 쇼트 보브, 네이비 랩 원피스, 은색 허리 브로치, 오른손 검은 클러치 프리셋으로 같은 구조와 검증 기준을 사용한다.

- 턴어라운드: `character-assets/reference/guest-3d-master-sources/v1/guest-10/guest-10-turnaround-concept.png`
- 3D 마스터: `character-assets/reference/guest-3d-master-sources/v1/guest-10/blender/guest-10-master.blend`
- 앱 적용 후보와 감사 결과: `character-assets/reference/guest-3d-master-sources/v1/guest-10/pilot`
- Live2D 계획: `character-assets/live2d/guest-10/model-plan.json`

재생성 명령:

```sh
blender --background --python scripts/blender/build_guest_3d_master.py -- --guest guest-02 --output-root character-assets/reference/guest-3d-master-sources/v1/guest-02/blender
node scripts/render-guest-3d-pose-guides.mjs --root character-assets/reference/guest-3d-master-sources/v1/guest-02/blender
node scripts/build-guest-3d-sprite-pilot.mjs --guest guest-02 --preset feminine-formal-hanbok

blender --background --python scripts/blender/build_guest_3d_master.py -- --guest guest-03 --output-root character-assets/reference/guest-3d-master-sources/v1/guest-03/blender
node scripts/render-guest-3d-pose-guides.mjs --root character-assets/reference/guest-3d-master-sources/v1/guest-03/blender
node scripts/build-guest-3d-sprite-pilot.mjs --guest guest-03 --preset masculine-navy-suit

blender --background --python scripts/blender/build_guest_3d_master.py -- --guest guest-04 --output-root character-assets/reference/guest-3d-master-sources/v1/guest-04/blender
node scripts/render-guest-3d-pose-guides.mjs --root character-assets/reference/guest-3d-master-sources/v1/guest-04/blender
node scripts/build-guest-3d-sprite-pilot.mjs --guest guest-04 --preset masculine-charcoal-blazer

blender --background --python scripts/blender/build_guest_3d_master.py -- --guest guest-05 --output-root character-assets/reference/guest-3d-master-sources/v1/guest-05/blender
node scripts/render-guest-3d-pose-guides.mjs --root character-assets/reference/guest-3d-master-sources/v1/guest-05/blender
node scripts/build-guest-3d-sprite-pilot.mjs --guest guest-05 --preset feminine-sage-bolero-dress

blender --background --python scripts/blender/build_guest_3d_master.py -- --guest guest-06 --output-root character-assets/reference/guest-3d-master-sources/v1/guest-06/blender
node scripts/render-guest-3d-pose-guides.mjs --root character-assets/reference/guest-3d-master-sources/v1/guest-06/blender
node scripts/build-guest-3d-sprite-pilot.mjs --guest guest-06 --preset feminine-champagne-navy-skirt

blender --background --python scripts/blender/build_guest_3d_master.py -- --guest guest-07 --output-root character-assets/reference/guest-3d-master-sources/v1/guest-07/blender
node scripts/render-guest-3d-pose-guides.mjs --root character-assets/reference/guest-3d-master-sources/v1/guest-07/blender
node scripts/build-guest-3d-sprite-pilot.mjs --guest guest-07 --preset feminine-lavender-jacket-dress

blender --background --python scripts/blender/build_guest_3d_master.py -- --guest guest-08 --output-root character-assets/reference/guest-3d-master-sources/v1/guest-08/blender
node scripts/render-guest-3d-pose-guides.mjs --root character-assets/reference/guest-3d-master-sources/v1/guest-08/blender
node scripts/build-guest-3d-sprite-pilot.mjs --guest guest-08 --preset feminine-teal-modern-hanbok

blender --background --python scripts/blender/build_guest_3d_master.py -- --guest guest-09 --output-root character-assets/reference/guest-3d-master-sources/v1/guest-09/blender
node scripts/render-guest-3d-pose-guides.mjs --root character-assets/reference/guest-3d-master-sources/v1/guest-09/blender
node scripts/build-guest-3d-sprite-pilot.mjs --guest guest-09 --preset masculine-beige-summer-suit

blender --background --python scripts/blender/build_guest_3d_master.py -- --guest guest-10 --output-root character-assets/reference/guest-3d-master-sources/v1/guest-10/blender
node scripts/render-guest-3d-pose-guides.mjs --root character-assets/reference/guest-3d-master-sources/v1/guest-10/blender
node scripts/build-guest-3d-sprite-pilot.mjs --guest guest-10 --preset masculine-charcoal-burgundy-tie
```

## Live2D 적용 범위

Live2D 모델은 보행 스프라이트를 대체하지 않는다. 화면당 한 모델만 활성화하고, 화면을 벗어나면 캔버스와 모델을 해제한다.

- 입장 화면: 눈 깜빡임, 호흡, 작은 고개 움직임
- 신랑·신부 소개: 표정 3종과 짧은 시선 이동
- NPC 대화: 대화 시작, 기쁨, 축하 반응
- 포토존: 짧은 포즈 모션

필수 납품물:

- Cubism Editor에서 출력한 `.moc3`
- 모델 연결 정보를 담은 `.model3.json`
- 텍스처 PNG
- 표정 파일 3종 이상
- 대기·인사·축하 모션 파일

원본 이미지를 한 장만 흔드는 방식은 Live2D로 취급하지 않는다. 얼굴, 앞머리, 뒷머리, 눈, 눈썹, 입, 목, 몸통, 팔, 의상을 분리한 리깅 원본이 있어야 한다.

## 확대 순서

1. `guest-01`을 실제 화면에서 확인한다.
2. 같은 규격으로 `guest-02`부터 `guest-12`까지 3D 마스터와 보행 시트를 만든다.
3. 신랑·신부 3D 마스터를 먼저 정리한 뒤 Live2D 리깅 원본을 제작한다.
4. 신랑·신부 Live2D를 입장 화면과 소개 화면에 제한적으로 적용한다.
5. 성능이 검증된 뒤 주요 NPC 대화로 확대한다.

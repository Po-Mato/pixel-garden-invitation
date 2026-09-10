# 하객 공용 2D 컷아웃 리그 설계

> 현재 머리 높이 지침은 2026-09-09 사용자 승인으로 **72px**다. 아래 과거 골격의 84px와 구분하며 `guest-character-current-guidelines.md`를 우선한다.

> 2026-09-08 정정: 아래 문서는 이전 벡터 리그(`navy-suit-v1`, `guests-v1`) 설계 기록이다.
> 현재 시각 기준인 `guest-03/style-lock-cutout-v1/animation/integrated-v2`와 다르다.
> 아래 일괄 생성 명령을 실행해도 최신 승인 외형의 12명이 만들어지지 않는다.
> 현재 상태는 `docs/guest03-visual-motion-pilot.md`와 읽기 전용 점검
> `node scripts/check-guest-cutout-release-readiness.mjs`를 확인한다.

이전 단계 기록: 3번 파일럿 승인 후 12명 로컬 전환·검증 단계  
배포 게이트: 전체 UI 검수 결과 승인 전 커밋·PR·운영 배포 금지

## 원본과 생성물

```text
character-assets/rigs/common-three-head-v1/skeleton.json
character-assets/rigs/templates/*-walk-v1.json
character-assets/rigs/guest-cutout-catalog-v1.json
                        +
character-assets/rigs/guests-v1/<preset>/appearance.json
character-assets/rigs/guests-v1/<preset>/artwork.svg
character-assets/rigs/guests-v1/<preset>/rig.json
                        ↓
            방향별 관절 키프레임 렌더링
                        ↓
        192×288 SVG/PNG 프레임 16장
                        ↓
             768×1152 고해상도 시트
                        ↓
      전체 프레임 단위 96×144 런타임 축소
                        ↓
               게임 표시 48×72
```

실제 편집 권위 원본은 공용 `skeleton.json`과 각 `guests-v1/<preset>`의 `appearance.json`,
방향별 `artwork.svg`, `rig.json`이다. 일반 빌드와 감사는 이 파일을 읽기만 하며 다시 쓰지
않는다. 의상별 템플릿과 카탈로그는 새 편집 원본을 만드는 공용 제작 레시피다.
`frames/*.svg`, `frames/*.png`, 보행 시트, 공개 PNG, 검수표, 감사 JSON은 모두 자동 생성물이다.

## 공용 골격 계약

- 캔버스: 192×288
- 캐릭터 상단: y=13
- 머리: 84px
- 몸: 168px
- 전체 캐릭터: 252px
- 목 경계: y=97
- 발 기준선: y=264
- 선택 표시: 96×144
- 게임 표시: 48×72

골격은 root, 골반, 의상, 몸통, 목, 머리, 양쪽 위팔·아래팔·손, 양쪽 허벅지·종아리·신발,
액세서리, 그림자 관절을 가진다. 캐릭터별 파츠 크기나 검출 결과로 길이를 바꾸지 않는다.
옆모습의 투영 폭은 방향별 피벗 x 오프셋으로 표현하되 뼈 길이와 세로 비율은 유지한다.

## 파츠 계약

12명은 다음 23개 역할 파츠를 가진다.

- 얼굴
- 앞머리·뒷머리
- 목
- 몸통·셔츠/넥타이·재킷
- 왼쪽·오른쪽 위팔
- 왼쪽·오른쪽 아래팔
- 왼쪽·오른쪽 손
- 골반
- 왼쪽·오른쪽 허벅지
- 왼쪽·오른쪽 종아리
- 왼쪽·오른쪽 신발
- 포켓 스퀘어 또는 의상 디테일
- 가방 또는 기타 액세서리
- 그림자

모든 파츠는 `rig.json`에서 부모 관절과 역할을 명시한다. 모든 방향은 `down-*`, `left-*`,
`right-*`, `up-*`의 독립 SVG 심벌을 가진다. 가르마, 포켓 스퀘어, 가방, 클러치,
한복 노리개는 착용자 기준 방향을 카탈로그에 저장하고 좌우 방향에서 별도로 그린다.

## 애니메이션 계약

- 1번: 왼발 전진
- 2번: 중립
- 3번: 오른발 전진
- 4번: 2번과 바이트 단위로 동일한 중립
- 허용 변형: 관절 회전, x/y 이동
- 금지 변형: 파츠 확대·축소, 프레임 이미지 반전, 픽셀 복사·교체·명암 조작

몸통·머리·골반은 고정하고 팔과 다리 관절만 움직인다. 원피스·스커트·여성 한복·남성 한복은
각각 별도의 의상 관절 키프레임을 사용하며, 가방·노리개도 액세서리 관절에서만 움직인다.
따라서 얼굴·머리·라펠·셔츠·넥타이·어깨선은 프레임 사이에서 다시 그려지거나 늘어나지 않는다.

## 자동 검수

`scripts/audit-guest-cutout-assets.mjs`는 12명 192프레임에 대해 다음을 실패 조건으로 검사한다.

- 원본 파츠·부모 관절·방향별 심벌 누락
- SVG나 키프레임의 좌우 반전·확대·축소
- 192×288 프레임 및 768×1152 시트 규격 불일치
- 머리 84px, 몸 168px, 전체 252px 선언 불일치
- 모든 프레임의 상단·발 기준선·높이 불일치
- 실제 48×72 표시 환산 중심 흔들림 1px 초과
- 1·3번 프레임 차이 부족 또는 전진 발 메타데이터 오류
- 2·4번 프레임 비동일
- 목·어깨 연결 구간 알파 단절
- 방향별 머리 폭 10% 초과
- 투명 픽셀 RGB 오염, 캔버스 외곽 불투명 픽셀
- 캐릭터별 선언 의상색과 흰색·크림색 의상 픽셀 소실
- 왼쪽 프로필 반전본과 오른쪽 실제 파츠의 차이 부족
- 우리 집·예식홀·연회장 평균색 대비 2.4 미만

검수 실패 시 `artwork.svg` 파츠 또는 `rig.json` 키프레임을 수정하고 전체 출력을 다시 만든다.

## 전체 실행

```sh
pnpm characters:build-cutouts
pnpm characters:audit-cutouts
pnpm characters:generate
node --test scripts/guestCutoutAssets.test.mjs
```

일반 재렌더링은 `guests-v1`의 편집 원본을 덮어쓰지 않는다. 공용 제작 레시피의 현재 값으로
12명 원본을 다시 초기화해야 할 때만 다음 명령을 명시적으로 사용한다. 이 명령은 캐릭터별
`appearance.json`, `artwork.svg`, `rig.json`을 덮어쓰므로 개별 수정 내용을 먼저 검토해야 한다.

```sh
pnpm characters:sync-cutout-sources
```

`scripts/generate-character-assets.mjs`는 `character-assets/generated/cutout-v1`만을 하객
원본으로 읽는다. 선택 화면에는 768×1152 시트, 게임에는 384×576 시트를 복사하며
둘은 컷아웃 생성물과 해시가 같아야 한다. 이전 `character-assets/source/guests*`는 참고용
레거시 산출물일 뿐 소비 경로에서 사용하지 않는다.

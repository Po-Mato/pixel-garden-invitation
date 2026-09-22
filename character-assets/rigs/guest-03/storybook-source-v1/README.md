# 3번 네이비 정장 · 페인팅 원본 확장 연구

## 2026-09-14 원본 레이어 경계 재검수

정면 이마의 갈색 머리 잔여선과 왼쪽 이마의 실제 머리 영역은 앞머리로,
왼쪽 코·턱 외곽선은 얼굴로 소유 영역을 수정했다. `head-layers.json`의
편집 가능한 경계만 변경했으며, 출력 PNG는 수정하지 않았다.
오른쪽 이마와 왼쪽 인접 피부를 머리로 넘기던 시험 수정은 원화 색상을
대조한 뒤 되돌렸다. 왼쪽 목덜미의 실제 머리도 기존 경계를 유지한다.

분리 파츠를 직접 확인했고 3번 원본 검사 15개, 전체 구조 검사 42개가
통과했다. 12명 보행 시트 SHA-256은 `catalog-geometry-evidence.json`의
기존 기록과 모두 동일하다. 합성 외형 보존과 독립 파츠 완성은 별개다.
이마 밑그림의 색상 경계와 후면 숨겨진 원본, 최종 UI 검수는 여전히 남아
있으며 독립 머리 움직임이나 운영 적용을 승인하지 않는다.

## 2026-09-14 숨겨진 피부 원본 연구

정면·양 측면에 머리카락 아래 피부 원본을 추가했다. 측면 v2는 귀가 중복되지
않도록 개별 원화를 수정하고 전체 두피 실루엣의 편집 가능한 SVG 마스크로
등록했다. 원본·프롬프트·생성 ID는 hidden-skin-provenance.json에 기록했다.
내장 imagegen만 사용했으며 기존 원화와 v1은 삭제하지 않았다.

공용 렌더러는 원래 얼굴이 투명하고 명시된 머리카락이 완전히 덮는 원본
영역에만 밑그림을 추가한다. 원래 얼굴의 반투명 외곽 RGBA를 그대로 유지하고,
렌더 입력 기록에 피부 원화와 SVG 마스크를 포함한다. 출력 보행 PNG를 보정하지 않는다.
구조 검사 15개와 숨겨진 피부 계약 검사 7개를 통과했고 보행 시트 해시는
e0ed45dac135bdbcc5f8dde81b9b5ea09c468b790610032a15eacec1a2a3ab73으로 변경 전과 같다.

분리 파츠를 직접 보면 아직 이마 색상 경계와 일부 머리 잔여선이 있다.
후면 밑그림도 남아 있다. 따라서 독립 머리카락 움직임·외형 교체·최종 시각 승인·
운영 배포는 허용하지 않는다. 아래 오래된 검수 기록은 당시 결과로 보존한다.

최근 렌더 검수: 3번 변경 전후 4방향을 별도로 확인하고 원본 전체 축소
샘플링(`sourceSamplesPerOutputPixel=2`)을 적용했다. 어깨·소매·바지의
점상 끊김이 줄었고 14개 구조 검사를 다시 통과했다. 원본 좌표와 골격은
동일하다. 기존 브라우저 캡처는 샘플링 변경 전이므로 최신 UI 검수는 남아 있다.

5번 승인 디자인의 부드러운 게임풍을 따르되 3번의 짧은 짙은 갈색 머리, 네이비 정장, 흰 셔츠와 넥타이를 보존한다. 기존 운영 자산은 교체하지 않는다.

원본 PNG → 편집 가능한 `masks/*.svg` → `head-registration.json` → `node scripts/render-storybook-head-study.mjs guest-03` 순서다. 공용 머리 72px, 고정 head 관절에 균일 등록한다. 완성 보행 프레임을 생성하거나 후처리하지 않는다.

내장 imagegen 사용, 별도 과금 API 없음. 생성 전 해당 방향의 기존 원본과 스타일 참고를 표시했다.

## 원본 출처 및 프롬프트

- `sources/head-front-v1.png`: `d42638d2-5be4-4972-ad47-6cdcabfd8c36`. “Game paper-doll HEAD source, front view. Character 1: friendly young man, short dark brown softly parted hair, brown eyes, small closed smile. Match character 2's soft painted cute game style and compact rounded proportions, but retain his masculine hairstyle, no bun or lashes. One assembled head only, no neck, body or labels. Transparent background.”

방향별 원본 제작·레이어 분리·몸통과 팔다리 연결·보행·시각 검수는 진행 중이다. `runtimeEligible`은 false이며 운영 배포용이 아니다.

- `sources/head-left-v1.png`: `0556bf88-233a-4508-b705-75076a7c078d`. “Same young man's game paper-doll HEAD in exact LEFT profile, nose pointing left, one eye. Keep compact skull, short softly parted dark brown hair, brown eye, tiny closed smile and soft painted game style. No tall crown or spike, no neck/body. One head source part, transparent background.”
- `sources/head-right-v1.png`: `b2a3f775-b160-41e2-9688-36d360504a15`. “Same young man's game paper-doll HEAD in exact RIGHT profile, one eye and nose pointing right. Draw his opposite side, not a mirror: preserve the actual off-center part and swept bangs of the front original. Compact rounded skull, short dark brown hair, warm brown eye and small smile, soft painted style. No tall spikes, neck or body. Transparent background.”

정장 첫 후보 `336aaa9b-8651-4716-af74-9ae9642c976e`는 허리 굴곡 때문에 미채택. 다음 후보 `c56a0e5f-518b-403f-a27b-12601efeaeb6`는 소매까지 포함되어 미채택. 두 후보 모두 프로젝트 원본으로 복사하거나 적용하지 않았다.

- rear head: `7a9f237d-c5ee-406b-aa24-3724ec404dcc`. “Refine only the lower nape of this rear-view game head: neat short softly curved hairline, remove the long downward V point and dense shaggy tail. Keep crown, ears, dark brown palette and painted layers unchanged. Still one rear head part, transparent background.” 이전 후면 `2238e905-b421-4b31-97fb-6740f0a81e1a`를 수정한 결과다. 후면 chinY는 숨겨진 턱 평면으로, 실제 머리카락 하단이라고 주장하지 않는다.
- front torso: `6161e523-83a0-4fd8-9ecb-d65246c26fcd`. “Remove both sleeves entirely from this paper-doll costume component; leave only the central jacket torso and shirt with open shoulder attachment edges. Preserve its relaxed straight boxy torso, navy color, lapels, tie and pocket square. No arms or hands. Transparent background.”
- left leg: `ad2684d2-b2c7-44e9-b810-c1a4413c25f0`. “Dress-up game costume part: one LEFT trouser leg with rounded black oxford shoe, front view with toe slightly toward image-right. Match reference 2 navy palette and soft simple painted shading. Straight relaxed trousers, subtle knee fold, broad stable flat sole, no glossy realism. Upper thigh through shoe only, no other costume parts. Transparent background.”
- right leg: `bd4767d9-c73e-4916-acd2-b6abfde711ea`. “Matching RIGHT trouser leg and rounded black oxford shoe for this dress-up game. Front view, toe slightly toward image-left. Match part 2 navy palette and soft painted shading, relaxed straight trouser silhouette and stable flat sole. Separate opposite-side costume part, not a flipped image. Upper thigh through shoe only. Transparent background.”
- left sleeve: `32729ef2-e46f-4777-957f-81ea4e6ff33a`. “Dress-up game costume LEFT sleeve and small relaxed cartoon hand, front view. Thin navy suit sleeve matching reference 2 painted palette, white shirt cuff, thumb toward image-left. Soft shoulder, nearly vertical neutral pose, no muscles or bulky folds. One reusable costume component only, transparent background.”

`sources/pelvis-front.svg`는 상의 아래 골반 연결부의 명시적 공용 관절 파츠다. 정장과 바지의 표면 원화는 그대로 두며 빈 내부 연결부에만 원본 색면을 제공한다. `painted-shadow.svg`는 root에 부착하는 공용 그림자 원본이다. 둘 다 프레임 PNG 수정이 아니다.

- right sleeve: `8bb08e34-d4d3-469c-b093-6605c17b15d5`. “Matching RIGHT sleeve and small relaxed cartoon hand for this dress-up game. Front view, thumb toward image-right. Thin navy suit sleeve, small white cuff, soft painted palette and nearly vertical neutral pose matching part 2. Draw the opposite costume component, no mirror transform, no muscles. Transparent background.”

정면 전신은 `render-storybook-body-study.mjs guest-03`, 보행은 `render-storybook-walk-study.mjs guest-03`로 출력한다. 기존 `tailored-front.json`의 공용 동작과 `painted-joint-regions-v1.json`의 원본 관절 영역을 사용한다. `storybookSourceStudy.test.mjs` 5개 검사(방향별 머리 원본·프레임 크기·중립 반복·반대 발 전진·기준선·고정 관절·운영 제외)를 통과했다. 측면/후면 전신은 아직 제작 중이며 실제 게임 UI 검수는 미완료다.

## 네 방향 전신 연구 업데이트

이제 32개 원본 등록 항목으로 네 방향 16프레임을 자동 출력한다. 위 정면 4프레임 기록은 이전 단계 기록이다. `generated/walk-study.png`는 768×1152이며, `review.html`에서 192×288 / 96×144 / 48×72를 확인한다. 운영 자산은 아직 교체하지 않았다.

좌우 바지·신발은 각각 실제 방향으로 그린 원본이다. 각 측면의 무장식 다리 소재는 해당 방향의 양쪽 해부학적 관절에서 공유하며, 반전하지 않는다. 후면도 같은 무장식 바지 소재를 공유한다. 양쪽 후면 소매는 독립 원화이며, 팔을 덮던 몸통 레이어 뒤로 숨기지 않고 어깨 관절에서 연결한다. 공용 피벗이나 팔 길이는 바꾸지 않았다.

`painted-tailored-contact-v1.json`은 중립 발바닥이 이미 y=270에 등록된 새 정장 원본 계열의 접지 키다. 예전 오른쪽 원본에 맞춘 높이 오프셋만 제거하고 공용 보행 회전과 타이밍은 유지한다. 테스트 허용치나 출력 픽셀을 수정하지 않았다.

`head-layers.json`은 방향별 얼굴·앞머리·뒷머리의 편집 가능한 원본 영역을 정의한다. `render-storybook-direction-head-layers.mjs guest-03`이 분리하며, 합친 알파와 불투명 원화 색상이 유지되는지 검사한다. 가려진 두피·이마는 아직 완성되지 않았고 머리 레이어의 독립 움직임을 허용하지 않는다. 외곽선의 소유 영역도 추가 시각 검수 대상이다.

390×844 연구 페이지에서 네 방향 전환, 재생 중 프레임 변화, 프레임 선택 시 정지, 가로 넘침 없음, 세 표시 크기를 확인했다. 이 기록은 실제 선택 화면·게임 맵·서비스 워커 검수의 대체물이 아니다.

### 추가 원본 제작 기록 — 내장 imagegen만 사용

- `torso-left-v1.png`: `3bfb6e5e-f591-4b4a-bac6-7c21f1f3cb4a`. 왼쪽 프로필 네이비 재킷 몸통, 반대쪽 포켓 장식은 숨김. 원본 SVG 커버리지의 `relaxed-back`으로 뒤쪽 밑단 돌출을 줄였다.
- `torso-right-v1.png`: `54532b24-81af-4ac5-a0f7-3ebf0357d017`. 오른쪽 프로필 네이비 재킷 몸통, 착용자 왼쪽 포켓 장식 유지. 반전하지 않았으며 허리 외곽은 이 원본의 SVG 커버리지에서 편집했다.
- `torso-back-v1.png`: `8eb8bc94-64e6-4a86-b84f-2f6a2cca1a5a`. “Edit this rear navy jacket torso part: remove both pocket flaps and side dart lines; make both outer sides straight, relaxed boxy cut from armpit to hem, no pinched waist. Preserve collar, center seam, vent, navy palette and painted game style. No sleeves or other body parts. Transparent background.” 주머니와 잘록한 허리가 있던 `a11b5bdf-07ce-4200-a3ad-aa94e252750f`는 적용하지 않았다.
- `leg-left-v1.png`: `645d9416-fb3b-437c-b162-416506b344b9`. “One game costume leg source, exact LEFT profile, shoe toe pointing left. Same navy relaxed straight trousers and rounded black oxford as reference, soft painted game shading. Neutral straight upper thigh through flat grounded shoe, not a walking pose, no other body parts. Transparent background.”
- `leg-right-v1.png`: `66bc9e86-6733-47d7-b2dc-42d4b24d5ade`. “Matching costume leg source in exact RIGHT profile, rounded black oxford toe pointing right. Independently paint the opposite side of this navy relaxed trouser leg, same muted palette and soft game shading. Neutral straight leg, stable flat sole, upper thigh through shoe only. Transparent background.”
- `leg-back-v1.png`: `0601f0ab-d2a5-4ee7-a837-af0b74bd818b`. “One navy trouser leg and rounded black oxford viewed directly FROM BEHIND, centered rear heel visible, no toe or laces visible. Same relaxed straight fit, muted navy and soft painted game shading as reference. Neutral straight upper thigh through flat sole only, transparent background.”
- `arm-left-v1.png`: `eeeda7af-3c06-4d2a-93bc-69d31fa72841`. “Game costume sleeve source in exact LEFT-facing profile. Thin relaxed navy jacket sleeve, softly rounded shoulder cap, small white cuff, small relaxed hand seen edge-on with thumb toward image-left. Match reference muted navy painted shading. Nearly vertical neutral arm, no muscles, no other body parts. Transparent background.”
- `arm-right-v1.png`: `ebb99dc2-ac5d-4bf3-973f-27406113daa4`. “Game costume sleeve source in exact RIGHT-facing profile. Thin relaxed navy jacket sleeve, softly rounded shoulder cap, small white cuff, small relaxed hand seen edge-on with thumb toward image-right. Same muted navy painted shading. Independently draw this opposite view, no mirror transform. Nearly vertical neutral arm, no muscles or other body parts. Transparent background.”
- `armLeft-back-v1.png`: `d93a02c7-f474-4c4b-ac66-670f85c8abd2`. “One anatomical LEFT navy jacket sleeve and small relaxed hand viewed from BEHIND. Thin sleeve, soft rounded shoulder, white cuff, thumb toward image-right. Keep reference muted navy painted game style. Straight hanging arm, not flared outward, no muscles, no other body parts. Transparent background.”
- `armRight-back-v1.png`: `b9c9a0ee-ce3f-4dd4-8083-e39739750258`. “One anatomical RIGHT navy jacket sleeve and small relaxed hand viewed from BEHIND. Thin sleeve, soft rounded shoulder, white cuff, thumb toward image-left. Same muted navy painted game style. Straight hanging arm, not flared outward, no muscles or other body parts. Transparent background.”

2026-09-12 추가 검수: 390×844 연구 화면에서 재킷 아래 사각형 골반 연결부의
노출을 직접 발견했다. 이 캐릭터의 front/profile 원본 SVG만 허벅지 시작 관절을
덮는 194px까지로 수정했다. 골격·다리 길이·보행 키와 다른 캐릭터 원본은 불변.
14개 보행 검사 통과. 수정 전 sampling-v3와 수정 후 pelvis-v4 화면을 구분해 보존했다.
수정 후 네 방향, 어두운/크림 배경, 96×144·48×72 표시를 직접 확인했다.
재생·정지 동작, 가로 넘침 없음 및 이미지 로드를 확인했고 전용 브라우저는 종료했다.
증거: generated/browser-pelvis-review.json 및 mobile-*-pelvis-v4.png 5장.
운영 선택/맵 검수나 최종 시각 승인을 의미하지 않는다.

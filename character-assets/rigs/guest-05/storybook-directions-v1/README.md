# 방향별 원본 연구 — 운영 미반영

추가 검수: 네 방향 공용 그림자를 root [96,270]에 연결했다. 왼쪽 방향의 가방은 handLeft [90,180.418605]에서 실제 원본 커버리지를 가진 채 치마 뒤에 완전히 가려진다. 반전이나 다른 손으로의 교체는 없다. 숨겨진 가방의 모든 알파 픽셀이 불투명 치마에 덮이는 자동 검사도 통과했다. 3번·5번 연구 통합 검사 37개 통과 기록이며 실제 게임 UI·전체 릴리스 검사 통과를 의미하지 않는다.

정면 기준: `../storybook-concept-v1/front-concept.png`. 기존 성인 비율 turnaround는 방향 확인용이며 새 외형 기준이 아니다.

방향별 머리는 독립 생성 원화 + 편집 가능한 SVG 마스크 + 균일 등록을 사용한다. 단순 좌우 반전 없음. `node scripts/render-storybook-direction-heads.mjs`로 비교 출력한다. 현재는 머리 통합 원화 단계로, 각 방향의 얼굴/앞머리/뒷머리 분리 및 전신 보행이 남아 있다.

공용 골격의 72px 머리 등록을 사용한다. back의 chinY는 보이지 않는 턱/목 결합 평면이며 측정되는 얼굴이나 머리카락 경계로 위장하지 않는다. 헤어 실루엣의 실제 크기·인상은 별도 시각 검토가 필요하다.

내장 imagegen 사용. 생성 전 해당 방향 기존 원본을 표시했다. 별도 유료 API 사용 없음.

선택된 프롬프트:

- left head: “Rotate head 1 to an exact 90-degree LEFT side profile: only ONE eye, no far eye or far cheek. Reduce excessive rear hair mass; compact rounded skull consistent with character 2. Keep side-swept brown hairstyle, small partly hidden low bun, warm brown palette and cute painted style. Head part only, no neck/body, transparent background.” (`6b461b1a-2ba2-4017-9b53-eddab28000e4`)
- right head: “HEAD source part of character 1 in exact RIGHT profile, nose pointing right, one visible eye. Match profile 2's compact cranial height and cute painted style, but draw the opposite anatomical side, DO NOT mirror it. Her low bun on anatomical left is near-side, visible behind the ear; preserve the actual side part and swept bangs from image 1. Same warm brown shades. No neck, body or earrings. Transparent background.” (`abc6b7ea-5b84-4481-8a99-e84839c1aa56`)
- back head: “Only this character's HEAD source part from directly BEHIND. Same compact rounded head, smooth swept warm brown hair and restrained painted 2D shading. Low bun sits slightly on anatomical LEFT, which is image-left from behind. Match the front and side cranial size; no taller crown or spikes. Tiny ears permitted, NO face, neck or body. Transparent background, no glow.” (`426cec0e-1013-4a7a-9cd5-6d78d5763e88`)
- left torso: “Redraw clothing part 1 in the cute painted style and exact cream/sage palette of part 2. KEEP the exact left-facing 90-degree side view: front at left, back at right, only one shoulder. Remove chest bulge and tight waist, make a compact straight relaxed torso. No sleeve, head, neck, arm or skirt. Transparent background.” (`3a62e921-3628-426d-9af8-1f9c1514e7d0`)

측면 몸통의 돌출 실루엣은 원본 SVG coverage에서 완만하게 수정했다. 완성 PNG를 자르거나 프레임별로 교체하지 않는다. 후면 볼레로의 등록 길이도 원본 coverage로 결정한다.

## 전신 연결 진행 상태

`body-registration.json`은 방향별 공용 관절을 기준으로 원화를 균일 등록한다. 소매는 원화의 어깨–손 축을 관절 축에 회전·균일 배율로 등록한다. 가까운 팔은 몸통 뒤에 묻히지 않도록 별도 draw layer를 사용한다.

`render-storybook-direction-bodies.mjs` → `render-storybook-direction-walk.mjs` 순서로 실행한다. 보행은 기존 공용 `dress-left/right/back.json`을 읽는다. 허벅지·종아리·신발 및 위팔·아래팔·손은 등록된 **원본 재료**를 관절별 SVG coverage로 나누고 3px 겹침을 둔다. 보행 PNG는 입력으로 읽지 않는다.

측면의 장식 없는 다리 및 소매 재료는 각 방향 내 양쪽 관절에 공유 등록한 연구 상태다. 손의 해부학적 좌우 차이, 가방 가림, 후면 팔, 세 방향 머리 레이어 분리와 전체 시각 검수가 남아 있다. 원화 공유를 좌우별 독립 완성으로 보고하지 않는다. `runtimeEligible`과 `visualApproved`는 계속 false다.

추가 원화 출처(내장 생성, 원본 보존):

- right sleeve: `f47a0560-0b19-47fa-92ce-8f9654283286`, “Game paper-doll SLEEVE AND HAND source part only in RIGHT-facing side profile. Thin cream bolero sleeve hanging nearly vertically, small relaxed curled hand seen edge-on, thumb toward image-right. Same painted cream and peach style. Smooth restrained folds, no puffed shoulder, no muscles. Shoulder to fingertips, no torso or other parts. Transparent background.”
- rear left sleeve: `01a4e7d6-52c3-4e89-aa30-f9dbc5f11614`, “Wholesome dress-up game paper-doll clothing asset. Paint the rear view of a thin cream jacket sleeve with a small relaxed cartoon hand at its cuff, vertical neutral pose, matching the reference's soft cream and peach illustration style. This is the doll's left sleeve; thumb toward image-right. Only this reusable costume component, transparent background.”

후면 소매 첫 요청은 출력 안전 필터로 실패했고 저장·적용하지 않았다. 게임 의상 파츠라는 의도를 명확히 한 재요청이 성공했다.

- rear right sleeve: `4a6484b5-1959-4bf9-aa17-88cea974f035`, “Matching dress-up game paper-doll costume component, RIGHT sleeve seen from behind. Thin cream jacket sleeve hanging vertically with a tiny relaxed cartoon hand, thumb toward image-left. New rear-right view painting, same soft cream and peach illustration style. Transparent background. Only this reusable costume component.”
- right bag: `ec60c1aa-4d7e-4d03-81c0-67a954d0dee4`, “Game costume accessory source: this small rounded ivory clutch, same nearly square proportions and soft painted tan piping, viewed from its broad outer side with a little thin edge visible on image-left. No strap, hand, character, text or extra object. Restrained painted 2D shading. Transparent background.”
- rear bag: `d1fcd71d-1594-4951-8ff6-111401ad6895`, “Dress-up game accessory part: this ivory clutch seen almost edge-on from the back of its wearer. Narrow vertical rounded rectangle, pale cream padded side with thin tan piping, no large front face. Same soft painted style. Only bag, no strap, hand or character. Transparent background.”

## 보행 및 화면 검수 추가

후면 양팔, 오른쪽/후면 가방을 연결했다. 네 방향 16프레임 `generated/guest05-walk-study.png`와 축소 시트는 연구 산출물이며 운영 자산을 덮어쓰지 않는다.

공용 `painted-dress-contact-v1.json`은 새 원피스 재료 계열의 접지 키다. 이전 원화에 맞춰 비대칭으로 조정된 접지 높이를, 같은 다리 재료를 공유하는 새 계열의 대칭 키로 분리했다. 기존 회전·타이밍과 기존 캐릭터 키는 보존한다. 프레임 이미지에 위치/픽셀 보정을 하지 않는다.

390×844 연구 페이지에서 네 방향 버튼, 재생·프레임 선택 정지, 어두운 배경, 이미지 로드, 가로 넘침 없음 및 표시 크기를 확인했다. `browser-review.json`에 범위와 남은 시각 검수를 기록한다. 실제 서비스 워커·선택 UI·게임 맵 검수 완료를 의미하지 않는다.

`head-layers.json`과 `render-storybook-direction-head-layers.mjs`를 추가했다. 좌우의 얼굴/앞머리/뒷머리, 후면의 귀/뒷머리를 독립 출력하고 머리 렌더러가 이 합성본을 소비한다. 후면 앞머리는 가려진 빈 레이어임을 명시한다. 모든 레이어는 명시적 head 부모와 공통 원화 피벗을 갖는다. 전체 알파와 불투명 RGB는 합성 전후 동일하다. 아직 가려진 이마와 모발 표면은 완성되지 않았으므로 독립 레이어 움직임/임의 헤어 교체 승인으로 보지 않는다.

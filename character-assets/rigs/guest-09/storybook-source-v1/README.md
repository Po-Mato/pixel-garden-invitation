# 9번 베이지 수트 · 페인팅 원본 연구

운영 미반영. 현행 `guest-character-presets.json`의 베이지 수트·갈색 넥타이·브라운 로퍼와 브라운 헤어 기준을 사용한다. 3번의 공용 정장형 골격과 동작을 공유하지만 원화와 마스크는 별도 검수한다. 별도 과금 API나 구매 에셋을 사용하지 않는다.

`sources` 원화 + `masks` 편집 가능한 커버리지 + 관절 등록 JSON → 자동 생성물 `generated`. 최종 PNG를 직접 수정하지 않는다.

- head-front: 내장 imagegen `52d89f7a-5cfb-4959-9d9e-fde6fb3e377b`. 원본 정면을 먼저 표시했다. “One FRONT game character HEAD source for image 1's beige-suit guest. Warm chestnut brown center-parted short hair with gentle curved curtain bangs, brown eyes, small closed smile. Use image 2's compact cute face and soft painted game shading, but preserve image 1's center part. No neck, body or labels. Genuinely transparent background.” 결과는 정중앙보다 약간 옆으로 치우친 가르마이며 이 선택 원화의 가르마를 다른 방향에도 유지해야 한다.

## 방향별 제작 기록

모든 생성 전에 해당 방향의 기존 원본을 표시했다. 내장 imagegen만 사용했으며, 아래 ID는 원본 보존 디렉토리의 `exec-<id>.png`에 대응한다. 선택한 파츠만 `sources`에 복사했다.

| 원본 | 생성 ID | 프롬프트 핵심 |
| --- | --- | --- |
| head-left-v1 | fedd4b0a-7260-4984-88e7-ed5b7b77be72 | Same chestnut-haired guest in exact LEFT profile; preserve off-center curtain part, brown eye, compact rounded nape; no neck/body; transparent. |
| head-right-v1 | 34e4e57d-07f1-4a94-9483-b2a6db15427f | Same guest in exact RIGHT profile; preserve opposite-side part; do not mirror left; no extra crown height; transparent. |
| head-back-v1 | a7a79200-0940-498c-bef0-6410e07c80b6 | Same guest FROM BEHIND; short layered brown hair, off-center crown, curved nape, small ears; no face/neck; transparent. |
| torso-front-v1 | e8610612-fefe-4d86-add4-bfa731bfaa43 | Change navy costume to warm beige jacket, brown tie/buttons, ivory shirt/pocket square; preserve compact connected cut; torso only. |
| torso-left-v1 | b8b8bea7-5409-428d-afcc-92e083f60374 | Remove chest pocket and square from left-facing beige source; preserve collar, lapel, tie, lower pocket and silhouette. |
| torso-right-v1 | 3d6a5cf7-d16b-4093-9e5d-36bb3783aacf | Straighten image-left back edge below shoulder; no waist pinch or flare; preserve beige palette and ivory square. |
| torso-back-v1 | 9d9f6c5a-35ce-4ed5-b6c1-47e799c1cdc9 | Back jacket in warm beige with ivory collar; relaxed straight sides, compact shoulders and center vent; no darts/pockets. |
| legLeft-front-v1 | 19f774a1-1157-4daf-b38b-837d4516c197 | Anatomical LEFT front leg; beige straight trousers, flat brown penny loafer, no laces; neutral, transparent. |
| legRight-front-v1 | 308dad20-f925-4d3c-a3b7-b67bcf61e6dc | Anatomical RIGHT front leg; same beige cloth and brown penny loafer; neutral, transparent. |
| leg-left-v1 | ccf939e0-bd44-43ce-9798-07612d796e91 | LEFT profile leg; neutral straight beige trousers and flat brown penny loafer pointing left; no laces. |
| leg-right-v1 | 9021540e-a97a-426d-b3db-fcaab407dbb0 | RIGHT profile leg; neutral straight beige trousers and flat brown penny loafer pointing right; no laces. |
| leg-back-v1 | 270099fe-c002-4e61-8728-897bc95d26fb | BACK leg; neutral beige trousers and flat brown penny loafer from behind. |
| armLeft-front-v1 | fb79b516-d383-414a-bea1-5fee88849942 | Anatomical LEFT front sleeve; beige palette, thin relaxed arm, ivory cuff, small hand/thumb image-left. |
| armRight-front-v1 | c0bb0c8a-ad71-4b57-925d-ffc929f4270c | Anatomical RIGHT front sleeve; beige palette, ivory cuff, small hand/thumb image-right. |
| arm-left-v1 | 04d47af2-20fd-4f4d-a40d-c8855cdca8e8 | Left-profile thin beige sleeve, ivory cuff, natural hand/thumb left; neutral transparent part. |
| arm-right-v1 | 55c8906b-6c31-4236-8452-f773b029a86f | Right-profile thin beige sleeve, ivory cuff, natural hand/thumb right; neutral transparent part. |
| armLeft-back-v1 | eaa36587-de32-4e4f-ba9e-568aed5835cb | Anatomical LEFT back sleeve, beige cloth, rounded shoulder, ivory cuff, thumb image-right. |
| armRight-back-v1 | e8fa055c-1bc5-484d-8819-ac05860f7299 | Anatomical RIGHT back sleeve, beige cloth, rounded shoulder, ivory cuff, thumb image-left. |

일부 생성 원본은 투명 알파 대신 체크무늬를 포함했다. 해당 원본에 한해서 닫힌 잉크 윤곽의 외부 영역으로 SVG 커버리지 초안을 만들고 확인했다. 흰색 RGB를 지우는 방식은 쓰지 않으며, 흰 셔츠·커프스는 내부 커버리지에 남긴다. 원본 RGB와 편집 가능한 마스크를 분리 보관하고 렌더 시 결합한다.

`head-layers.json`의 방향별 얼굴/앞머리/뒷머리 영역은 9번 원화에서 별도로 작성했다. 현재는 머리 관절에 함께 고정된다. 가려진 두피·얼굴 복원 및 독립 파츠 교체 검수는 미완료다.

측면 v2 원본은 소매와 겹칠 어깨 부분의 진한 타원 구멍 선을 없애고 같은 옷감 명암으로 연결했다. `torso-left-v2` 생성 ID `94bd6354-e354-409f-a5b4-77d7e4fd3f2d`, `torso-right-v2` ID `dde68846-04fd-437c-98fb-34d7a8231032`. 프롬프트: “Change only the oval armhole: remove its dark ring and dark interior, replacing with uninterrupted softly shaded beige cloth for a separate sleeve to overlap. Preserve silhouette, lapels, collar, tie, pockets, exact colors and canvas. Genuinely transparent background.” 왼쪽은 가슴 포켓 없음, 오른쪽은 아이보리 포켓스퀘어를 보존했다.

골반 SVG의 가려지는 연결 범위를 194px까지로 줄였다. 공용 허벅지 관절 192.139535px, 다리 길이, 머리 크기는 변경하지 않았다. 재킷 아래 네모난 연장부가 보이지 않게 하는 원본 레이어 수정이다.

원본 전체 레이어에 `sourceSamplesPerOutputPixel=2`를 적용했다. 9번의 변경 전후
4방향 몸체 검수표에서 어깨·소매·바지 잉크 윤곽의 점상 끊김 감소를 직접
확인하고 14개 검사를 다시 통과했다. 원본 좌표, 피벗, 골격 및 등록 크기는
동일하다. 기존 v2 브라우저 캡처는 이 샘플링 변경 이전 자료이므로 최신
브라우저 검수를 대체하지 않는다.

이후 v3 전용 390×844 브라우저 검수를 추가했다. 네 방향과 1·2·3번 수동
프레임, 보행 재생→정지, 어두운/크림 배경, 표시 크기 192×288·96×144·48×72를
확인했다. 가로 넘침 없이 이미지가 로드됐으며 마지막 상태는 정면 2번/정지였다.
`generated/browser-sampling-review.json` 및 `mobile-*-sampling-v3.png`를 참고한다.
사용한 전용 브라우저 세션은 닫았다. 여전히 실제 운영 UI 검수나 최종 승인은 아니다.

수정 후 4방향 16프레임과 엄격한 자동 검사 14개를 다시 통과했다. 390×844 연구 화면에서 네 방향, 수동 프레임 선택, 보행 재생/정지, 세 배경, 96×144와 48×72 표시를 확인했다. 근거는 `generated/browser-review.json`과 v2 화면 캡처다. 이 기록은 실제 선택 UI·게임 맵·서비스 워커 검수나 최종 시각 승인/배포 완료를 뜻하지 않는다.
## 2026-09-14 오른쪽 원본 윤곽 보완

오른쪽 재킷·바지·소매의 편집 가능한 SVG 명암을 추가했다. 원본 실루엣 안에서
합성한 뒤 동일 골격과 키프레임으로 다시 렌더링한다. 흰 커프스·손·신발은
명암 대상에서 제외하며 원본 알파와 비편집 불투명 RGB 보존 검사를 통과했다.
처음의 약한 갈색 명암은 다른 맵 대비를 악화시켜 미채택했고, 기존 갈색 외곽선
계열로 수정했다. 프레임 PNG 보정·신체 크기 변경·좌우 반전은 하지 않았다.

1,920개 맵 샘플: 기본 미달 70→67개, 디스플레이 미달 11→9개. 아직 전체
대비 통과가 아니다. 390×844 실제 선택 화면에서 오른쪽 4프레임 순환, 고정
크기·위치와 정지 시 중립 복귀를 확인했다. 실제 게임 전체 주기 검수는 남아 있다.
검사·출력 해시·원본 실험 및 브라우저 자료는 source-edge-review.json 참조.
운영 자산이나 시각 승인 플래그는 변경하지 않았다. 아래는 이전 기록이다.

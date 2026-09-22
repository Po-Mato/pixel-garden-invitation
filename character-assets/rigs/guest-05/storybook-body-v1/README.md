# 승인 외형 기반 정면 파츠 리그 연구

2026-09-12. 운영 자산이 아니며 전체 목표 완료 자료가 아니다.

## 원본과 생성물

- `sources/`: 내장 imagegen이 만든 개별 의상·팔다리·가방 원화. 원본은 변경하지 않는다.
- `masks/`: 편집 가능한 원본 실루엣. RGB 색상으로 배경을 제거하지 않는다. 흰색·크림색도 마스크 내부에서 그대로 보존된다.
- `front-registration.json`: 공용 72/144/216 골격에 대한 고정 균일 배율·부모 관절·피벗. 프레임별 크기 보정 없음.
- `front-joint-bindings.json`: 양팔·양다리의 12개 관절 파츠 영역 및 3px 원본 재료 겹침. 완성 프레임을 잘라 입력하지 않는다.
- `neck-front.svg`: 기존 코드 네이티브 목/가슴 파츠 계열의 단순한 원본. 참고안에 없는 목걸이는 포함하지 않는다.
- `generated/`: 항상 자동 출력. 직접 수정 금지.

재생성:

```sh
node --test scripts/storybookHeadLayers.test.mjs
node --test scripts/storybookFront.test.mjs
```

머리의 숨겨진 이마·뒷머리는 원본 레이어에서 보완했고 조립 외형 RGBA 동일성 6개 테스트 통과. 정면은 공용 `dress-front.json`을 재사용한다. 캐릭터 전용 보행 키프레임을 새로 만들지 않았다. 정면 5개 테스트는 프레임 크기, 중립 반복, 반대 발 전진, 머리·상체 고정, 발 기준선, 실제 공용 피벗 연결과 비운영 상태를 검사한다.

## 직접 본 범위와 남은 일

`review.html`을 Chromium 390×844에서 확인. 192×288, 96×144, 48×72 이미지 로딩 및 실제 CSS 크기 확인, 가로 넘침 없음. 밝은/어두운 배경 전환, 재생 시작, 프레임 버튼을 통한 정지와 1/3번 전환 확인. 화면 증거는 generated/mobile-*.png.

크림색 의상과 얼굴은 표시 크기에서 유지되며, 정면 관찰에서는 큰 알파 단절이 보이지 않는다. 그러나 이는 실제 선택 UI/게임 맵 검사가 아니다. 관절의 전체 보행 시각 품질, 4방향 연결, 얼굴/머리 독립 교체, 다른 11명 확장, 전체 테스트, 배포는 미완료다. 자동 검사 통과를 시각 품질 최종 승인으로 사용하지 않는다.

내장 이미지 생성만 사용. 별도 유료 API/유료 에셋 사용 없음. 원본 PNG의 체형을 비균일 확대하거나 완성 PNG에 픽셀을 붙이는 처리를 사용하지 않는다. v1 후보는 보존하며 v2 선택은 등록 파일로 관리한다.

## 이번 추가 생성 프롬프트

- skirt-front-v2: “Edit only the skirt source part in image 1: widen the waist by 25%, make the bow and hanging ribbon 25% smaller, matching the modest proportions in character reference 2. Keep hem width, length, sage color, painted shading and canvas unchanged. Garment only, no body. Actual transparent background, no halo.”
- leg-right-front-v2: “Game paper-doll RIGHT LEG source painting only. Edit image 1 to match reference 2's cute rounded calf and small rounded ivory flat: make calf and ankle 40% fuller, shoe 20% wider; soft non-muscular contour. Keep total height, neutral pose, shoe sole location and canvas. No other parts. Transparent background, no glow.”
- leg-left-front-v2: “Game paper-doll LEFT LEG source painting only. Edit image 1 to match reference 2's cute rounded calf and ivory flat: calf and ankle 40% fuller, shoe 20% wider; soft non-muscular contour. Keep total height, neutral pose, shoe sole location and canvas. No other parts. Transparent background, no glow.”
- bag-front-v1: “Make this bag nearly SQUARE, not a long horizontal rectangle. Width only slightly greater than height. Same ivory painted fabric, rounded corners, tan edge. Bag accessory part alone, transparent exterior, no hand or text.”

생성 파일 식별자: skirt `472131ab-090d-49ee-8710-1a30c2541899`, right leg `2847e295-3d1f-41fa-8198-ff4fee48ea5b`, left leg `3a960577-2695-4141-882a-88b4e3d08c04`, bag `230a9a6c-2beb-4385-93ea-38aec1039ac1`. 배경이 불투명 체커로 생성된 원화는 별도 SVG 마스크를 원본으로 사용한다. 불투명 체커를 투명 배경이라고 보고하지 않는다.

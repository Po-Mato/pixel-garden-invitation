# 정면 머리 파츠 재현 실험 — 미채택

승인 원화: `../storybook-concept-v1/front-concept.png`.
SHA256: `49c46c13c6f36ca2249aa2176d91783286df9e40ceca9d2b003018e58882973f`.

이 폴더는 디자인 비교 전용이며 런타임·골격·보행 출력에 연결하지 않는다.
사용자가 거절한 `storybook-rig-v1` 벡터 리그는 확장하지 않았다.

## 결과

- 내장 imagegen으로 정면 얼굴·귀·머리카락을 합친 원본 파츠 후보 하나 제작.
- 첫 결과를 수정 없이 `front-head-candidate.png`로 복사했다. 원화 PNG를 자르거나 붙이지 않았다.
- 눈매, 미소, 가르마와 채색은 벡터 시안보다 원화에 가깝지만 완전 일치하지 않는다. 미세한 볼 강조와 입 모양 차이가 남는다.
- 1422×1106 RGBA. 투명 픽셀 895195개, 부분 투명 676485개, 완전 불투명 1052개. 얼굴 내부 alpha 253, 머리 내부 alpha 252가 관측되어 파츠로는 미채택.
- 불투명도만 고치는 두 번째 생성은 RGB 체크무늬 배경으로 실패했다. 프로젝트에 복사하지 않았다.
- PNG 알파 보정, 픽셀 패치, 몸·보행 확장 및 배포는 하지 않았다.
- 머리 높이 비교는 브라우저의 균일 확대·축소로만 한다. 파츠 분리·피벗 등록·72px 골격 검증은 아직 수행하지 않았다.

## 생성 이력

내장 imagegen 사용. 첫 결과: `exec-ac58a238-021f-463c-a2f9-76389f0cca44.png`.

프롬프트:

> Image 1 is the approved character reference. Make ONE front-facing raster cutout HEAD part (face, ears and all hair together), no neck or body, centered on genuinely transparent background. Faithfully preserve her exact eye shape/spacing, small smile, jaw, side part, swept brown hair silhouette and low bun on viewer-right. Same fine outlines and soft painted game shading; no redesign, no thicker crown, no vector simplification, no added detail. Keep entire head visible with clear margins. No text, shadow, white halo or checkerboard.

두 번째 결과(미보관): `exec-dc0868e5-a2ea-4ed8-81d5-ebca3f794796.png`.

> Edit this single front head part ONLY to fix transparency: face and hair interiors fully opaque alpha 255, exterior fully transparent alpha 0, antialiasing only along the immediate silhouette edge. Preserve all existing facial features, smile, hair shape, colors, fine lines and painted shading exactly. No body, neck, white fringe, glow, backdrop or checkerboard. One transparent PNG head part.

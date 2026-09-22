# 숨겨진 이마 피부 원화

내장 imagegen 사용. 별도 API/별도 과금 도구는 사용하지 않았다.
입력은 투명 영역의 숨은 RGB를 정리하여 자동 출력한 정면 얼굴 레이어다.
결과: `exec-4dd8114b-9f71-4efe-a299-980d6967a6be.png`를 수정 없이 `hidden-forehead-paint-v1.png`로 보존했다.

프롬프트:

> Complete this front FACE animation source part: paint the missing upper forehead and scalp into a natural round head, remove remaining brown hair fragments. No hair, neck or body. Keep the existing eyes, nose, mouth, cheeks, ears and chin exactly in their current position and size; do not recenter or redesign. Match the soft peach skin shading. Transparent background, no halo or text. Preserve the same canvas and lower face.

원화 배경은 체크무늬가 그려진 불투명 배경이므로 이 파일 자체를 투명 파츠로 사용하지 않는다.
사용자가 승인한 로컬 원본 마스크 방식으로 피부 영역만 지정하며, 기존 앞머리가 완전히 덮는 영역에만 연결한다.
생성 결과의 새 눈·입·턱은 사용하지 않는다. 기존 보이는 얼굴 원본을 보존한다.

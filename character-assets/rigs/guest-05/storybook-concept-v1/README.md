# 5번 여성 하객 동화풍 디자인 참고안

상태: 정면 중립 **스타일 참고용**, 리그·파츠·보행·운영 자산 아님. 기존 미완료 소매 후보와 운영 자산은 수정하지 않았다.

사용자가 제안된 디자인 재검토 진행을 승인하여 imagegen 스킬과 built-in 이미지 도구로 정면 콘셉트만 제작했다. 각 호출 전에 해당 방향의 기존 그림을 표시했다. 독립 보행 프레임을 생성하거나 생성된 몸 부분을 잘라 붙이지 않았다.

`front-concept.png`는 원본 생성 파일 그대로다. 해시: `49c46c13c6f36ca2249aa2176d91783286df9e40ceca9d2b003018e58882973f`.

변경 방향: 둥근 볼과 짧은 턱, 작은 코·입, 머리 덩어리 단순화, 사실적 손가락과 주름 축소, 편안한 소매, 둥근 낮은 구두. 세이지·크림 의상과 갈색 번 헤어, 착용자 왼손 가방을 유지했다.

## 검토 결과와 제한

- 처음 두 시안은 투명 영역에 넓은 반투명 빛 번짐이 생겨 프로젝트에 채택하지 않았다. 세 번째 흰 배경 시안은 몸이 길어 추가 수정했다.
- 네 번째는 디자인 참고로 보존한다. 머리 끝 약 y221, 턱 약 y601, 발끝 약 y1294로 **약 2.8등신**이다. 자동 골격 기준인 정확한 3등신 통과로 보고하지 않는다.
- 정확한 머리72/몸144/전체216은 이후 편집 가능한 파츠 설계에서 고정해야 한다. 이 그림을 프레임별 변형하거나 출력 보정해 맞추지 않는다.
- 배경은 의도적인 흰색이며 투명 자산이 아니다. 흰색 배경 제거를 통해 소매·가방을 추출하지 않는다. 원화는 재제작할 파츠의 스타일 기준으로만 사용한다.
- 생성 시안은 정면만 있다. 측면·후면·보행·기존 맵 대비는 검증되지 않았다. 기존 소매 후보의 맵 회귀도 해결되었다고 주장하지 않는다.
- `review.html`은 전체 캐릭터 표시 높이를 맞춘 192×288, 96×144, 48×72 비교다. PNG는 수정하지 않고 화면 배치만 한다.

## 생성 기록

최종 결과 ID: `exec-26caa36d-b9ad-4693-a499-96b6d614a4c3`.

첫 방향 프롬프트는 기존 정면을 참조하여 세이지 드레스 하객을 둥근 얼굴·단순한 머리·편안한 소매·작은 손·둥근 플랫 구두의 부드러운 2D 동화풍으로 바꾸되 3등신과 왼손 가방을 유지하도록 지정했다. 이어서 배경 번짐 제거, 흰 배경 콘셉트 분리, 긴 몸 비율 수정 순서로 반복했다.

최종 프롬프트:

> Keep this character's HEAD exactly unchanged. Redraw only below the chin MUCH SHORTER: chin-to-soles must be exactly TWO times crown-to-chin. Compact three-head-tall cozy game character, not tall fashion figure. Shorter torso, shorter skirt and legs, slim relaxed arms, tiny hands. Preserve sage dress, cream bolero, left bag, ivory rounded flats, front neutral feet level and white background. Same gentle clean 2D painting. Do not increase head size or hair volume. No text.

위 프롬프트의 정확한 비율 요구를 생성 모델이 완전히 지킨 것은 아니다. 리그 구현 승인이나 배포 완료를 뜻하지 않는다.

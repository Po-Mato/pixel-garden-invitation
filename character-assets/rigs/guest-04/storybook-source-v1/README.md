# 4번 차콜 정장 · 페인팅 원본 연구

최근 렌더 검수: 4번 변경 전후 4방향을 별도로 확인하고 원본 전체 축소
샘플링(`sourceSamplesPerOutputPixel=2`)을 적용했다. 어깨·소매·바지의
점상 끊김이 줄었고 14개 구조 검사를 다시 통과했다. 원본 좌표와 골격은
동일하다. 기존 브라우저 캡처는 샘플링 변경 전이므로 최신 UI 검수는 남아 있다.

운영 미반영. 공용 머리72·몸144·전체216px 골격을 유지하고 검은 가운데 가르마, 차콜 정장과 흰 셔츠·어두운 넥타이를 보존한다. 오래된 성인 턴어라운드는 검은 이너이지만 현재 `guest-character-presets.json`의 선택 화면 기준 `reference/guest-directions/masculine-charcoal-blazer/down.png`는 흰 셔츠·어두운 넥타이다. 현재 기준을 우선했다. 이전 부품의 버건디 넥타이를 무조건 계승하지 않는다.

`sources` 원본 + `masks` 편집 가능한 커버리지 + 등록 JSON → 공용 렌더러 → `generated` 순서다. 네 방향 머리는 독립 원화이며 균일 배율로 같은 head 관절에 등록한다. `walkDirections`는 팔다리가 모두 등록되기 전에는 비워 두며, 불완전한 시트는 출력하지 않는다.

내장 imagegen만 사용했다. 별도 API·구매 에셋 없음. 생성 전에 해당 방향의 기존 파츠를 표시했다.

- head-front: `46a8cfe9-25f7-455b-b597-eab7c4d07362`. “One FRONT game character HEAD source. Young man with reference 1's soft black center-parted curtain hair, warm brown eyes and small closed smile. Match reference 2's cute compact face proportions and soft painted game style, but keep the black center part distinct. No neck, body or labels. Transparent background.”
- head-left: `8196b13f-b812-4b6c-a66c-1826e581a5b5`. “Same young man's game HEAD in exact LEFT profile, nose pointing left, one brown eye and a small closed smile. Keep soft black center-parted curtain hair, compact rounded skull, neat short nape and the same cute painted face style. No extra crown height, no neck or body. One source part, transparent background.”
- head-right: `9014f6d8-0491-47f1-a498-7ebdadeb1915`. “Same young man's game HEAD in exact RIGHT profile, nose pointing right, one brown eye and a small closed smile. Draw the opposite side of his soft black center-parted curtain hair, not a mirror. Compact rounded skull and neat short nape, same cute painted style, no extra crown volume. No neck or body, transparent background.”
- head-back: `ef137d9f-8758-4451-9799-c5feec72f3c5`. “Same black-haired young man's game HEAD directly FROM BEHIND. Soft black center-parted hair with rounded compact crown, neat short curved nape, small ears. Same painted game palette and head volume as front. No long pointed tail, extra spikes, face or neck. One head source part, transparent background.”
- torso-front: `4b7e4d8c-4500-4d2f-b042-1682540fb7e4`. “Edit only this costume torso palette for the charcoal-suit guest: charcoal gray jacket, dark charcoal tie, white shirt and ivory pocket square. Retain soft painted game shading, relaxed boxy cut, connected lapels and compact shoulders. Torso only, no sleeves or legs. Transparent background.”

## 16프레임 연구 출력

네 방향 몸통·팔다리 32개 등록과 얼굴/앞머리/뒷머리 소유 레이어를 추가했다. 공용 tailored 동작과 painted-tailored 지면 접촉 키프레임을 사용한다. 골격·관절 길이는 변경하지 않았다. 원본 등록 배율은 정해진 관절 간 거리에 대한 균일 배율이며, 프레임별 체형 변형이 아니다.

- 원본 팔레트 변경 대상은 3번의 해당 방향 파츠, 팔레트 기준은 4번 정면 몸통이다.
- 몸통 left: `01e05388-6fba-4adf-a54d-457996ee98aa`; right: `c5cac04b-0339-4859-8494-b39cc04595df`; back: `d9ca0214-ec22-441e-ad11-60cc19ef8a9c`. 방향과 연결된 라펠을 유지한 차콜 의상 원화. 후면은 주머니/허리 다트 없이 완만한 옆선.
- 정면 다리 Left: `3c96aba4-b127-4d76-bf3e-fc9cf92a6f5b`; Right: `fbb6ed0b-b7a3-4300-8f37-4bbaa6580195`. 차콜 바지와 검은 구두, 중립 원화.
- 정면 팔 Left: `149bce13-d74c-46cb-9e9b-3cf7d8272ae5`; Right: `e8d15047-ac9c-43b0-914c-d0ed68788bb9`. 얇은 소매·흰 커프스·자연스럽게 편 작은 손. 오른쪽 프롬프트: “Change only this RIGHT front-view sleeve's navy cloth to reference 2's charcoal gray suit palette. Preserve thin neutral arm, white cuff, small relaxed hand and thumb pointing image-right. Same soft painted game style. One source part only, transparent background.”
- 왼쪽 다리: `3f14e921-c84f-4dde-a501-3c84c2525695`. “Repaint only this LEFT profile trouser leg to reference 2's charcoal gray suit palette. Preserve straight relaxed shape, knee fold, rounded black oxford pointing left and flat sole. Same soft painted game shading. One neutral leg source, transparent background.”
- 오른쪽 다리: `04d0d81e-b1d4-47b4-926e-96048e476db1`. “Repaint only image 1's RIGHT profile trouser leg to image 2's charcoal gray cloth palette. Preserve straight relaxed shape, knee fold, rounded black oxford pointing right and flat sole. Same soft painted game shading. One neutral leg source part on genuinely transparent background; no checkerboard.”
- 후면 다리: `a0ac8aac-139a-455f-bae2-367ce6a91ace`. “Change only image 1's BACK-view trouser leg navy cloth to image 2's charcoal gray suit palette. Keep neutral straight leg, rear heel of rounded black oxford, flat sole, soft painted game shading. One source part only on genuinely transparent background, no checkerboard.”
- 왼쪽 팔: `01079b2e-1c50-490a-a5df-0c83638de502`; 오른쪽 팔: `b64f0bef-ee90-4f4f-b977-5bc0d5b765a1`. 프롬프트는 “Change only image 1's LEFT/RIGHT profile sleeve navy cloth to image 2's charcoal gray palette. Preserve thin relaxed sleeve, white cuff, small natural hand and thumb pointing image-left/image-right. Same soft painted game style. One neutral source part on genuinely transparent background, no checkerboard.”에서 각 방향만 선택했다.
- 후면 왼팔: `02fb1d4c-fa61-4867-8602-14c54b3cea6b`; 후면 오른팔: `ac8d80f2-70e3-474e-a948-ff916b10d9b7`. 프롬프트는 “Change only image 1's BACK-view left/right sleeve navy cloth to image 2's charcoal gray suit palette. Keep thin straight relaxed arm, white cuff, small hand seen from behind with thumb image-right/image-left. Same painted game shading. One source part on genuinely transparent background, no checkerboard.”에서 각 방향과 엄지를 대응했다.

일부 원본은 투명 요청에도 체크/흰 배경이 포함되었다. 이들만 닫힌 외곽선 기반 SVG 커버리지를 별도로 작성했다. 흰색 색상 키잉을 하지 않으며 내부 흰 커프스·피부를 보존한다. 초안 검수에서 손 누락과 배경 잔여물을 발견해 원본 마스크를 수정했다. 흰 커프스/손/엄지 틈 회귀 검사도 추가했다. PNG 프레임 복사나 부위 교체는 없다.

`generated/walk-study.png`는 768×1152, 선택/게임 축소 시트는 384×576 및 192×288이다. `review.html`은 연구용 네 방향·재생/정지·밝은/어두운 배경과 실제 표시 크기 검수다. 4번 구조 검사 13개, 3/5번과 마스크 포함 전체 연구 검사 52개 통과. 실제 선택 화면·맵·서비스 워커·최종 배포 검수로 간주하지 않는다. 숨겨진 머리 표면과 헤어 소유 경계는 추가 검수가 필요하며 독립 머리카락 애니메이션은 허용하지 않는다. 아직 운영 적용 완료 캐릭터가 아니다.

2026-09-12 추가 검수: 390×844 연구 화면에서 재킷 아래 사각형 골반 연결부의
노출을 직접 발견했다. 이 캐릭터의 front/profile 원본 SVG만 허벅지 시작 관절을
덮는 194px까지로 수정했다. 골격·다리 길이·보행 키와 다른 캐릭터 원본은 불변.
14개 보행 검사 통과. 수정 전 sampling-v3와 수정 후 pelvis-v4 화면을 구분해 보존했다.
수정 후 네 방향, 어두운/크림 배경, 96×144·48×72 표시를 직접 확인했다.
재생·정지 동작, 가로 넘침 없음 및 이미지 로드를 확인했고 전용 브라우저는 종료했다.
증거: generated/browser-pelvis-review.json 및 mobile-*-pelvis-v4.png 5장.
운영 선택/맵 검수나 최종 시각 승인을 의미하지 않는다.

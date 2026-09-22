# 11번 그린 블레이저 · 페인팅 원본 연구

운영 미반영. 현행 프리셋의 검은 헤어, 딥 그린 재킷·넥타이, 아이보리 셔츠, 크림 바지, 브라운 구두를 유지한다. 공용 72/144/216px 골격과 정장형 보행을 사용한다. 원화와 SVG 마스크·등록 JSON은 편집 원본이며 `generated`는 자동 출력이다.

내장 imagegen만 사용했다. 별도 과금 API·에셋 구매 없음. 매 생성 전에 해당 방향의 기존 원본을 먼저 표시했다.

| 원본 | 생성 ID | 프롬프트 핵심 |
| --- | --- | --- |
| head-front-v1 | f6d4e469-e13e-4783-8615-22a99bc8f343 | FRONT head for green-blazer guest: neat short black curtain-part hair, brown eyes, small closed smile, compact painted game style, fewer spikes, no neck/body, transparent. |
| head-left-v1 | 0f93c268-8fbb-4a3a-9229-083c5fd26007 | Same guest exact LEFT profile, preserve black curtain part and brown eye; compact profile, smooth short nape, no extra crown, no neck/body, transparent. |
| head-right-v1 | 7da1cf63-2a09-49b0-811a-f1af2e58d912 | Same guest exact RIGHT profile, opposite side of part, do not mirror; short nape, no extra crown, transparent. |
| head-back-v1 | e9301f71-f424-4cc9-ba17-4e0986669517 | Same guest FROM BEHIND, rounded black hair, curved nape, small ears, compact painted shading; no pointed tail, face or neck, transparent. |
| torso-front-v1 | a0620b61-f1bc-42af-a225-268fe49d4f95 | Change beige jacket source to deep forest green with dark green tie, ivory shirt/square and brown buttons; compact relaxed connected cut, torso only, transparent. |

왼쪽·오른쪽 머리는 체크무늬가 원본 RGB에 포함되어 각 원본의 닫힌 잉크 윤곽으로 SVG 커버리지를 작성했다. 흰색 의상을 RGB 색상으로 제거하지 않는다. 후면 턱 평면은 보이지 않는 해부학적 기준이며 뒷머리 끝으로 머리를 다시 확대하지 않는다.

## 몸 파츠 원본과 프롬프트

내장 도구로 아래 개별 원화만 제작했다. 9번은 정장형 파츠 구성·회화 스타일 참고, 11번 기존 방향 자료는 의상·구두 정체성 참고다. 모든 프롬프트는 `genuinely transparent background`를 요청했다. 원본은 `sources/<이름>.png`, 편집 마스크는 `masks/<이름>.svg`에 있다.

| 이름 | 생성 ID | 요청 |
| --- | --- | --- |
| torso-left-v1 | a14186cc-ec9a-441e-8e15-9cdd88a3ae62 | LEFT profile, deep forest-green jacket/dark green tie, ivory collar, brown buttons, straight relaxed side, connected lapels, plain shoulder underlap, no chest pocket or armhole ring. |
| torso-right-v1 | 6d8bb511-2930-413e-bc68-40fafae7a407 | RIGHT profile, same forest-green costume, ivory chest square, straight side, plain shoulder underlap, no armhole ring. |
| torso-back-v1 | 7f43c642-1fc1-458d-a3e2-198107c49fea | BACK torso, forest green/ivory collar, relaxed straight back, connected shoulders, no extra pockets/arms/legs. |
| legLeft-front-v1 | 5311a63a-8364-494c-96ec-95cbd5d7e5dc | Anatomical LEFT front leg, neutral straight relaxed leg, ivory cream trousers, rounded brown lace-up oxford, flat sole, subtle folds. |
| legRight-front-v1 | b499003c-f181-4a06-8888-3e64daf86706 | Anatomical RIGHT front leg, same cream trousers/brown oxford, neutral straight pose and flat sole. |
| leg-left-v1 | 314fb5cf-8ff0-49f4-99cf-d06de3d27f5a | LEFT profile leg, painted style, ivory cream trousers, brown lace-up oxford, straight neutral leg, flat sole. |
| leg-right-v1 | effb9f7f-eb9a-4741-bad3-e8abf87794c0 | RIGHT profile leg, painted style, ivory cream trousers, brown lace-up oxford, straight neutral leg, flat sole. |
| leg-back-v1 | 93da9cd2-1664-445f-8aee-eb70c64a041a | BACK leg, ivory cream trousers, dark brown oxford heel, flat sole, subtle folds. |
| armLeft-front-v1 | fecfb95a-1d67-49f2-85f0-5a5e7ddb8768 | Anatomical LEFT front sleeve, forest green, slim relaxed arm, ivory cuff, natural hand, no shoulder hole. |
| armRight-front-v1 | 1d48c555-7f28-4d47-a49c-745e254e6926 | Anatomical RIGHT front sleeve, same green, slim relaxed arm, ivory cuff, natural hand. |
| arm-left-v1 | e6cf3493-b31f-4953-9982-c8f52ee23409 | LEFT-facing near RIGHT arm, forest-green slim sleeve, ivory cuff, three brown buttons, relaxed hand, rounded underlap. |
| arm-right-v1 | ea5cdc0a-215b-4ebc-ac41-8496ae0b0aad | RIGHT-facing near LEFT arm, same green, ivory cuff, three brown buttons, relaxed hand, no muscular bulge. |
| armLeft-back-v1 | fd92a67a-aebf-47bd-9ac7-dfff6628d3d2 | Change only cuff buttons from two to three matching small brown buttons. Preserve BACK LEFT arm, hand anatomy, green sleeve, ivory cuff, shape, shading and framing. |
| armRight-back-v1 | f55e160f-d482-4756-a9c6-ee2ef41be79d | BACK anatomical RIGHT arm, slim relaxed shape, forest-green sleeve, ivory cuff, small brown buttons, natural hand, no mirror. |

후면 왼팔 초안 `86074b4f-da99-4a58-a2c6-9bd7fbafc0d6`은 단추가 두 개라 적용하지 않았다. 원본 수정 요청 후 세 개가 된 결과만 사용한다.

## 원본 등록과 검수

- 32개 방향별 몸 파츠를 공용 골격에 연결하고 12개 관절 바인딩으로 정장형 공용 보행 16프레임을 자동 출력했다. 머리 레이어는 각 방향 원화에 직접 작성한 소유 영역이며 독립 변형은 금지한다.
- 일부 새 원화는 실제 투명 픽셀과 불투명 체크 배경이 섞여 있다. 이 원본만 `--mixed-outline`로 닫힌 윤곽의 SVG 마스크를 작성했다. 배경 색상 키 제거는 사용하지 않는다. 혼합 배경·흰색/크림 보존 회귀 검사 4개 통과.
- 고해상도 파츠를 SVG에서 급격히 축소할 때 어깨의 가는 잉크가 점선처럼 보였다. 11번에만 `sourceSamplesPerOutputPixel: 2`를 지정해 전체 원본 레이어를 Lanczos로 미리 필터링한 뒤 같은 원본 좌표·피벗·균일 배율로 렌더링한다. 완성 프레임 보정이 아니다. 다른 캐릭터는 검토 전 자동 적용하지 않는다.
- `STORYBOOK_GUEST_ID=guest-11 node --test scripts/storybookSourceStudy.test.mjs`: 14/14 통과. 72/144/216px, 발 기준선, 2·4 동일, 교대 보폭, 12관절, 네 방향 원본과 머리 색·알파 보존 포함.

연구 자료의 검사 통과는 운영 승인과 다르다. 숨은 두피 원화, 머리 레이어 경계, 반대편 손 해부학, 실제 선택 화면·맵·서비스 워커와 전체 배포 검수는 남아 있다. `runtimeEligible`과 `visualApproved`는 계속 false다.

390×844 로컬 브라우저에서 네 방향·수동 프레임 선택·재생 시 1~4번 순환, 이미지 로딩, 가로 넘침 없음, 192×288·96×144·48×72 표시를 확인했다. 캡처는 `generated/mobile-*.png`, 기록은 `generated/browser-review.json`이다. 첫 세션의 정지 명령은 브라우저 연결 오류로 실패했지만 새 전용 세션에서 재생 후 정지하고, 정면 1번이 고정됨과 `aria-pressed=false`를 다시 확인했다. 크림 배경의 실제 표시 크기도 `mobile-front-cream-paused.png`로 검수했다. 사용한 두 세션은 모두 닫았다.

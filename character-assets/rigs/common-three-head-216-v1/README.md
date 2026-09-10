# 정확한 3등신 공용 골격

2026-09-10 사용자가 머리 72px·몸 144px·전체 216px와 골격 변경을 확정하고 세부 구현 판단을 위임했다. 이전 84/168/252 및 머리만 72px로 선언했던 지침보다 우선한다.

## 편집 원본과 생성물

- `skeleton.json`: 192×288 캔버스, 머리 y54–126, 몸 y126–270, 발 기준선 y270, 방향별 관절 투영.
- `animations/`: 의상 유형별 공용 보행. 다른 캐릭터를 위해 별도 보행을 새로 만들지 않는다.
- `../guest-NN/three-head-216-v1/*-rig.json`: 캐릭터의 원본 파츠 경로·UV·부모 관절·피벗·레이어·의상 부착물.
- 각 캐릭터의 `generated/`: 원본 리그에서 출력한 SVG/PNG와 알파·발 위치 진단. 편집 입력으로 사용하지 않는다.
- 각 캐릭터의 `review/`: 768×1152 보행 시트, 192×288 게임용 시트, 390×844 검수 화면과 현재 파일 해시.

기존 원본의 실제 머리 아래 구간은 y98–270(172px)이었으므로 새 바인딩은 이를 y126–270(144px)로 옮겼다. 과거 JSON의 몸 168px 선언을 실제 원본 좌표인 것처럼 사용하지 않았다. 공용 관절 좌표는 편집 JSON에 고정되며 렌더링 중 이미지 크기나 프레임별 외곽으로 다시 계산하지 않는다.

원본 PNG는 변경하지 않는다. 새 원화가 필요하면 독립 파츠만 버전 파일로 저장한다. 투명 여백의 명시적 UV 등록과 원본 파츠 조립은 가능하지만, 출력 PNG의 신체 영역 복사·교체·크기 보정은 금지한다.

## 재현 명령

- 3번: `pnpm characters:render-three-head-216`.
- 개별 방향: `node scripts/render-guest-three-head-216-parts.mjs guest-05 front`.
- 시트: `node scripts/build-guest-three-head-216-review.mjs guest-05`.
- 12명 후보 재생성: `pnpm characters:build-three-head-216-candidates`.
- 골격·재질·브라우저 증거 검사: `pnpm characters:test-three-head-216`.
- 모바일 검수 캡처: `node scripts/capture-three-head-216-mobile.mjs guest-05`.
- 실제 UI 파일럿: `pnpm --filter @wedding-game/client exec vite --config vite.guest216-pilot.config.ts --host 127.0.0.1 --port 5196`.
- 실제 선택 화면을 연 다음 `node scripts/capture-three-head-216-selection.mjs`.
- 실제 게임 검수: `node scripts/capture-three-head-216-game.mjs`. 자체 검수 브라우저 guest216app의 로컬 게임 진행 상태를 사용한다.
- 실제 축소 시트 검수: 위 Vite 명령에 `--mode guest216-runtime --port 5197`을 사용한 뒤 `node scripts/capture-three-head-216-game.mjs --staged-runtime`. 별도 guest216runtime 세션과 별도 증거 파일을 사용한다.

## 현재 상태

12명, 192프레임의 골격 연결과 로컬 선택/게임 보행 검증을 완료했다. 의상 명암·브라우저 맵 대조·실제 축소 시트 이동·12번 전 구역 이동·88개 운영 형식 후보 패키지까지 164개 규격/증거 검사가 통과했다. 클라이언트 1,367개와 프로덕션 빌드를 재검증했고, 맵 82개 및 타입 검사도 앞선 실행에서 통과했다. 브라우저 합성 최소 대비는 기본/6개 표시 조건 모두 통과했으나 기존 회귀 모델의 556개 이슈는 그대로 남아 있다.

수치 통과와 최종 시각 승인은 다르다. 12번 소매는 방향별 5번 공용 크림 소매 원본으로 교체하여 정장 단추를 제거했다. 전통적인 넓은 한복 소매/바지를 새로 제작한 것은 아니다. 추가 생성 실패본은 프로젝트에 저장/적용하지 않았다. 맵 대비와 전체 시각 검수는 별도 실패/미검증 항목을 유지한다.

맵 회귀 모델: `node scripts/audit-guest-three-head-216-maps.mjs`. 브라우저 필터 대조 도구: `node scripts/build-guest-three-head-216-map-review.mjs` 실행 후 `map-browser-review.html`을 연다. 브라우저 대조는 별도 합성이며 실제 게임 전체 맵 이동 증거가 아니다. 어떤 도구도 기존 기준을 완화하거나 운영 자산을 수정하지 않는다.

자세한 최신 진행 및 캐릭터별 관찰은 `../../../docs/guest-three-head-216-progress.md`, `../../../docs/guest-three-head-216-visual-review.md`를 본다. 현재 후보는 개발 전용이며 운영 자산·Git 이력·Worker 배포를 변경하지 않았다. 전체 맵/시각 회귀/운영 SW/릴리스 완료가 아니다.

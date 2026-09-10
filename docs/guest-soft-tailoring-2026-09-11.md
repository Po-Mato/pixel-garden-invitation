# 하객 캐릭터 부드러운 의상 개선

## 범위와 판단

사용자가 2026-09-11 시각적 판단과 진행을 위임했다. 중간 승인 질문 대신 3번 파일럿을 먼저 직접 검수하고 확장한다. 완료·배포 판정은 전체 검사 이후 별도로 기록한다.

- 머리 72 / 몸 144 / 전체 216px, 캔버스 192×288, 발 기준선 270을 유지한다.
- 얼굴·머리, 관절 피벗과 길이, 보행 키프레임은 변경하지 않는다.
- 최종 PNG 보정 없이 원본 의상 파츠와 비파괴 옷감 명암 레이어를 수정하고 다시 렌더링한다.
- 3번: 정면 재킷 원화의 허리 조임·미세 질감 완화. 기존 팔 파츠의 팔꿈치 주름과 후면 원화의 등 안쪽 주름에는 리그의 soft-fabric 재질을 적용한다. 팔의 형태·폭·피벗, 측면, 외곽, 목, 중앙 봉제선은 보존한다.
- 4번: 해당 캐릭터의 차콜 후면 재킷 원화를 별도로 수정해 가로 등 주름을 완화한다. 팔 폭은 보존한다.
- 9번: 해당 캐릭터의 베이지 후면 재킷 원화를 별도로 수정해 가로 등 주름을 완화한다. 팔 폭은 보존한다.
- 11번: 기존 초록 재킷은 이미 등 주름이 약하므로 원화와 팔 폭 모두 보존한다.
- 1·2·5·6·7·8·10·12번: 기존 원피스·스커트·한복 형태와 장식 유지. 무조건적인 체형 축소나 정장용 변경을 적용하지 않는다.

소매 폭 축소 후보는 맵 대비 회귀를 일으켜 거부하고 원래 폭으로 복원했다. 외곽 음영 강화 실험도 채택하지 않았다. 허용치나 맵 기준 이미지를 변경하지 않고 원본 리그 쪽을 수정했다. 각 캐릭터의 자체 원화와 연결부를 별도로 검수한다.

## 원본과 재생성

새 원화는 각 `character-assets/rigs/guest-NN/three-head-soft-tailoring-v1/parts/`에 저장한다. 기존 원화는 삭제하거나 덮어쓰지 않는다. 활성 `three-head-216-v1/*-rig.json`이 새 파츠를 참조한다.

3번의 소매 폭 축소 초기 후보는 맵 회귀 때문에 최종 채택하지 않았다. 로컬 연구 자료는 보존하되 릴리스에는 포함하지 않는다. 활성 리그를 재생성하는 명령은 다음과 같다.

```sh
pnpm characters:generate
pnpm characters:audit-cutouts
```

원화 제작은 built-in image_gen을 사용했다. 각 호출 전 해당 방향의 기존 원본을 표시했다. 기본 프롬프트는 해당 의상 파츠의 색·실루엣·관절 연결 위치를 유지하면서 근육처럼 보이는 주름과 사실적 미세 질감을 완화하도록 제한했다. 완성 보행 프레임은 생성하지 않았다. 체크무늬가 실제 픽셀로 포함된 불투명 결과와 색이 변한 결과는 거부하고 프로젝트에 적용하지 않았다. 알파가 있는 원화도 맵 대비에 실패한 경우 최종 채택하지 않았다. 최종 채택한 새 원화 3개는 실제 알파 채널과 흰 셔츠·칼라 보존을 검사한다. 후면 soft-fabric은 원본 파츠 내부에만 적용되는 편집 가능한 SVG 재질이다. 렌더링 전 원본 알파를 보존하며 목·봉제선·실루엣을 명암 처리 영역에서 제외한다. 생성된 프레임을 읽거나 보정하지 않는다.

## 검수 상태

3번 후보: 밝고 어두운 배경의 16프레임을 직접 확인했다. 390×844 브라우저에서 192×288·96×144·48×72 표시와 보행 1~4 재생·중립 정지를 확인했다. 자동 검사는 별개로 높이, 머리 원화 보존, 목 연결, 반대 발 전진, 고정 기준선, 중심 이동 제한을 확인한다.

최종 원본 출력의 3·4·9번 16프레임, 전체 12명×4방향 실제 모달 접촉표를 별도로 눈으로 확인했다. 얼굴·머리 왜곡, 목 투명 단절, 재킷 연결부 끊김, 비대칭 가방 방향 반전은 관찰되지 않았다. 각 방향 실제 이동과 1~4프레임 재생·정지를 브라우저에서 검증했다. 자동 측정만으로 미적 품질을 판정하지 않았다.

변경 전후 자료: `character-assets/rigs/common-three-head-216-v1/release-review/soft-tailoring-before-after.png`. 기존 배포와 현재 브라우저 스크린샷을 검수용으로 나란히 배치한 것이며, 캐릭터 파츠나 생성 자산을 수정하지 않는다. `node scripts/render-guest-soft-tailoring-comparison.mjs`로 재생성한다.

| 캐릭터 | 개별 검수 판단 |
| --- | --- |
| 1 | 크림 원피스·가방·흰 의상 보존, 네 방향 유지 |
| 2 | 여성 한복·치마 윤곽 보존, 네 방향 유지 |
| 3 | 정면 미세 질감·팔꿈치 주름·후면 등 주름 완화, 머리·골격 유지 |
| 4 | 차콜 후면 등 주름 완화, 원래 팔 폭·앞면·측면 유지 |
| 5 | 녹색 스커트와 크림 상의 보존, 네 방향 유지 |
| 6 | 네이비 스커트·가방 보존, 네 방향 유지 |
| 7 | 라벤더 스커트와 장식 보존, 네 방향 유지 |
| 8 | 분홍 스커트·크림 상의 보존, 네 방향 유지 |
| 9 | 베이지 후면 등 주름 완화, 원래 팔 폭·앞면·측면 유지 |
| 10 | 청색 원피스·머리·흰 소매 보존, 네 방향 유지 |
| 11 | 기존 녹색 재킷의 완만한 주름을 유지, 일괄 축소 후보 거부 |
| 12 | 남성 한복과 흰 소매 보존, 네 방향 유지 |

머리 보존 기준은 이전 배포 커밋 `4c19619f76f138f5f98976a4289340e9dded4435`의 출력에서 읽은 해시와 골격·키프레임으로 고정했다. 검사를 통과시키기 위해 픽셀을 복사하거나 허용치를 변경하지 않는다.

선택 화면 검수 스크립트의 오래된 HD 파일럿 예상치 96×144는 기존에 승인되어 배포된 모달의 실제 160×240과 일치하도록 수정했다. UI 크기 변경이나 시각 허용치 완화가 아니다. 게임 표시는 48×72를 유지한다.

검증 기록:

- 새 재질·원화·기존 골격 보존 테스트 11개 통과.
- 전체 12명 캐릭터·런타임·맵 브라우저 증빙 검사 175개 통과.
- 실제 운영형 미리보기 선택·게임·자산 해시 검사 12개 통과.
- 10개 맵×12명×4방향×4프레임, 총 1,920개 대비 측정: 회귀 0건. 기존 허용치와 기준 파일 유지.
- 모바일 시각 회귀 0.001% 변경(기존 허용 0.500%), 월드 배치 0.000% 변경.
- 커밋 대상만 내보낸 독립 디렉터리에서 오프라인 고정 버전 설치 후 원본부터 재생성. 캐릭터 검사 및 175개 증빙 검사 통과, 생성 PNG 88/88개가 작업 디렉터리와 바이트 단위로 일치.

- 전체 `pnpm test` 통과: 맵·캐릭터·사진·시각 회귀·공유 모듈·클라이언트·Worker 포함. 공유 모듈 81개, 클라이언트 1,368개, Worker 262개 통과.
- 전체 `pnpm typecheck` 통과.
- 독립 복사본의 모바일 HUD 9개 화면 검사 통과(390×844, 작은 Android, 가로 화면, 태블릿, 글자 확대 포함).
- PWA 새 설치 프리캐시 84/84 및 오프라인 진입/게임 재실행 통과. 깨진 업데이트 거부·정상 서비스 워커 교체·캐시 롤백 검사 통과.

- 전체 `pnpm build` 통과. 빌드 후 생성물 88/88개를 독립 복사본과 다시 비교해 모두 일치함을 확인했다.

위 결과는 이 변경의 로컬 검증 기록이다. 원격 CI·배포·운영 자산 및 서비스 워커 확인은 배포 실행과 최종 완료 보고를 기준으로 하며, 이 문서만으로 원격 배포 완료를 주장하지 않는다.

## 채택 원화 출처

각 원본 표시 후 built-in image_gen으로 아래 개별 파츠만 편집했다. 결과를 리사이즈·잘라 붙이기·픽셀 보정 없이 원본으로 저장했다.

| 원본 파츠 | 생성 결과 ID | SHA-256 |
| --- | --- | --- |
| 3번 정면 torso.png | exec-24108a70-ff25-409c-bf63-f106c0b6c809 | c8a1e08dcd155a4ce4ff1a478c190de4a568b52ccbf9681650c0020ea1cd07de |
| 4번 후면 torso.png | exec-3276398c-8199-4c3b-a87f-9c321984c488 | 15e6c5fa6f86ee2d62d97625fd0cdf6e2526fcb2a5bf45325523c562903df27b |
| 9번 후면 torso.png | exec-d3f70464-cc62-4d26-9d33-4c45b83a8c47 | 370eeb7298a9e7975321794997df671502329f9b00f8b940f81a7f48646e6db2 |

프롬프트:

- 3번: “Isolated front navy suit torso game rig part. GENUINE RGBA TRANSPARENT BACKGROUND: alpha zero outside clothing, never draw checkerboard or white backdrop. Preserve white shirt, navy palette, collar/tie/pocket-square and exact placement/height. Gently straight relaxed waist, soft painted 2D shading, no fabric microtexture, no muscular chest. No head or arms, no scene.”
- 4번: “Charcoal rear jacket rig PART. Smooth relaxed back fabric, remove horizontal muscle folds and microtexture. Preserve charcoal color, silhouette, white collar, center seam, exact placement. OUTPUT REAL TRANSPARENT PNG with alpha=0 outside clothing, not a checkerboard picture. No background or glow.”
- 9번: “Taupe rear jacket rig PART. Smooth relaxed back fabric, remove horizontal muscle folds. Preserve taupe color, silhouette, white collar, center seam, exact placement. OUTPUT REAL TRANSPARENT PNG with alpha=0 outside clothing, not a checkerboard picture. No background or glow.”

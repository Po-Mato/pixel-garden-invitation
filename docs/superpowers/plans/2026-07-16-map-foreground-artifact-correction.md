# 맵 전경 아티팩트 보정 구현 계획

> **에이전트 작업 지침:** 이 계획은 현재 세션에서 작업별로 분리 실행하며 각 작업 후 시각 검수와 테스트를 수행한다.

**목표:** 10개 맵의 깊이 가림 구조를 유지하면서 동네 수관, 지하철 개찰구 전면, 로비 안내데스크 전면의 형태와 배치를 보정한다.

**구조:** 기존 `manifest.json`과 맵 런타임 구조는 유지한다. 세 전경 원본만 배경 기준으로 다시 제작하고 `maps:build`로 정해진 출력 크기를 생성한 뒤, 필요한 경우에만 `world.ts`의 앵커를 최소 조정한다.

**기술 스택:** PNG/WebP, Sharp, Node.js, React, TypeScript, Vitest

## 전역 제약

- 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 새 worktree를 만들지 않는다.
- 정상 전경 자산과 배경은 변경하지 않는다.
- 맵 크기, 충돌 영역, 포털, 미니맵, 캐릭터 이동 계약은 유지한다.
- 사용자 요청 전에는 커밋하거나 푸시하지 않는다.

---

### 작업 1: 재현 가능한 전체 맵 시각 감사 도구

**파일:**
- 생성: `scripts/render-map-foreground-audit-sheet.mjs`
- 수정: `package.json`

**인터페이스:**
- 입력: `client/public/assets/maps/v2`와 `client/src/game/world.ts`에 정의된 전경 배치 계약
- 출력: `.superpowers/character-review/map-foreground-artifact-audit.png`

- [ ] **1단계:** 10개 배경 위에 실제 앱과 같은 좌표로 전경 PNG를 합성하는 Sharp 기반 렌더러를 작성한다.
- [ ] **2단계:** `maps:foreground-audit` 스크립트를 추가한다.
- [ ] **3단계:** 명령을 실행해 10개 맵, 10개 배경, 모든 전경 인스턴스가 포함된 시트를 생성한다.
- [ ] **4단계:** 시트에서 정상 7개 맵과 보정 대상 3개 맵을 다시 판정한다.

실행:

```bash
pnpm maps:foreground-audit
```

예상 결과: 감사 시트 PNG가 생성되고 프로세스가 종료 코드 0으로 끝난다.

### 작업 2: 세 전경 원본 재제작 및 출력 생성

**파일:**
- 수정: `map-assets/reference/v2/neighborhood/tree-canopy-source.png`
- 수정: `map-assets/reference/v2/subway-station/ticket-gate-front-source.png`
- 수정: `map-assets/reference/v2/lobby/reception-desk-front-source.png`
- 생성 갱신: 각 존의 대응 `client/public/assets/maps/v2/<zone>/*.png`

**인터페이스:**
- 입력: 각 전경 원본과 해당 배경 크롭
- 출력: 기존 매니페스트 파일명·크기·투명도 계약을 만족하는 PNG

- [ ] **1단계:** 각 대상 배경과 전경 원본을 개별 표시하고 보존할 외곽·색조·연결점을 기록한다.
- [ ] **2단계:** 내장 이미지 편집 도구로 수관을 차분한 녹색, 자연스러운 비대칭 수관, 중앙 하단 줄기 연결점으로 다시 제작한다.
- [ ] **3단계:** 개찰구 전면을 배경 개찰구와 같은 회색 금속, 동일 폭, 위에서 내려다보는 원근으로 다시 제작한다.
- [ ] **4단계:** 안내데스크 전면을 배경 상판과 같은 아이보리·골드, 대칭 곡률, 중앙 꽃 장식으로 다시 제작한다.
- [ ] **5단계:** 단색 키 배경을 제거하고 알파 모서리·내부 빈 공간·색 번짐을 검사한다.
- [ ] **6단계:** `pnpm maps:build`를 실행해 앱 출력 자산을 갱신한다.
- [ ] **7단계:** `pnpm maps:audit && pnpm maps:test`로 크기와 알파 계약을 검증한다.

예상 출력 크기:

```text
neighborhood/tree-canopy.png                  90x150
subway-station/ticket-gate-front.png          60x120
lobby/reception-desk-front.png               180x120
```

### 작업 3: 앵커 최소 보정과 회귀 테스트

**파일:**
- 조건부 수정: `client/src/game/world.ts`
- 조건부 수정: `client/src/game/world.test.ts`
- 조건부 수정: `client/src/components/GameWorld.test.tsx`

**인터페이스:**
- 입력: 작업 2에서 생성한 전경 PNG의 가시 알파 경계
- 출력: 배경 본체 중심과 일치하는 전경 배치 및 기존 깊이 순서

- [ ] **1단계:** 수관 3개, 개찰구 3개, 안내데스크 1개의 합성 중심과 접합선을 측정한다.
- [ ] **2단계:** 오차가 있는 항목만 `x`, `y`, `width`, `height`, `depthY`를 수정한다.
- [ ] **3단계:** 수정된 값과 깊이 계약을 월드 테스트에 반영한다.
- [ ] **4단계:** 클라이언트 테스트를 실행한다.

실행:

```bash
pnpm --filter @wedding-game/client test
```

예상 결과: 전체 클라이언트 테스트 통과.

### 작업 4: 전체 맵 및 모바일 최종 검증

**파일:**
- 갱신: `.superpowers/character-review/map-foreground-artifact-audit.png`

- [ ] **1단계:** 전체 감사 시트를 다시 생성해 정상 자산 7개가 변하지 않았는지 확인한다.
- [ ] **2단계:** 390x844 모바일 뷰포트에서 동네, 지하철 역사, 로비를 캡처한다.
- [ ] **3단계:** 나무 줄기·화단, 개찰구 하우징, 안내데스크 상판의 연결부가 어긋나지 않는지 눈으로 확인한다.
- [ ] **4단계:** 타입 검사와 프로덕션 빌드를 실행한다.

실행:

```bash
pnpm typecheck
pnpm build
```

예상 결과: 타입 오류 없이 모든 패키지 빌드 통과. 배포와 커밋은 수행하지 않는다.

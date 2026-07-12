# Dawn Prism Pixel Garden Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네 구역의 굵고 단조로운 맵 표현을 4~8px 미세 픽셀과 새벽빛 프리즘 팔레트를 사용하는 밝고 상세한 정원으로 교체한다.

**Architecture:** 이동과 충돌 데이터는 변경하지 않고 `styles.css`의 맵 전용 레이어와 장식 도형을 재작성한다. 공통 환경광과 부유 입자는 기존 맵·스테이지·장식 레이어의 가상 요소로 구현하며, 구역별 팔레트는 `world-map--<zone>` 선택자로 분리한다.

**Tech Stack:** React 18, TypeScript, CSS gradients and pseudo-elements, Vitest, agent-browser, Sharp contact sheets

## Global Constraints

- 작업 경로는 `/Users/sjlee/Documents/New project 5`이다.
- 현재 `main` 워크트리에서 작업하고 새 worktree를 만들지 않는다.
- 사용자 요청 전까지 커밋, 푸시, 배포하지 않는다.
- 중간 캐릭터 원안 디렉터리는 수정하거나 삭제하지 않는다.
- 논리 이동 타일은 `30px`, 맵 비율은 `390:720`, 캐릭터 표시는 `48x72px`를 유지한다.
- 맵 시각 반복 단위는 `4px`, `6px`, `8px`를 중심으로 사용한다.
- 카드, 포털, 조작 버튼을 제외한 장식은 검정 `3px` 이상 외곽선을 사용하지 않는다.
- 새 애니메이션은 `prefers-reduced-motion`에서 정지한다.

---

### Task 1: 미세 픽셀 맵 표면 계약

**Files:**
- Modify: `client/src/styles.test.ts`
- Modify: `client/src/styles.css`

**Interfaces:**
- Produces: `.world-map__stage::before`, `.world-map__stage::after`
- Produces: 구역별 `6px` 또는 `8px` 지면 패턴
- Consumes: 기존 `.world-map--entrance|ceremony|gallery|lounge`

- [x] **Step 1: 8px 이하 패턴, 환경광, 프리즘 먼지 레이어를 요구하는 실패 CSS 테스트 작성**
- [x] **Step 2: 기존 30px 패턴 때문에 실패하는지 확인**
- [x] **Step 3: 공통 기저·환경광·미세 디더링·부유 픽셀 레이어 구현**
- [x] **Step 4: 네 구역을 A안 프리즘 팔레트와 미세 패턴으로 재작성**
- [x] **Step 5: CSS 계약 테스트 통과 확인**

### Task 2: 길과 물의 세부 표현

**Files:**
- Modify: `client/src/styles.test.ts`
- Modify: `client/src/styles.css`

**Interfaces:**
- Produces: 4px 모자이크 길, 1~2px 색상 테두리, 꽃잎 가장자리
- Produces: `prism-drift`, `water-shimmer` stepped animations
- Consumes: 기존 `.world-path`, `pond`, `fountain` 장식

- [x] **Step 1: 구역별 4px 모자이크와 물 하이라이트 애니메이션 실패 테스트 작성**
- [x] **Step 2: 현재 12~15px 길 패턴과 단색 물 표현으로 실패 확인**
- [x] **Step 3: 구역별 길 패턴과 얇은 색상 테두리 구현**
- [x] **Step 4: 연못·분수의 수평 물결, 반사광, 수련 세부 표현 구현**
- [x] **Step 5: reduced-motion 정지 계약과 관련 테스트 통과 확인**

### Task 3: 장식 도형 세부화

**Files:**
- Modify: `client/src/styles.test.ts`
- Modify: `client/src/styles.css`

**Interfaces:**
- Produces: `data-detail="fine"` 없이 CSS 선택자만으로 모든 장식 세부화
- Consumes: 기존 26개 `world-decoration--<kind>` 클래스

- [x] **Step 1: 장식 외곽선 두께와 다중 명도 표현을 요구하는 실패 테스트 작성**
- [x] **Step 2: 굵은 3~5px 외곽선으로 실패 확인**
- [x] **Step 3: 나무·화단·아치·토피어리·꽃 장식의 잎과 꽃송이 세부화**
- [x] **Step 4: 액자·테이블·의자·선물·카트·우편함·벤치의 내부 픽셀 세부화**
- [x] **Step 5: 조명·가랜드·나비·별·꽃잎의 다채로운 발광 포인트 구현**
- [x] **Step 6: 장식 CSS 테스트 통과 확인**

### Task 4: 전체 시각 및 회귀 검증

**Files:**
- Verify: 전체 워크스페이스
- Create: `.superpowers/character-review/dawn-prism-*.png`

**Interfaces:**
- Consumes: Tasks 1-3 결과
- Produces: 네 구역과 네 모바일 뷰포트의 시각 검증 증거

- [x] **Step 1: `pnpm test && pnpm typecheck && pnpm build` 실행**
- [x] **Step 2: 로컬 Worker와 Vite 앱 실행**
- [x] **Step 3: 네 구역 `390x844` 스크린샷과 접촉 시트 생성**
- [x] **Step 4: `320x568`, `360x740`, `430x932` 스크롤·경계 검사**
- [x] **Step 5: 장식과 카드·NPC·포털 실제 교차 0건 확인**
- [x] **Step 6: 모션 감소와 데스크톱 화면 확인**
- [x] **Step 7: 발견된 시각 문제를 실패 테스트로 재현하고 수정**
- [x] **Step 8: 전체 검증을 새로 실행하고 diff 검사**

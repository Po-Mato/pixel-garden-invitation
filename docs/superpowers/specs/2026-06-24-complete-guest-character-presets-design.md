# 하객 완성 캐릭터 프리셋 선택형 전환 설계

작성일: 2026-06-24

프로젝트 루트: `/Users/sjlee/Documents/New project 5`

상태: 사용자 방향 전환 확정, 구현 계획 작성 전 설계 고정

## 배경

기존 하객 캐릭터는 `base`, `hair`, `outfit`, `accessory` 파츠를 조합하는 구조였다. 이 구조는 선택지는 많지만, 현재 품질 목표에는 맞지 않는다. 얼굴이 눌리거나 외계인처럼 보이는 문제, 헤어가 얼굴 중앙을 덮는 문제, 의상과 몸 비율이 따로 노는 문제는 파츠 경계가 많을수록 반복될 가능성이 높다.

사용자는 하객 기초 이미지를 확정했고, 이번 전환 방향을 “캐릭터 조합 형태가 아니라 하객 기초 이미지 기준의 완성된 캐릭터 선택”으로 정했다. 따라서 이번 설계는 하객에 한해 조합형 커스터마이저를 폐기하고, 완성된 하객 캐릭터 프리셋을 고르는 구조로 바꾼다.

기준 이미지:

- `character-assets/reference/guest-foundation-concept-reference-v1.png`
- `character-assets/reference/guest-foundation-sprite-reference-v1.png`

## 검토한 접근

### 1. 기존 파츠 조합 구조를 계속 개선한다

장점은 선택지가 가장 많고 이미 코드가 존재한다는 점이다. 하지만 지금 실패 원인이 파츠 경계와 조합 안정성에 있기 때문에, 얼굴/헤어/의상 품질이 계속 흔들릴 가능성이 높다. 이번 전환에서는 제외한다.

### 2. 완성 몸통 프리셋에 색상이나 액세서리만 추가한다

품질은 일부 개선되지만, 여전히 조합 경계가 남는다. 작은 스프라이트에서 안경, 귀걸이, 가방 같은 액세서리가 얼굴이나 손을 망가뜨릴 수 있다. 사용자가 원하는 “기초 이미지와의 갭 축소”에는 충분하지 않다. 이번 1차 구현에서는 제외한다.

### 3. 완성된 하객 캐릭터 프리셋만 선택한다

추천 및 확정안이다. 각 하객 캐릭터를 하나의 완성 스프라이트로 저작하고, 사용자는 카드 목록에서 완성 캐릭터를 선택한다. 선택지는 줄지만 캐릭터별 얼굴, 헤어, 의상, 액세서리를 한 장면 안에서 같이 설계할 수 있어 품질을 가장 안정적으로 끌어올릴 수 있다.

## 최종 설계

하객 캐릭터 시스템은 “부위별 조합”이 아니라 “완성 캐릭터 프리셋 선택”을 기준으로 동작한다.

초기 프리셋은 8개로 제한한다. 수량보다 품질을 우선하며, 확정된 기준 이미지의 네 캐릭터 방향을 먼저 포함한다.

초기 프리셋 방향:

1. 롱 웨이브와 더스티 로즈 하객 원피스
2. 단정한 여성 한복
3. 하프업 헤어와 블라우스/스커트
4. 쇼트 보브와 포멀 재킷/슬랙스
5. 네이비 클래식 수트
6. 차콜 블레이저와 슬랙스
7. 웨이브 미디엄 헤어와 남성 한복
8. 쇼트 크롭과 포멀 니트 재킷

각 프리셋은 얼굴, 헤어, 의상, 액세서리를 하나의 완성 캐릭터로 함께 설계한다. 얼굴 중앙 보호를 위해 헤어를 억지로 제한하는 방식이 아니라, 완성 캐릭터 자체가 사람다운 얼굴과 균형 잡힌 실루엣을 갖도록 만든다.

## 데이터 모델

기존 `CharacterAppearance`는 여러 파츠 ID를 들고 있었다. 전환 후 하객 런타임에서는 프리셋 ID 하나만 필요하다.

새 하객 선택 값:

```ts
type CharacterAppearance = {
  presetId: string;
};
```

프리셋 카탈로그는 다음 정보를 가진다.

```ts
type GuestCharacterPreset = {
  id: string;
  label: string;
  family: "feminine" | "masculine";
  description: string;
  source: {
    walk: string;
    idle?: string;
  };
  generated: {
    walk: string;
    idle?: string;
  };
};
```

저장된 예전 조합형 값이나 원격 참가자가 보내는 구버전 값은 파서에서 안전하게 처리한다. 구버전 조합 객체는 기본 프리셋으로 변환하며, 잘못된 `presetId`도 기본 프리셋으로 대체한다. 이 처리는 화면이 깨지지 않게 하기 위한 호환성 레이어다.

## 파일 구조

새 파일:

- `character-assets/guest-character-presets.json`
- `character-assets/source/guests/<preset-id>__walk.png`
- `character-assets/source/guests/<preset-id>__idle.png`
- `client/public/characters/generated/guests/<preset-id>__walk.png`
- `client/public/characters/generated/guests/<preset-id>__idle.png`

기존 파일 처리:

- `character-assets/guest-part-manifest.json`은 하객 런타임의 기준에서 제외한다.
- 기존 파츠 소스는 즉시 삭제하지 않는다. 현재 워크트리에 기존 재작업 변경이 남아 있으므로, 구현 단계에서는 새 프리셋 경로를 우선 연결하고 기존 파츠 경로는 레거시/비사용 상태로 둔다.
- `shared/character-catalog.json`의 헤어/의상/액세서리 항목은 하객 UI에서 사용하지 않는다. 최종 정리 여부는 프리셋 전환 구현과 테스트가 통과한 뒤 별도 판단한다.

## 렌더링 구조

`CharacterSprite`는 계속 “스프라이트 시트의 방향/프레임을 잘라 보여주는 컴포넌트” 역할을 유지한다. 다만 하객 렌더링에서 여러 레이어를 쌓지 않고, 선택된 프리셋의 완성 스프라이트 한 장만 사용한다.

변경 방향:

- 1차 구현에서는 `resolveCharacterLayers` 함수명을 유지한다. 내부 동작만 하객 프리셋 기준의 단일 완성 레이어 반환으로 바꾼다.
- 단일 완성 레이어의 슬롯은 기존 CSS와 테스트 영향 범위를 줄이기 위해 `base`를 사용한다.
- `sourceSize`, `displaySize`, 방향 행, 보행 프레임 규격은 기존 `96x144`, 정원 표시 `48x72`, 미리보기 `96x144`를 유지한다.
- idle 이미지는 정면 정지 상태에서만 사용한다. 없으면 walk 시트의 정면 중앙 프레임으로 대체한다.

## 커스터마이저 UI

`CharacterCustomizer`는 탭형 파츠 편집 UI를 중단하고 완성 캐릭터 카드 그리드로 바꾼다.

UI 구성:

- 상단: 선택된 하객 캐릭터 큰 미리보기
- 중단: “무작위 선택”, “기본 캐릭터” 버튼
- 하단: 완성 캐릭터 카드 목록

카드에는 완성 캐릭터 스프라이트와 한국어 라벨을 표시한다. 헤어, 헤어 색, 의상, 의상 색, 액세서리 탭은 제거한다.

## 아트 품질 기준

완성 프리셋은 기준 이미지를 자동 축소하지 않는다. 기준 이미지의 분위기와 캐릭터성을 `96x144` 스프라이트로 다시 저작한다.

필수 기준:

- 얼굴은 둥글고 사람다운 비율이어야 한다.
- 눈, 코, 입, 볼이 분리되어 읽혀야 한다.
- 얼굴 중앙이 큰 검은 덩어리나 헤어 마스크처럼 보이면 실패다.
- 의상은 웨딩 하객 복장으로 읽혀야 한다.
- 팔, 손, 다리, 발이 막대처럼 보이면 실패다.
- 프리셋별 실루엣은 카드 목록에서 서로 구분되어야 한다.
- 신랑/신부 NPC보다 덜 화려하되 같은 세계관의 로맨틱 포멀 아트 톤을 유지한다.

## 생성과 감사

기존 파츠 생성 스크립트는 하객 프리셋 생성 흐름으로 대체한다.

필요 작업:

- 완성 프리셋 소스 PNG를 생성 또는 저작하는 스크립트 추가
- 프리셋 카탈로그의 모든 `source.walk` / `source.idle` 파일 존재 검사
- 소스와 생성 결과의 크기 검사
- 프레임 점유 검사
- 프리셋 컨택트 시트 생성

검토 산출물:

```text
.superpowers/character-review/guest-preset-contact-sheet.png
```

## 호환성

기존 로컬 저장값이나 실시간 방 메시지가 파츠 조합형 `CharacterAppearance`를 보낼 수 있다. 파서는 다음 순서로 처리한다.

1. `presetId`가 있고 카탈로그에 존재하면 그대로 사용한다.
2. 구버전 `family`, `hairStyle`, `outfit` 조합 객체면 기본 프리셋으로 변환한다.
3. 그 외 값은 기본 프리셋으로 변환한다.

이 방식은 기존 참가자 데이터 때문에 화면 렌더링이 실패하는 문제를 막는다. 구버전 값을 동일한 외형으로 재현하려고 하지 않는다. 품질 목표가 프리셋 전환이므로, 호환성은 “안전한 표시”까지만 보장한다.

## 테스트 범위

구현 단계에서 수정해야 할 테스트:

- `shared/src/characterCatalog.test.ts`: 프리셋 카탈로그와 기본 프리셋 검증
- `shared/src/guestPartManifest.test.ts`: 하객 런타임 테스트에서 제외하고 `shared/src/guestCharacterPresets.test.ts`로 교체
- `client/src/character/assets.test.ts`: 단일 완성 프리셋 스프라이트 경로 검증
- `client/src/components/CharacterCustomizer.test.tsx`: 탭 UI 대신 프리셋 카드 선택 검증
- `client/src/components/CharacterSprite.test.tsx`: 단일 레이어 렌더링 검증
- `client/src/realtime/realtimeClient.test.ts`: 구버전 appearance 호환 검증
- `scripts/characterAssetGenerator.test.mjs`: 프리셋 소스 생성/복사 검증
- `scripts/characterAssetAudit.test.mjs`: 프리셋 크기와 프레임 점유 감사 검증

검증 명령:

```bash
pnpm characters:audit
pnpm characters:generate
pnpm characters:contact-sheet -- --mode=guest-presets --output=.superpowers/character-review/guest-preset-contact-sheet.png
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

## 비범위

- 신랑/신부 NPC 아트 변경
- 신랑/신부 포즈 변경
- 정원 맵 구조 변경
- 멀티플레이 프로토콜의 메시지 종류 변경
- 하객 프레임 규격 변경
- 프리셋 외 추가 파츠 조합 UI 제공

## 성공 기준

- 사용자가 하객 커스터마이저에서 완성된 캐릭터만 선택한다.
- 파츠 탭이 UI에서 사라진다.
- 선택된 프리셋이 로컬 플레이어와 원격 하객 모두에 동일하게 표시된다.
- 구버전 appearance 값이 들어와도 화면이 깨지지 않는다.
- 컨택트 시트에서 8개 하객이 모두 기준 이미지의 “예쁘고 멋진 하객” 톤에 맞게 보인다.
- 모든 문서와 사용자-facing 라벨은 한국어로 유지한다.

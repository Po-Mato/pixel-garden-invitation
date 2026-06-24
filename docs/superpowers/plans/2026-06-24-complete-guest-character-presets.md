# 하객 완성 캐릭터 프리셋 선택형 구현 계획

> **에이전트 작업자 필수 사항:** 필수 하위 스킬: `superpowers:subagent-driven-development` 권장 또는 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위별로 구현한다. 단계 추적은 체크박스(`- [ ]`) 문법을 사용한다.

**목표:** 하객 캐릭터를 파츠 조합형에서 완성 캐릭터 프리셋 선택형으로 전환하고, 승인된 하객 기준 이미지에서 복구한 4개 완성 스프라이트를 런타임/생성/감사/UI에 연결한다.

> 2026-06-24 정정: 최초 계획은 8개 프리셋을 목표로 했으나, 사용자 검토에서 절차적 단순 도형 프리셋의 품질 하락이 확인되었다. 현재 기준은 수량 확장이 아니라 `guest-foundation-sprite-reference-v1.png`의 4명 crop을 직접 사용하는 고품질 복구다.

**아키텍처:** 공유 패키지에는 `presetId` 기반의 `CharacterAppearance`와 하객 프리셋 카탈로그를 둔다. 클라이언트 렌더러는 선택된 프리셋의 완성 스프라이트 한 장만 렌더링하고, 커스터마이저는 탭형 파츠 UI 대신 완성 캐릭터 카드 그리드를 제공한다. 생성/감사 스크립트는 새 `character-assets/source/guests` 소스와 `client/public/characters/generated/guests` 결과를 기준으로 검증한다.

**기술 스택:** TypeScript, React, Vite, Vitest, Node.js `node:test`, Sharp, pnpm workspace.

---

## 파일 구조 고정

새로 만든다:

- `character-assets/guest-character-presets.json`: 하객 완성 프리셋 카탈로그와 프레임 계약.
- `character-assets/source/guests/*.png`: 4개 승인 기준 하객 walk/idle 소스.
- `shared/src/guestCharacterPresets.ts`: 프리셋 카탈로그 타입, 기본 프리셋, 파서 보조 함수.
- `shared/src/guestCharacterPresets.test.ts`: 프리셋 카탈로그 계약 테스트.
- `scripts/author-guest-preset-sources.mjs`: 확정 톤의 완성 하객 스프라이트 소스 생성기.

수정한다:

- `shared/src/characterCatalog.ts`: `CharacterAppearance`를 `presetId` 기반으로 전환하고 구버전 appearance를 안전 변환한다.
- `shared/src/characterCatalog.test.ts`: 구버전 파츠 조합 테스트를 프리셋 테스트로 교체한다.
- `shared/src/index.ts`: 새 프리셋 모듈을 export하고 하객 파츠 manifest export는 런타임 사용처에서 제거한다.
- `shared/src/guestPartManifest.ts`, `shared/src/guestPartManifest.test.ts`: 레거시 파츠 manifest가 TypeScript 컴파일과 테스트를 깨지 않도록 자체 타입으로 독립시킨다.
- `shared/src/protocol.ts`, `shared/src/validation.ts`, `shared/src/validation.test.ts`: 새 appearance 타입과 호환성 파서를 유지한다.
- `client/src/character/assets.ts`: 프리셋 단일 완성 레이어를 반환한다.
- `client/src/character/assets.test.ts`: 단일 프리셋 레이어 경로를 검증한다.
- `client/src/character/appearanceState.ts`, `client/src/character/appearanceState.test.ts`: 프리셋 선택/무작위 선택 유틸로 단순화한다.
- `client/src/character/storage.test.ts`: 구버전 저장값이 기본 프리셋으로 변환되는지 검증한다.
- `client/src/components/CharacterCustomizer.tsx`, `client/src/components/CharacterCustomizer.test.tsx`: 완성 캐릭터 카드 선택 UI로 교체한다.
- `client/src/components/CharacterSprite.tsx`, `client/src/components/CharacterSprite.test.tsx`: 단일 레이어 렌더링과 실패 처리 검증으로 갱신한다.
- `client/src/components/EntryScreen.tsx`: 안내 문구를 “꾸미기”에서 “선택” 기준으로 변경한다.
- `client/src/components/EntryScreen.test.tsx`, `client/src/components/GameWorld.test.tsx`, `client/src/realtime/realtimeClient.test.ts`: 새 appearance 형태로 테스트 데이터를 갱신한다.
- `worker/src/GardenRoom.test.ts`: 새 기본 appearance를 기대값으로 사용한다.
- `scripts/generate-character-assets.mjs`: 하객 프리셋 소스를 검증하고 generated 경로로 복사한다.
- `scripts/audit-character-assets.mjs`: 기본 감사 범위를 하객 프리셋과 커플 NPC 중심으로 전환한다.
- `scripts/render-character-contact-sheet.mjs`: `guest-presets` 모드를 추가한다.
- `scripts/characterAssetGenerator.test.mjs`, `scripts/characterAssetAudit.test.mjs`: 프리셋 생성/감사 계약으로 갱신한다.
- `package.json`: `characters:author-guest-presets` 스크립트를 추가하고 필요한 경우 `characters:author-guests`는 레거시 스크립트로 남긴다.
- `docs/character-art-direction-lock.md`: 하객 고정 규칙을 완성 프리셋 기준으로 갱신한다.

유지하되 런타임 기준에서 제외한다:

- `character-assets/guest-part-manifest.json`
- `shared/src/guestPartManifest.ts`
- `character-assets/source/base/*`
- `character-assets/source/hair/*`
- `character-assets/source/outfits/*`
- `character-assets/source/accessories/*`

## Task 1: 공유 하객 프리셋 카탈로그와 appearance 타입 전환

**Files:**

- Create: `character-assets/guest-character-presets.json`
- Create: `shared/src/guestCharacterPresets.ts`
- Create: `shared/src/guestCharacterPresets.test.ts`
- Modify: `shared/src/characterCatalog.ts`
- Modify: `shared/src/characterCatalog.test.ts`
- Modify: `shared/src/index.ts`
- Modify: `shared/src/protocol.ts`
- Modify: `shared/src/validation.test.ts`
- Modify: `shared/src/guestPartManifest.ts`
- Modify: `shared/src/guestPartManifest.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`shared/src/guestCharacterPresets.test.ts`를 새로 만든다.

```ts
import { describe, expect, it } from "vitest";
import {
  defaultCharacterAppearance,
  getDefaultAppearance,
  guestCharacterPresets,
  guestPresetFrame,
  parseCharacterAppearance,
  resolveGuestPreset
} from "./index";

describe("하객 완성 캐릭터 프리셋", () => {
  it("승인된 기준 이미지에서 복구한 4개 완성 하객 프리셋만 가진다", () => {
    expect(guestCharacterPresets).toHaveLength(4);
    expect(guestCharacterPresets.map((preset) => preset.id)).toEqual([
      "feminine-long-wave-dress",
      "feminine-formal-hanbok",
      "masculine-navy-suit",
      "masculine-charcoal-blazer"
    ]);
  });

  it("기존 하객 프레임 규격을 유지한다", () => {
    expect(guestPresetFrame.source).toEqual({ width: 96, height: 144 });
    expect(guestPresetFrame.walk.sheet).toEqual({ width: 288, height: 576 });
    expect(guestPresetFrame.idle.sheet).toEqual({ width: 192, height: 144 });
    expect(guestPresetFrame.display.world).toEqual({ width: 48, height: 72 });
    expect(guestPresetFrame.display.preview).toEqual({ width: 96, height: 144 });
  });

  it("기본 appearance는 첫 여성 프리셋이다", () => {
    expect(defaultCharacterAppearance).toEqual({ presetId: "feminine-long-wave-dress" });
    expect(getDefaultAppearance("masculine")).toEqual({ presetId: "masculine-navy-suit" });
  });

  it("프리셋 ID만 정상 appearance로 인정한다", () => {
    expect(parseCharacterAppearance({ presetId: "masculine-navy-suit" })).toEqual({
      presetId: "masculine-navy-suit"
    });
    expect(parseCharacterAppearance({ presetId: "missing" })).toEqual(defaultCharacterAppearance);
  });

  it("구버전 파츠 조합 appearance를 기본 프리셋으로 안전 변환한다", () => {
    expect(parseCharacterAppearance({
      family: "feminine",
      skinTone: "skin-02-fair",
      hairStyle: "feminine-long-wave",
      hairColor: "dark-brown",
      outfit: "feminine-midi-dress",
      outfitPalette: "dusty-rose",
      accessories: { face: null, jewelry: null, neckwear: null, carry: null }
    })).toEqual(defaultCharacterAppearance);
  });

  it("프리셋 조회 실패 시 기본 프리셋으로 대체한다", () => {
    expect(resolveGuestPreset({ presetId: "missing" }).id).toBe("feminine-long-wave-dress");
  });
});
```

`shared/src/characterCatalog.test.ts`는 기존 파츠 카탈로그 수량 테스트를 제거하고 다음 검증만 남긴다.

```ts
import { describe, expect, it } from "vitest";
import {
  characterCatalog,
  defaultCharacterAppearance,
  parseCharacterAppearance
} from "./characterCatalog";

describe("character catalog", () => {
  it("NPC와 하객 프리셋 카탈로그를 제공한다", () => {
    expect(characterCatalog.npcs.map((item) => item.id)).toEqual(["groom", "bride"]);
    expect(characterCatalog.guestPresets).toHaveLength(4);
  });

  it("기본 appearance를 허용한다", () => {
    expect(parseCharacterAppearance(defaultCharacterAppearance)).toEqual(defaultCharacterAppearance);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
pnpm --filter @wedding-game/shared test -- --run shared/src/guestCharacterPresets.test.ts shared/src/characterCatalog.test.ts
```

Expected: `guestCharacterPresets`, `guestPresetFrame`, `resolveGuestPreset`, `guestPresets`가 없어 실패한다.

- [ ] **Step 3: 프리셋 JSON 작성**

`character-assets/guest-character-presets.json`를 다음 구조로 만든다.

```json
{
  "version": 1,
  "frame": {
    "source": { "width": 96, "height": 144 },
    "display": {
      "world": { "width": 48, "height": 72 },
      "preview": { "width": 96, "height": 144 }
    },
    "walk": {
      "sheet": { "width": 288, "height": 576 },
      "columns": 3,
      "rows": ["down", "left", "right", "up"]
    },
    "idle": {
      "sheet": { "width": 192, "height": 144 },
      "columns": 2,
      "frames": ["open", "blink"]
    }
  },
  "defaultPresetId": "feminine-long-wave-dress",
  "defaultByFamily": {
    "feminine": "feminine-long-wave-dress",
    "masculine": "masculine-navy-suit"
  },
  "presets": [
    {
      "id": "feminine-long-wave-dress",
      "family": "feminine",
      "label": "롱 웨이브 하객 원피스",
      "description": "둥근 얼굴, 롱 웨이브, 더스티 로즈 원피스의 대표 하객",
      "source": {
        "walk": "character-assets/source/guests/feminine-long-wave-dress__walk.png",
        "idle": "character-assets/source/guests/feminine-long-wave-dress__idle.png"
      },
      "generated": {
        "walk": "guests/feminine-long-wave-dress__walk.png",
        "idle": "guests/feminine-long-wave-dress__idle.png"
      }
    },
    {
      "id": "feminine-formal-hanbok",
      "family": "feminine",
      "label": "단정한 여성 한복",
      "description": "부드러운 업스타일과 로즈/아이보리 한복 하객",
      "source": {
        "walk": "character-assets/source/guests/feminine-formal-hanbok__walk.png",
        "idle": "character-assets/source/guests/feminine-formal-hanbok__idle.png"
      },
      "generated": {
        "walk": "guests/feminine-formal-hanbok__walk.png",
        "idle": "guests/feminine-formal-hanbok__idle.png"
      }
    },
    {
      "id": "feminine-half-up-skirt",
      "family": "feminine",
      "label": "하프업 블라우스 스커트",
      "description": "하프업 웨이브와 크림 블라우스, 네이비 스커트 하객",
      "source": {
        "walk": "character-assets/source/guests/feminine-half-up-skirt__walk.png",
        "idle": "character-assets/source/guests/feminine-half-up-skirt__idle.png"
      },
      "generated": {
        "walk": "guests/feminine-half-up-skirt__walk.png",
        "idle": "guests/feminine-half-up-skirt__idle.png"
      }
    },
    {
      "id": "feminine-short-bob-suit",
      "family": "feminine",
      "label": "쇼트 보브 포멀 수트",
      "description": "쇼트 보브와 베이지 재킷, 슬랙스 조합의 세련된 하객",
      "source": {
        "walk": "character-assets/source/guests/feminine-short-bob-suit__walk.png",
        "idle": "character-assets/source/guests/feminine-short-bob-suit__idle.png"
      },
      "generated": {
        "walk": "guests/feminine-short-bob-suit__walk.png",
        "idle": "guests/feminine-short-bob-suit__idle.png"
      }
    },
    {
      "id": "masculine-navy-suit",
      "family": "masculine",
      "label": "네이비 클래식 수트",
      "description": "단정한 가르마와 네이비 수트의 대표 남성 하객",
      "source": {
        "walk": "character-assets/source/guests/masculine-navy-suit__walk.png",
        "idle": "character-assets/source/guests/masculine-navy-suit__idle.png"
      },
      "generated": {
        "walk": "guests/masculine-navy-suit__walk.png",
        "idle": "guests/masculine-navy-suit__idle.png"
      }
    },
    {
      "id": "masculine-charcoal-blazer",
      "family": "masculine",
      "label": "차콜 블레이저",
      "description": "텍스처 헤어와 차콜 블레이저, 베이지 슬랙스 하객",
      "source": {
        "walk": "character-assets/source/guests/masculine-charcoal-blazer__walk.png",
        "idle": "character-assets/source/guests/masculine-charcoal-blazer__idle.png"
      },
      "generated": {
        "walk": "guests/masculine-charcoal-blazer__walk.png",
        "idle": "guests/masculine-charcoal-blazer__idle.png"
      }
    },
    {
      "id": "masculine-formal-hanbok",
      "family": "masculine",
      "label": "남성 포멀 한복",
      "description": "웨이브 미디엄 헤어와 네이비/아이보리 한복 하객",
      "source": {
        "walk": "character-assets/source/guests/masculine-formal-hanbok__walk.png",
        "idle": "character-assets/source/guests/masculine-formal-hanbok__idle.png"
      },
      "generated": {
        "walk": "guests/masculine-formal-hanbok__walk.png",
        "idle": "guests/masculine-formal-hanbok__idle.png"
      }
    },
    {
      "id": "masculine-knit-jacket",
      "family": "masculine",
      "label": "포멀 니트 재킷",
      "description": "쇼트 크롭과 오트 니트 재킷, 차콜 팬츠 하객",
      "source": {
        "walk": "character-assets/source/guests/masculine-knit-jacket__walk.png",
        "idle": "character-assets/source/guests/masculine-knit-jacket__idle.png"
      },
      "generated": {
        "walk": "guests/masculine-knit-jacket__walk.png",
        "idle": "guests/masculine-knit-jacket__idle.png"
      }
    }
  ]
}
```

- [ ] **Step 4: 공유 모듈 구현**

`shared/src/guestCharacterPresets.ts`를 만든다.

```ts
import rawPresets from "../../character-assets/guest-character-presets.json";

export type CharacterFamily = "masculine" | "feminine";

export type GuestSpriteSize = {
  width: number;
  height: number;
};

export type GuestPresetFrame = {
  source: GuestSpriteSize;
  display: {
    world: GuestSpriteSize;
    preview: GuestSpriteSize;
  };
  walk: {
    sheet: GuestSpriteSize;
    columns: number;
    rows: Array<"down" | "left" | "right" | "up">;
  };
  idle: {
    sheet: GuestSpriteSize;
    columns: number;
    frames: string[];
  };
};

export type GuestCharacterPreset = {
  id: string;
  family: CharacterFamily;
  label: string;
  description: string;
  source: {
    walk: string;
    idle: string;
  };
  generated: {
    walk: string;
    idle: string;
  };
};

type GuestCharacterPresetCatalog = {
  version: number;
  frame: GuestPresetFrame;
  defaultPresetId: string;
  defaultByFamily: Record<CharacterFamily, string>;
  presets: GuestCharacterPreset[];
};

export const guestCharacterPresetCatalog = rawPresets as GuestCharacterPresetCatalog;
export const guestPresetFrame = guestCharacterPresetCatalog.frame;
export const guestCharacterPresets = guestCharacterPresetCatalog.presets;
export const defaultGuestPresetId = guestCharacterPresetCatalog.defaultPresetId;
const presetById = new Map(guestCharacterPresets.map((preset) => [preset.id, preset]));

export function isGuestPresetId(value: unknown): value is string {
  return typeof value === "string" && presetById.has(value);
}

export function getDefaultPresetId(family?: CharacterFamily): string {
  return family ? guestCharacterPresetCatalog.defaultByFamily[family] : defaultGuestPresetId;
}

export function resolveGuestPreset(appearance: { presetId: string }): GuestCharacterPreset {
  return presetById.get(appearance.presetId) ?? presetById.get(defaultGuestPresetId) ?? guestCharacterPresets[0];
}
```

`shared/src/characterCatalog.ts`를 프리셋 중심으로 단순화한다.

```ts
import rawCatalog from "../character-catalog.json";
import {
  type CharacterFamily,
  getDefaultPresetId,
  guestCharacterPresets,
  isGuestPresetId
} from "./guestCharacterPresets";

export type { CharacterFamily };

export type CharacterAppearance = {
  presetId: string;
};

export const characterCatalog = {
  ...(rawCatalog as { version: number; npcs: Array<{ id: "groom" | "bride"; label: string }> }),
  guestPresets: guestCharacterPresets
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getDefaultAppearance(family?: CharacterFamily): CharacterAppearance {
  return { presetId: getDefaultPresetId(family) };
}

export const defaultCharacterAppearance = getDefaultAppearance();

export function parseCharacterAppearance(value: unknown): CharacterAppearance {
  if (isRecord(value) && isGuestPresetId(value.presetId)) {
    return { presetId: value.presetId };
  }

  if (isRecord(value) && (value.family === "masculine" || value.family === "feminine")) {
    return getDefaultAppearance(value.family);
  }

  return defaultCharacterAppearance;
}
```

`shared/src/index.ts`에 export를 추가한다.

```ts
export * from "./content";
export * from "./guestCharacterPresets";
export * from "./characterCatalog";
export * from "./protocol";
export * from "./validation";
```

- [ ] **Step 5: 레거시 guestPartManifest 컴파일 정리**

`shared/src/guestPartManifest.ts`는 런타임 export 대상에서 빠지지만 `tsconfig` include에는 남아 있으므로 자체 타입을 갖도록 수정한다. `CharacterLayerSlot`, `AccessorySlot`, `CharacterFamily`를 `characterCatalog.ts`에서 import하지 않는다.

```ts
import rawManifest from "../../character-assets/guest-part-manifest.json";

export type LegacyCharacterFamily = "masculine" | "feminine";
export type LegacyAccessorySlot = "face" | "jewelry" | "neckwear" | "carry";
export type LegacyCharacterLayerSlot =
  | "back-accessory"
  | "back-hair"
  | "base"
  | "outfit"
  | "front-hair"
  | "face"
  | "jewelry"
  | "neckwear"
  | "carry";

export type GuestSpriteSize = {
  width: number;
  height: number;
};

export type GuestPartManifest = {
  version: number;
  frame: {
    source: GuestSpriteSize;
    display: {
      world: GuestSpriteSize;
      preview: GuestSpriteSize;
    };
    walk: {
      sheet: GuestSpriteSize;
      columns: number;
      rows: Array<"down" | "left" | "right" | "up">;
    };
    idle: {
      sheet: GuestSpriteSize;
      columns: number;
      frames: string[];
    };
  };
  layerOrder: LegacyCharacterLayerSlot[];
  parts: {
    base: Array<{ id: LegacyCharacterFamily; family: LegacyCharacterFamily; layer: "base" }>;
    hair: Array<{ id: string; family: LegacyCharacterFamily; layers: { back: "back-hair"; front: "front-hair" } }>;
    outfits: Array<{ id: string; family: LegacyCharacterFamily; layer: "outfit" }>;
    accessories: Array<{ id: string; slot: LegacyAccessorySlot; layer: LegacyCharacterLayerSlot }>;
  };
};

export const guestPartManifest = rawManifest as GuestPartManifest;
```

`shared/src/guestPartManifest.test.ts`는 카탈로그 정합성 테스트를 제거하고 레거시 manifest가 보관 자료로 남아 있음을 확인하는 테스트만 유지한다.

```ts
import { describe, expect, it } from "vitest";
import { guestPartManifest } from "./guestPartManifest";

describe("legacy guest part manifest", () => {
  it("keeps the previous high-density frame contract for archived part assets", () => {
    expect(guestPartManifest.frame.source).toEqual({ width: 96, height: 144 });
    expect(guestPartManifest.frame.walk.sheet).toEqual({ width: 288, height: 576 });
    expect(guestPartManifest.frame.idle.sheet).toEqual({ width: 192, height: 144 });
  });

  it("is not the runtime guest selection contract", () => {
    expect(guestPartManifest.parts.base.map((part) => part.id).sort()).toEqual(["feminine", "masculine"]);
  });
});
```

- [ ] **Step 6: 공유 테스트 통과 확인**

Run:

```bash
pnpm --filter @wedding-game/shared test -- --run shared/src/guestCharacterPresets.test.ts shared/src/characterCatalog.test.ts shared/src/guestPartManifest.test.ts shared/src/validation.test.ts
```

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add character-assets/guest-character-presets.json shared/src/guestCharacterPresets.ts shared/src/guestCharacterPresets.test.ts shared/src/characterCatalog.ts shared/src/characterCatalog.test.ts shared/src/index.ts shared/src/protocol.ts shared/src/validation.test.ts shared/src/guestPartManifest.ts shared/src/guestPartManifest.test.ts
git commit -m "feat: add guest character preset catalog"
```

## Task 2: 완성 하객 프리셋 소스 생성기 추가

**Files:**

- Create: `scripts/author-guest-preset-sources.mjs`
- Modify: `package.json`
- Create via script: `character-assets/source/guests/*.png`

- [ ] **Step 1: 생성 스크립트 명령 테스트 작성**

`scripts/characterAssetGenerator.test.mjs` 상단의 카탈로그 로딩 근처에 프리셋 카탈로그를 추가한다.

```js
const guestPresetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));
```

파일 하단에 다음 테스트를 추가한다.

```js
test("guest preset authoring emits finished walk and idle sources", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guest-preset-authoring-"));
  try {
    const { authorGuestPresetSources } = await import("./author-guest-preset-sources.mjs");
    const count = await authorGuestPresetSources({ sourceRoot: join(dir, "source") });

    assert.equal(count, guestPresetCatalog.presets.length * 2);
    for (const preset of guestPresetCatalog.presets) {
      const walk = join(dir, "source", preset.source.walk.replace(/^character-assets\/source\//, ""));
      const idle = join(dir, "source", preset.source.idle.replace(/^character-assets\/source\//, ""));
      await assert.doesNotReject(() => validateDimensions(walk, guestPresetCatalog.frame.walk.sheet));
      await assert.doesNotReject(() => validateDimensions(idle, guestPresetCatalog.frame.idle.sheet));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
node --test scripts/characterAssetGenerator.test.mjs --test-name-pattern "guest preset authoring"
```

Expected: `Cannot find module './author-guest-preset-sources.mjs'`로 실패한다.

- [ ] **Step 3: 소스 생성기 구현**

`scripts/author-guest-preset-sources.mjs`를 만든다. 구현은 Sharp로 `96x144` 프레임을 그리고, walk는 3열 × 4행, idle은 2열 × 1행으로 합성한다. 캐릭터 얼굴은 기준 이미지와 맞도록 둥근 얼굴, 작은 분리 눈, 작은 입, 작은 볼을 공통으로 사용한다.

핵심 구조:

```js
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const presetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));
const defaultSourceRoot = join(root, "character-assets/source");

function svgFrame(preset, { direction, step, blink }) {
  const skin = preset.family === "feminine" ? "#f4c4a8" : "#e8b18f";
  const cheek = "#d9787c";
  const ink = "#251812";
  const shoeOffset = step === 0 ? -2 : step === 2 ? 2 : 0;
  const sideShift = direction === "left" ? -3 : direction === "right" ? 3 : 0;

  return `
    <svg width="96" height="144" viewBox="0 0 96 144" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${sideShift} 0)">
        <ellipse cx="48" cy="33" rx="17" ry="19" fill="${skin}"/>
        <rect x="41" y="50" width="14" height="12" rx="5" fill="${skin}"/>
        ${hairSvg(preset.id, direction)}
        ${bodySvg(preset.id, shoeOffset)}
        <circle cx="41" cy="35" r="1.7" fill="${blink ? skin : ink}"/>
        <circle cx="55" cy="35" r="1.7" fill="${blink ? skin : ink}"/>
        <rect x="47" y="38" width="2" height="2" rx="1" fill="#b87562"/>
        <path d="M43 44 Q48 48 53 44" fill="none" stroke="#9b4b50" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="36" cy="41" r="2" fill="${cheek}" opacity="0.65"/>
        <circle cx="60" cy="41" r="2" fill="${cheek}" opacity="0.65"/>
      </g>
    </svg>`;
}

function hairSvg(id, direction) {
  const hair = id.startsWith("masculine") ? "#2f211c" : "#3a241d";
  if (id === "feminine-long-wave-dress") {
    return `<path d="M31 31 C30 16 66 16 65 32 C69 48 61 65 54 72 L42 72 C35 63 27 48 31 31 Z" fill="${hair}"/>
      <path d="M34 29 C40 20 57 20 62 31 C56 29 51 27 44 28 C39 29 36 31 34 29 Z" fill="#4a2c23"/>`;
  }
  if (id === "feminine-formal-hanbok") {
    return `<ellipse cx="48" cy="22" rx="14" ry="9" fill="${hair}"/><path d="M32 33 C33 19 63 19 64 34 C58 30 38 30 32 33 Z" fill="${hair}"/>`;
  }
  if (id === "feminine-half-up-skirt") {
    return `<path d="M32 30 C34 17 62 17 64 31 C61 45 57 58 53 66 L43 66 C38 58 34 44 32 30 Z" fill="${hair}"/><path d="M37 28 C44 20 54 22 61 29" fill="none" stroke="#604033" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (id === "feminine-short-bob-suit") {
    return `<path d="M31 31 C32 18 64 18 65 32 L63 52 C58 58 38 58 33 52 Z" fill="#30211d"/>`;
  }
  if (id === "masculine-navy-suit") {
    return `<path d="M32 31 C34 18 63 18 65 31 C57 27 47 28 36 33 Z" fill="${hair}"/><path d="M42 23 C49 20 57 22 63 27" fill="none" stroke="#4c352b" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (id === "masculine-charcoal-blazer") {
    return `<path d="M32 31 C34 18 62 17 65 31 C59 29 55 27 51 24 C45 28 39 28 32 31 Z" fill="#2c2422"/>`;
  }
  if (id === "masculine-formal-hanbok") {
    return `<path d="M31 32 C33 17 65 17 66 32 C61 29 55 28 49 28 C42 28 36 30 31 32 Z" fill="#33231f"/><path d="M36 24 C44 18 56 20 63 27" fill="none" stroke="#51372e" stroke-width="4" stroke-linecap="round"/>`;
  }
  return `<path d="M32 31 C35 19 61 19 64 31 C58 30 54 27 50 25 C45 29 39 30 32 31 Z" fill="#2a211f"/>`;
}

function bodySvg(id, shoeOffset) {
  const palette = {
    "feminine-long-wave-dress": ["#c87887", "#e9b3bb", "#7b3443"],
    "feminine-formal-hanbok": ["#f0d7c0", "#c86d83", "#7d5376"],
    "feminine-half-up-skirt": ["#f2dfc5", "#314867", "#8da0b2"],
    "feminine-short-bob-suit": ["#b89d78", "#51483f", "#304467"],
    "masculine-navy-suit": ["#293a55", "#fff4dc", "#24324b"],
    "masculine-charcoal-blazer": ["#474a51", "#b49b76", "#2f3239"],
    "masculine-formal-hanbok": ["#304467", "#efe0c4", "#6384a0"],
    "masculine-knit-jacket": ["#b49b76", "#3c424b", "#2f3239"]
  }[id];
  const [main, accent, dark] = palette;
  const dress = id.startsWith("feminine") && !id.includes("suit");
  const hanbok = id.includes("hanbok");
  const top = hanbok ? `<path d="M32 61 L64 61 L59 86 L37 86 Z" fill="${accent}"/><path d="M38 62 L58 84" stroke="${main}" stroke-width="4"/>` : `<path d="M34 60 L62 60 L58 91 L38 91 Z" fill="${main}"/>`;
  const lower = dress || hanbok
    ? `<path d="M36 84 L60 84 L68 126 L28 126 Z" fill="${main}"/><path d="M48 86 L48 126" stroke="${dark}" stroke-width="2" opacity="0.45"/>`
    : `<path d="M37 88 L47 88 L45 ${126 + shoeOffset} L35 126 Z" fill="${dark}"/><path d="M50 88 L60 88 L62 126 L52 ${126 - shoeOffset} Z" fill="${dark}"/>`;
  return `
    <path d="M32 66 C24 76 22 96 27 111" fill="none" stroke="${main}" stroke-width="7" stroke-linecap="round"/>
    <path d="M64 66 C72 77 74 96 69 111" fill="none" stroke="${main}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="27" cy="112" r="4" fill="#e8b18f"/>
    <circle cx="69" cy="112" r="4" fill="#e8b18f"/>
    ${top}
    ${lower}
    <path d="M38 64 L48 72 L58 64" fill="none" stroke="${accent}" stroke-width="3"/>
    <rect x="34" y="126" width="12" height="5" rx="2" fill="#251812"/>
    <rect x="51" y="126" width="12" height="5" rx="2" fill="#251812"/>
  `;
}

async function renderFrame(preset, options) {
  return sharp(Buffer.from(svgFrame(preset, options))).png().toBuffer();
}

async function saveSheet(output, frames, width, height) {
  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: "#00000000" }
  }).composite(frames).png({ compressionLevel: 9 }).toFile(output);
}

function sourcePath(sourceRoot, manifestPath) {
  return join(sourceRoot, manifestPath.replace(/^character-assets\/source\//, ""));
}

export async function authorGuestPresetSources({ sourceRoot = defaultSourceRoot } = {}) {
  let count = 0;
  const directions = ["down", "left", "right", "up"];
  for (const preset of presetCatalog.presets) {
    const walkComposites = [];
    for (let row = 0; row < directions.length; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        walkComposites.push({
          input: await renderFrame(preset, { direction: directions[row], step: column, blink: false }),
          left: column * 96,
          top: row * 144
        });
      }
    }
    await saveSheet(sourcePath(sourceRoot, preset.source.walk), walkComposites, 288, 576);
    count += 1;

    const idleComposites = [
      { input: await renderFrame(preset, { direction: "down", step: 1, blink: false }), left: 0, top: 0 },
      { input: await renderFrame(preset, { direction: "down", step: 1, blink: true }), left: 96, top: 0 }
    ];
    await saveSheet(sourcePath(sourceRoot, preset.source.idle), idleComposites, 192, 144);
    count += 1;
  }
  return count;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await authorGuestPresetSources();
  console.log(`Authored ${count} finished guest preset source sheets`);
}
```

- [ ] **Step 4: package script 추가**

`package.json` scripts에 추가한다.

```json
"characters:author-guest-presets": "node scripts/author-guest-preset-sources.mjs"
```

- [ ] **Step 5: 생성기 테스트와 실제 소스 생성**

Run:

```bash
node --test scripts/characterAssetGenerator.test.mjs --test-name-pattern "guest preset authoring"
pnpm characters:author-guest-presets
```

Expected: 테스트 PASS, `Authored 16 finished guest preset source sheets` 출력.

- [ ] **Step 6: 커밋**

```bash
git add package.json scripts/author-guest-preset-sources.mjs scripts/characterAssetGenerator.test.mjs character-assets/source/guests
git commit -m "feat: author finished guest preset sprites"
```

## Task 3: 생성/감사/컨택트 시트를 프리셋 기준으로 전환

**Files:**

- Modify: `scripts/generate-character-assets.mjs`
- Modify: `scripts/audit-character-assets.mjs`
- Modify: `scripts/render-character-contact-sheet.mjs`
- Modify: `scripts/characterAssetGenerator.test.mjs`
- Modify: `scripts/characterAssetAudit.test.mjs`
- Modify: `character-assets/quality-rules.json`

- [ ] **Step 1: 생성기 실패 테스트 갱신**

`scripts/characterAssetGenerator.test.mjs`의 `"generator accepts high-density guest sources and emits high-density generated sheets"` 테스트를 프리셋 중심으로 바꾼다.

```js
test("generator accepts finished guest preset sources and emits generated preset sheets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "character-assets-guest-presets-"));
  const sourceRoot = join(dir, "source");
  const outputRoot = join(dir, "generated");
  try {
    await cp(join(root, "character-assets/source"), sourceRoot, { recursive: true });
    const { authorGuestPresetSources } = await import("./author-guest-preset-sources.mjs");
    await authorGuestPresetSources({ sourceRoot });

    const { generateCharacterAssets } = await import("./generate-character-assets.mjs");
    const outputCount = await generateCharacterAssets({ sourceRoot, outputRoot });

    assert.equal(outputCount, 18);
    for (const preset of guestPresetCatalog.presets) {
      await assert.doesNotReject(() =>
        validateDimensions(join(outputRoot, preset.generated.walk), guestPresetCatalog.frame.walk.sheet)
      );
      await assert.doesNotReject(() =>
        validateDimensions(join(outputRoot, preset.generated.idle), guestPresetCatalog.frame.idle.sheet)
      );
    }
    await assert.doesNotReject(() =>
      validateDimensions(join(outputRoot, "npc/groom__walk.png"), { width: 288, height: 576 })
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});
```

NPC 생성 테스트의 출력 수 기대값도 `18`로 바꾼다.

```js
assert.match(stdout, /Generated 18 character assets/);
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
node --test scripts/characterAssetGenerator.test.mjs --test-name-pattern "guest preset|generator emits idle"
```

Expected: 현재 generator가 파츠 266개를 생성하므로 출력 수와 `guests/*` 경로 검증에서 실패한다.

- [ ] **Step 3: generator 구현 변경**

`scripts/generate-character-assets.mjs`에서 하객 파츠 manifest와 palette 의존을 제거하고 프리셋 카탈로그를 읽는다. NPC 복사는 유지한다.

핵심 변경:

```js
const guestPresetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));
const guestIdleDimensions = guestPresetCatalog.frame.idle.sheet;
const guestWalkDimensions = guestPresetCatalog.frame.walk.sheet;
```

`prevalidateSources`는 다음만 검사한다.

```js
async function prevalidateSources(sourceRoot) {
  for (const preset of guestPresetCatalog.presets) {
    await requireFile(sourcePath(sourceRoot, preset.source.walk), guestWalkDimensions);
    await requireFile(sourcePath(sourceRoot, preset.source.idle), guestIdleDimensions);
  }

  for (const npc of catalog.npcs) {
    await requireFile(join(sourceRoot, "npc", `${npc.id}-idle.png`), npcIdleDimensions);
    await requireFile(join(sourceRoot, "npc", `${npc.id}-walk.png`), npcWalkDimensions);
  }
}
```

`generateCharacterAssets`는 output 삭제 후 프리셋과 NPC만 복사한다.

```js
for (const preset of guestPresetCatalog.presets) {
  await copyFixed(sourcePath(sourceRoot, preset.source.walk), preset.generated.walk);
  await copyFixed(sourcePath(sourceRoot, preset.source.idle), preset.generated.idle);
}

for (const npc of catalog.npcs) {
  await copyFixed(join(sourceRoot, "npc", `${npc.id}-idle.png`), `npc/${npc.id}__idle.png`);
  await copyFixed(join(sourceRoot, "npc", `${npc.id}-walk.png`), `npc/${npc.id}__walk.png`);
}
```

- [ ] **Step 4: 감사 스크립트 실패 테스트 갱신**

`scripts/characterAssetAudit.test.mjs`에 다음 테스트를 추가한다.

```js
test("audit CLI validates finished guest preset source sheets", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [join(root, "scripts/audit-character-assets.mjs"), "--scope=guest-presets"],
    { cwd: root }
  );

  assert.match(stdout, /guest-presets/);
  assert.match(stdout, /Character asset audit passed/);
});
```

- [ ] **Step 5: audit 구현 변경**

`scripts/audit-character-assets.mjs`의 scopes를 다음으로 바꾼다.

```js
const scopes = new Set(["all", "couple", "guest-presets", "legacy-parts"]);
```

기본 `all`은 `couple`과 `guest-presets`만 검사한다. 기존 base/hair/outfits/accessories 루프는 `wants("legacy-parts")`일 때만 실행한다.

프리셋 감사 루프:

```js
if (wants("guest-presets")) {
  groupLine("guest-presets");
  for (const preset of guestPresetCatalog.presets) {
    await auditSheet(
      sourcePath(source, preset.source.walk),
      guestWalkDimensions,
      rules.guestPreset,
      { requireEveryFrame: true, footBaseline: guestFootBaseline, frameDimensions: guestFrame }
    );
    await auditSheet(
      sourcePath(source, preset.source.idle),
      guestIdleDimensions,
      rules.guestPreset,
      { requireEveryFrame: true, frameDimensions: guestFrame }
    );
  }
}
```

`character-assets/quality-rules.json`에 `guestPreset` 규칙을 추가한다. 기준은 기존 `base`보다 높게 잡는다.

```json
"guestPreset": {
  "minimumUniqueOpaqueColors": 8,
  "minimumOpaquePixelsPerFrame": 1200,
  "minimumColorTransitionsPerFrame": 140,
  "minimumBoundsHeight": 88,
  "minimumBoundsWidth": 34,
  "maximumBoundsTop": 16,
  "minimumBoundsBottom": 126,
  "maximumBoundsBottom": 143
}
```

- [ ] **Step 6: 컨택트 시트 테스트와 구현**

`scripts/characterAssetGenerator.test.mjs`의 parser 테스트에서 허용 mode에 `guest-presets`를 추가한다.

```js
assert.deepEqual(
  parseArguments(["--mode=guest-presets", "--output=presets.png"]),
  { mode: "guest-presets", output: "presets.png" }
);
```

`scripts/render-character-contact-sheet.mjs`에서 mode set을 바꾼다.

```js
if (!new Set(["couple", "catalog", "guest-presets"]).has(resolvedMode)) {
  throw new Error(`Unknown contact-sheet mode: ${resolvedMode}`);
}
```

`guestPresetSamples`를 추가한다.

```js
export async function guestPresetSamples() {
  return guestPresetCatalog.presets.map((preset) => ({
    label: `${preset.id} / ${preset.label}`,
    frames: directions.map((direction) => ({
      direction: direction.id,
      relative: preset.generated.walk,
      column: 1,
      row: direction.row
    }))
  }));
}
```

`main`에서 mode별 sample 선택을 분기한다.

```js
const samples = mode === "couple"
  ? await coupleSamples()
  : mode === "guest-presets"
    ? await guestPresetSamples()
    : await catalogSamples();
```

- [ ] **Step 7: 생성/감사/컨택트 검증**

Run:

```bash
pnpm characters:author-guest-presets
pnpm characters:generate
pnpm characters:audit -- --scope=guest-presets
pnpm characters:contact-sheet -- --mode=guest-presets --output=.superpowers/character-review/guest-preset-contact-sheet.png
node --test scripts/characterAssetGenerator.test.mjs scripts/characterAssetAudit.test.mjs
```

Expected: 모두 PASS, 컨택트 시트 생성.

- [ ] **Step 8: 커밋**

```bash
git add scripts/generate-character-assets.mjs scripts/audit-character-assets.mjs scripts/render-character-contact-sheet.mjs scripts/characterAssetGenerator.test.mjs scripts/characterAssetAudit.test.mjs character-assets/quality-rules.json client/public/characters/generated/guests
git commit -m "feat: generate and audit guest character presets"
```

## Task 4: 클라이언트 렌더러를 단일 완성 프리셋 레이어로 전환

**Files:**

- Modify: `client/src/character/assets.ts`
- Modify: `client/src/character/assets.test.ts`
- Modify: `client/src/components/CharacterSprite.test.tsx`

- [ ] **Step 1: assets 테스트를 단일 레이어 기준으로 변경**

`client/src/character/assets.test.ts` 전체를 다음으로 교체한다.

```ts
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { expect, it } from "vitest";
import { resolveCharacterLayers } from "./assets";

it("완성 하객 프리셋의 단일 generated 경로를 반환한다", () => {
  const layers = resolveCharacterLayers(defaultCharacterAppearance, "./");

  expect(layers).toEqual([
    {
      slot: "base",
      walkUrl: "./characters/generated/guests/feminine-long-wave-dress__walk.png",
      idleUrl: "./characters/generated/guests/feminine-long-wave-dress__idle.png",
      sourceSize: { width: 96, height: 144 },
      displaySize: {
        world: { width: 48, height: 72 },
        preview: { width: 96, height: 144 }
      }
    }
  ]);
});

it("알 수 없는 프리셋은 기본 프리셋 경로로 대체한다", () => {
  expect(resolveCharacterLayers({ presetId: "missing" }, "./")[0].walkUrl)
    .toBe("./characters/generated/guests/feminine-long-wave-dress__walk.png");
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
pnpm --filter @wedding-game/client test -- --run client/src/character/assets.test.ts
```

Expected: 현재 resolver가 파츠 레이어를 반환하므로 실패한다.

- [ ] **Step 3: resolver 구현 변경**

`client/src/character/assets.ts`를 프리셋 기준으로 바꾼다.

```ts
import {
  type CharacterAppearance,
  resolveGuestPreset,
  guestPresetFrame
} from "@wedding-game/shared";

export type CharacterDisplayMode = "world" | "preview";

export type ResolvedCharacterLayer = {
  slot: "base";
  walkUrl: string;
  idleUrl?: string;
  sourceSize: { width: number; height: number };
  displaySize: Record<CharacterDisplayMode, { width: number; height: number }>;
};

const assetUrl = (baseUrl: string, path: string) =>
  `${baseUrl}characters/generated/${path}`;

export function resolveCharacterLayers(
  appearance: CharacterAppearance,
  baseUrl = import.meta.env.BASE_URL
): ResolvedCharacterLayer[] {
  const preset = resolveGuestPreset(appearance);
  return [{
    slot: "base",
    walkUrl: assetUrl(baseUrl, preset.generated.walk),
    idleUrl: assetUrl(baseUrl, preset.generated.idle),
    sourceSize: guestPresetFrame.source,
    displaySize: guestPresetFrame.display
  }];
}
```

- [ ] **Step 4: CharacterSprite 테스트 변경**

`client/src/components/CharacterSprite.test.tsx`에서 “stable back-to-front order”와 “failed layer keeps siblings” 테스트를 단일 레이어 기준으로 바꾼다.

```ts
it("완성 프리셋 단일 레이어만 렌더링한다", () => {
  render(
    <CharacterSprite
      appearance={defaultCharacterAppearance}
      direction="right"
      moving={true}
      stepFrame={2}
      label="하객 캐릭터"
    />
  );

  const sprite = screen.getByLabelText("하객 캐릭터");
  expect([...sprite.querySelectorAll("[data-character-layer]")].map((node) => node.getAttribute("data-character-layer")))
    .toEqual(["base"]);
});

it("완성 프리셋 이미지 로드 실패 시 해당 레이어만 숨긴다", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(
    <CharacterSprite
      appearance={defaultCharacterAppearance}
      direction="down"
      moving={false}
      label="캐릭터"
    />
  );

  const sprite = screen.getByLabelText("캐릭터");
  const failedLayer = sprite.querySelector('[data-character-layer="base"]');
  const failedImage = failedLayer?.querySelector("img");
  expect(failedImage).toBeInTheDocument();

  fireEvent.error(failedImage as HTMLImageElement);

  expect(sprite.querySelector('[data-character-layer="base"]')).not.toBeInTheDocument();
  errorSpy.mockRestore();
});
```

- [ ] **Step 5: 클라이언트 렌더러 테스트 통과**

Run:

```bash
pnpm --filter @wedding-game/client test -- --run client/src/character/assets.test.ts client/src/components/CharacterSprite.test.tsx
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add client/src/character/assets.ts client/src/character/assets.test.ts client/src/components/CharacterSprite.test.tsx
git commit -m "feat: render guest character presets"
```

## Task 5: 커스터마이저를 완성 캐릭터 카드 선택 UI로 교체

**Files:**

- Modify: `client/src/character/appearanceState.ts`
- Modify: `client/src/character/appearanceState.test.ts`
- Modify: `client/src/components/CharacterCustomizer.tsx`
- Modify: `client/src/components/CharacterCustomizer.test.tsx`
- Modify: `client/src/components/EntryScreen.tsx`
- Modify: `client/src/components/EntryScreen.test.tsx`

- [ ] **Step 1: appearanceState 테스트 변경**

`client/src/character/appearanceState.test.ts`를 다음으로 바꾼다.

```ts
import {
  defaultCharacterAppearance,
  parseCharacterAppearance
} from "@wedding-game/shared";
import { expect, it } from "vitest";
import { randomizeAppearance, updateAppearance } from "./appearanceState";

it("프리셋 ID 업데이트를 적용한다", () => {
  expect(updateAppearance(defaultCharacterAppearance, "masculine-navy-suit")).toEqual({
    presetId: "masculine-navy-suit"
  });
});

it("알 수 없는 프리셋 ID는 현재 값을 유지한다", () => {
  expect(updateAppearance(defaultCharacterAppearance, "missing")).toEqual(defaultCharacterAppearance);
});

it("무작위 선택은 항상 유효한 appearance를 반환한다", () => {
  for (let index = 0; index < 100; index += 1) {
    expect(parseCharacterAppearance(randomizeAppearance(index / 100))).toEqual(expect.objectContaining({
      presetId: expect.any(String)
    }));
  }
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
pnpm --filter @wedding-game/client test -- --run client/src/character/appearanceState.test.ts
```

Expected: `changeFamily`와 patch 기반 API가 남아 있어 실패한다.

- [ ] **Step 3: appearanceState 구현**

`client/src/character/appearanceState.ts`를 다음으로 바꾼다.

```ts
import {
  defaultCharacterAppearance,
  guestCharacterPresets,
  isGuestPresetId,
  type CharacterAppearance
} from "@wedding-game/shared";

export function updateAppearance(
  current: CharacterAppearance,
  presetId: string
): CharacterAppearance {
  return isGuestPresetId(presetId) ? { presetId } : current;
}

export function randomizeAppearance(random = Math.random()): CharacterAppearance {
  const normalizedRandom = ((random % 1) + 1) % 1;
  const preset = guestCharacterPresets[Math.floor(normalizedRandom * guestCharacterPresets.length)];
  return preset ? { presetId: preset.id } : defaultCharacterAppearance;
}
```

- [ ] **Step 4: 커스터마이저 테스트 변경**

`client/src/components/CharacterCustomizer.test.tsx`를 프리셋 카드 기준으로 교체한다.

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { afterEach, expect, it, vi } from "vitest";
import { CharacterCustomizer } from "./CharacterCustomizer";

afterEach(() => {
  cleanup();
});

it("선택된 완성 하객 캐릭터 미리보기와 카드 목록을 보여준다", () => {
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  expect(screen.getByLabelText("선택한 하객 캐릭터")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "롱 웨이브 하객 원피스" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "네이비 클래식 수트" })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "헤어" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "액세서리" })).not.toBeInTheDocument();
});

it("완성 캐릭터 카드를 선택하면 presetId를 변경한다", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "네이비 클래식 수트" }));
  expect(onChange).toHaveBeenCalledWith({ presetId: "masculine-navy-suit" });
});

it("무작위 선택과 기본 캐릭터 선택을 지원한다", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "무작위 선택" }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    presetId: expect.any(String)
  }));
  fireEvent.click(screen.getByRole("button", { name: "기본 캐릭터" }));
  expect(onChange).toHaveBeenLastCalledWith(defaultCharacterAppearance);
});
```

- [ ] **Step 5: 커스터마이저 구현**

`client/src/components/CharacterCustomizer.tsx`를 탭 없는 카드 그리드로 단순화한다.

```tsx
import {
  defaultCharacterAppearance,
  guestCharacterPresets,
  resolveGuestPreset,
  type CharacterAppearance
} from "@wedding-game/shared";
import {
  randomizeAppearance,
  updateAppearance
} from "../character/appearanceState";
import { CharacterSprite } from "./CharacterSprite";

type Props = {
  value: CharacterAppearance;
  onChange: (appearance: CharacterAppearance) => void;
};

export function CharacterCustomizer({ value, onChange }: Props) {
  const selectedPreset = resolveGuestPreset(value);

  return (
    <section className="character-customizer" aria-label="하객 캐릭터 선택">
      <div className="character-customizer__preview">
        <div className="character-customizer__halo" aria-hidden="true" />
        <div className="character-customizer__sprite">
          <CharacterSprite
            appearance={value}
            direction="down"
            moving={false}
            label="선택한 하객 캐릭터"
            displayMode="preview"
          />
        </div>
        <p className="character-customizer__selected-name">{selectedPreset.label}</p>
      </div>

      <div className="character-customizer__actions">
        <button type="button" className="choice" onClick={() => onChange(randomizeAppearance())}>
          무작위 선택
        </button>
        <button type="button" className="choice" onClick={() => onChange(defaultCharacterAppearance)}>
          기본 캐릭터
        </button>
      </div>

      <div className="character-customizer__panel">
        <h2>완성 하객 캐릭터</h2>
        <div className="customizer-options customizer-options--images">
          {guestCharacterPresets.map((preset) => {
            const appearance = updateAppearance(value, preset.id);
            const selected = selectedPreset.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`customizer-option customizer-option--image ${selected ? "customizer-option--selected" : ""}`}
                aria-label={preset.label}
                aria-pressed={selected}
                onClick={() => onChange(appearance)}
              >
                <span className="customizer-option__sprite" aria-hidden="true">
                  <CharacterSprite appearance={appearance} direction="down" moving={false} />
                </span>
                <span>{preset.label}</span>
                {selected ? <span className="customizer-option__check" aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

`client/src/components/EntryScreen.tsx` 안내 문구를 바꾼다.

```tsx
<span>정원에 입장할 완성 하객 캐릭터를 선택해주세요.</span>
```

- [ ] **Step 6: UI 테스트 통과**

Run:

```bash
pnpm --filter @wedding-game/client test -- --run client/src/character/appearanceState.test.ts client/src/components/CharacterCustomizer.test.tsx client/src/components/EntryScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add client/src/character/appearanceState.ts client/src/character/appearanceState.test.ts client/src/components/CharacterCustomizer.tsx client/src/components/CharacterCustomizer.test.tsx client/src/components/EntryScreen.tsx client/src/components/EntryScreen.test.tsx
git commit -m "feat: select finished guest character presets"
```

## Task 6: 저장값, 실시간 메시지, worker 테스트 호환성 정리

**Files:**

- Modify: `client/src/character/storage.test.ts`
- Modify: `client/src/realtime/realtimeClient.ts`
- Modify: `client/src/realtime/realtimeClient.test.ts`
- Modify: `client/src/components/GameWorld.test.tsx`
- Modify: `worker/src/GardenRoom.test.ts`
- Modify: `shared/src/validation.ts`
- Modify: `shared/src/validation.test.ts`

- [ ] **Step 1: 저장값 호환 테스트 갱신**

`client/src/character/storage.test.ts`의 invalid 객체 테스트를 다음으로 바꾼다.

```ts
it("알 수 없는 appearance 객체를 기본 프리셋으로 변환해서 로드한다", () => {
  window.localStorage.setItem("pixel-garden-character-v1", JSON.stringify({ family: "bad" }));
  expect(loadAppearance()).toEqual(defaultCharacterAppearance);
  expect(JSON.parse(window.localStorage.getItem("pixel-garden-character-v1") ?? "null"))
    .toEqual(defaultCharacterAppearance);
});
```

구버전 조합형 저장값 테스트도 추가한다.

```ts
it("구버전 조합형 appearance를 기본 프리셋으로 변환해서 로드한다", () => {
  window.localStorage.setItem("pixel-garden-character-v1", JSON.stringify({
    family: "feminine",
    skinTone: "skin-02-fair",
    hairStyle: "feminine-long-wave",
    hairColor: "dark-brown",
    outfit: "feminine-midi-dress",
    outfitPalette: "dusty-rose",
    accessories: { face: null, jewelry: null, neckwear: null, carry: null }
  }));

  expect(loadAppearance()).toEqual(defaultCharacterAppearance);
});
```

- [ ] **Step 2: 실시간 파서 테스트 갱신**

`client/src/realtime/realtimeClient.test.ts`에서 invalid appearance 테스트는 `presetId`가 유효하지 않은 객체가 기본으로 변환되는 흐름을 기대하도록 바꾼다. 서버 메시지에서 appearance를 엄격 reject하지 않고 안전 변환한다.

핵심 기대:

```ts
expect(handler).toHaveBeenCalledWith(expect.objectContaining({
  type: "welcome",
  guests: [expect.objectContaining({
    appearance: defaultCharacterAppearance
  })]
}));
```

- [ ] **Step 3: realtime parser 구현 변경**

`client/src/realtime/realtimeClient.ts`의 `isRoomGuest`에서 parse 결과를 버리지 않고 value에 정규화된 appearance를 다시 넣는다.

```ts
function normalizeRoomGuest(value: unknown) {
  if (!isRecord(value) || !isPositionState(value)) return null;
  if (
    typeof value.guestId !== "string" ||
    typeof value.nickname !== "string" ||
    typeof value.lastSeenAt !== "number" ||
    !Number.isFinite(value.lastSeenAt)
  ) {
    return null;
  }

  return {
    ...value,
    appearance: parseCharacterAppearance(value.appearance)
  };
}
```

`welcome`, `guest_joined`, `room_state` 분기는 `normalizeRoomGuest` 결과를 반환 객체에 반영한다.

- [ ] **Step 4: GameWorld와 worker 테스트 데이터 갱신**

테스트에서 appearance override가 있으면 모두 `{ presetId: "..." }` 형태로 바꾼다.

대표 예:

```ts
const profile = { nickname: "하객1", appearance: defaultCharacterAppearance };
```

구버전 세부 필드 기대값은 제거하고, `presetId`만 검증한다.

```ts
expect(joinMessage.appearance).toEqual(defaultCharacterAppearance);
```

- [ ] **Step 5: 호환성 테스트 통과**

Run:

```bash
pnpm --filter @wedding-game/shared test
pnpm --filter @wedding-game/client test -- --run client/src/character/storage.test.ts client/src/realtime/realtimeClient.test.ts client/src/components/GameWorld.test.tsx
pnpm --filter @wedding-game/worker test -- --run worker/src/GardenRoom.test.ts
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add client/src/character/storage.test.ts client/src/realtime/realtimeClient.ts client/src/realtime/realtimeClient.test.ts client/src/components/GameWorld.test.tsx worker/src/GardenRoom.test.ts shared/src/validation.ts shared/src/validation.test.ts
git commit -m "fix: normalize legacy guest appearances to presets"
```

## Task 7: 문서 고정, 전체 검증, 리뷰 이미지 확인

**Files:**

- Modify: `docs/character-art-direction-lock.md`
- Modify: `docs/superpowers/plans/2026-06-23-high-density-guest-part-system.md`
- Read: `docs/superpowers/specs/2026-06-24-complete-guest-character-presets-design.md`

- [ ] **Step 1: 아트 방향 문서 갱신**

`docs/character-art-direction-lock.md`의 “하객 캐릭터 파츠 고정”, “하객 아트 품질 패스 2 고정”, “A안 로맨틱 포멀 하객 원형 고정” 섹션에 다음 결론을 명시한다.

```md
## 하객 완성 캐릭터 프리셋 고정

2026-06-24 이후 하객 캐릭터는 부위별 조합형 파츠 시스템을 런타임 기준으로 사용하지 않는다. 하객은 확정된 기초 이미지 기준의 완성 캐릭터 프리셋을 선택하는 방식으로 고정한다.

기준 파일:

- `character-assets/guest-character-presets.json`
- `character-assets/source/guests/*`
- `client/public/characters/generated/guests/*`
- `.superpowers/character-review/guest-preset-contact-sheet.png`

고정 규칙:

- 사용자는 헤어, 의상, 액세서리를 따로 조합하지 않는다.
- 각 하객은 얼굴, 헤어, 의상, 액세서리가 함께 설계된 완성 스프라이트다.
- 얼굴이 외계인처럼 보이거나 눌려 보이는 프리셋은 실패로 본다.
- 기준 이미지의 둥근 얼굴, 작고 분리된 눈, 작은 입, 웨딩 하객 포멀 의상 톤을 유지한다.
- 기존 `guest-part-manifest.json`과 base/hair/outfits/accessories 소스는 레거시 자료이며 하객 런타임 품질 기준이 아니다.
```

- [ ] **Step 2: 전체 검증 실행**

Run:

```bash
pnpm characters:author-guest-presets
pnpm characters:audit
pnpm characters:generate
pnpm characters:contact-sheet -- --mode=guest-presets --output=.superpowers/character-review/guest-preset-contact-sheet.png
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Expected: 모두 PASS.

- [ ] **Step 3: 리뷰 이미지 직접 확인**

Run:

```bash
file .superpowers/character-review/guest-preset-contact-sheet.png
```

Expected: PNG 이미지로 확인된다. 이후 로컬 이미지 뷰어로 `.superpowers/character-review/guest-preset-contact-sheet.png`를 열어 다음을 확인한다.

- 4개 프리셋 모두 얼굴이 사람답게 보인다.
- 각 프리셋의 실루엣이 서로 구분된다.
- 롱 웨이브 원피스, 여성 한복, 네이비 수트, 차콜 블레이저가 기준 이미지의 네 캐릭터 방향과 맞다.
- 정원 표시 크기에서도 하객으로 읽힌다.

- [ ] **Step 4: 최종 커밋**

```bash
git add docs/character-art-direction-lock.md docs/superpowers/plans/2026-06-23-high-density-guest-part-system.md
git commit -m "docs: lock guest character preset direction"
```

## 완료 기준

- `CharacterAppearance`가 `presetId` 중심으로 동작한다.
- 하객 커스터마이저에서 파츠 탭이 사라지고 완성 캐릭터 카드만 표시된다.
- 로컬 플레이어와 원격 하객 모두 완성 프리셋 스프라이트로 표시된다.
- 구버전 appearance가 들어와도 화면이 깨지지 않고 기본 프리셋으로 정규화된다.
- `pnpm characters:contact-sheet -- --mode=guest-presets`로 4개 완성 하객 리뷰 이미지가 생성된다.
- `pnpm characters:audit`, `pnpm characters:test`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `git diff --check`가 모두 통과한다.
- 문서와 사용자-facing 라벨은 한국어로 유지된다.

import test from "node:test";
import assert from "node:assert/strict";
import {
  auditGameResourceBudgets,
  auditPwaCacheBudgets,
  gameResourceBudgets,
  parsePwaFeaturePaths,
  parsePwaPrecachePaths,
  pwaDistPath,
  summarizeGameResourceStates
} from "./lib/gameResourceBudget.mjs";

function resource(resourcePath, kind, bytes, gzipBytes = 0) {
  return { path: resourcePath, url: `https://example.test/${resourcePath}`, kind, bytes, gzipBytes };
}

test("service-worker precache manifest is parsed for missing-asset verification", () => {
  assert.deepEqual(parsePwaPrecachePaths('const PRECACHE_URLS = ["./", "./assets/index-a.js"];'), [
    "./",
    "./assets/index-a.js"
  ]);
  assert.throws(() => parsePwaPrecachePaths("const VERSION = 'missing';"), /PRECACHE_URLS missing/);
  assert.deepEqual(parsePwaFeaturePaths('const FEATURE_URLS = ["./assets/optional-a.js"];'), [
    "./assets/optional-a.js"
  ]);
  assert.throws(() => parsePwaFeaturePaths("const VERSION = 'missing';"), /FEATURE_URLS missing/);
  assert.equal(
    pwaDistPath("./characters/generated/guests/default__idle.png?v=optical-three-head-v2"),
    "characters/generated/guests/default__idle.png"
  );
});

test("PWA cache budgets cover core and optional bytes plus missing assets", () => {
  const precache = {
    core: { rawBytes: 2_900_000, transferBytes: 2_000_000, missing: [], largest: [], total: 82 },
    features: { rawBytes: 900_000, transferBytes: 260_000, missing: [], largest: [], total: 40 }
  };
  assert.deepEqual(auditPwaCacheBudgets(precache), []);
  assert.deepEqual(auditPwaCacheBudgets({
    core: { ...precache.core, transferBytes: 2_300_001, missing: ["./missing-core.js"] },
    features: { ...precache.features, rawBytes: 1_100_001, missing: ["./missing-feature.js"] }
  }), [
    "핵심 오프라인 저장 자산 누락 ./missing-core.js",
    "선택 기능 오프라인 저장 자산 누락 ./missing-feature.js",
    "핵심 오프라인 캐시 전송 용량 초과 2300001/2300000",
    "선택 기능 캐시 원본 용량 초과 1100001/1100000"
  ]);
});

const baseResources = [
  resource("assets/index-a.css", "css", 200_000, 50_000),
  resource("assets/GameWorld-b.css", "css", 220_000, 45_000),
  resource("assets/noto-sans-kr-0.woff2", "font", 80_000)
];

test("resource budget summarizes route deltas instead of double-counting cached assets", () => {
  const states = {
    base: { resources: baseResources },
    directions: { resources: [...baseResources] },
    vault: {
      resources: [
        ...baseResources,
        resource("assets/game-vault-optional-c.css", "css", 19_000, 3_600),
        resource("assets/wght-d.css", "css", 79_000, 26_000),
        resource("assets/noto-sans-kr-105.woff2", "font", 25_000)
      ]
    }
  };
  assert.deepEqual(summarizeGameResourceStates(states), {
    base: {
      cssRequests: 2,
      cssGzipBytes: 95_000,
      fontRequests: 1,
      fontBytes: 80_000,
      gameWorldCssGzipBytes: 45_000,
      css: baseResources.slice(0, 2),
      fonts: baseResources.slice(2)
    },
    directions: { additionalCssRequests: 0, additionalFontRequests: 0, css: [], fonts: [] },
    vault: {
      additionalCssRequests: 2,
      additionalCssGzipBytes: 29_600,
      additionalFontRequests: 1,
      additionalFontBytes: 25_000,
      css: [
        resource("assets/game-vault-optional-c.css", "css", 19_000, 3_600),
        resource("assets/wght-d.css", "css", 79_000, 26_000)
      ],
      fonts: [resource("assets/noto-sans-kr-105.woff2", "font", 25_000)]
    }
  });
  assert.deepEqual(auditGameResourceBudgets(states).issues, []);
});

test("resource budget catches optional CSS leaks and route request growth", () => {
  const states = {
    base: {
      resources: [
        ...baseResources,
        resource("assets/game-vault-optional-leak.css", "css", 19_000, 3_600)
      ]
    },
    directions: {
      resources: [
        ...baseResources,
        resource("assets/game-vault-optional-leak.css", "css", 19_000, 3_600),
        resource("assets/directions-extra.css", "css", 4_000, 1_000),
        resource("assets/directions-font-1.woff2", "font", 20_000),
        resource("assets/directions-font-2.woff2", "font", 20_000),
        resource("assets/directions-font-3.woff2", "font", 20_000)
      ]
    },
    vault: { resources: baseResources }
  };
  const relaxedBase = {
    ...gameResourceBudgets,
    base: { ...gameResourceBudgets.base, maxCssRequests: 3, maxCssGzipBytes: 120_000 }
  };
  assert.deepEqual(auditGameResourceBudgets(states, relaxedBase).issues, [
    "기본 게임 선택 기능 CSS 선로드 assets/game-vault-optional-leak.css",
    "오시는 길 추가 CSS 요청 초과 1/0",
    "오시는 길 추가 폰트 요청 초과 3/2",
    "게임 기록·설정 선택 CSS 지연 로드 측정 누락"
  ]);
});

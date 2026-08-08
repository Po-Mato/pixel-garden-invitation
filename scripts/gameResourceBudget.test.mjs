import test from "node:test";
import assert from "node:assert/strict";
import {
  auditGameResourceBudgets,
  gameResourceBudgets,
  parsePwaFeaturePaths,
  parsePwaPrecachePaths,
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

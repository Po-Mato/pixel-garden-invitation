import test from "node:test";
import assert from "node:assert/strict";
import {
  auditPwaUpdateRollbackCanary,
  createServiceWorkerVariant
} from "./lib/pwaUpdateRollbackCanary.mjs";

const ready = {
  brokenInstallState: "redundant",
  previousControllerSurvived: true,
  previousCacheSurvived: true,
  brokenCachePresent: false,
  offlineAfterRejectedUpdate: true,
  updateInstallState: "installed",
  updatedControllerActive: true,
  updatedCacheComplete: true,
  previousCacheAfterUpdate: false,
  rollbackInstallState: "installed",
  rollbackControllerActive: true,
  rollbackCacheComplete: true,
  updatedCacheAfterRollback: false,
  offlineAfterRollback: true,
  pageErrors: []
};

test("update/rollback canary accepts atomic replacement and restored offline cache", () => {
  assert.deepEqual(auditPwaUpdateRollbackCanary(ready), []);
});

test("update/rollback canary reports controller and cache regressions", () => {
  assert.deepEqual(auditPwaUpdateRollbackCanary({
    ...ready,
    brokenInstallState: "installed",
    previousCacheSurvived: false,
    brokenCachePresent: true,
    updatedControllerActive: false,
    previousCacheAfterUpdate: true,
    rollbackCacheComplete: false,
    updatedCacheAfterRollback: true,
    offlineAfterRollback: false
  }), [
    "깨진 업데이트 설치가 거부되지 않음",
    "깨진 업데이트가 기존 프리캐시를 손상함",
    "깨진 업데이트의 부분 프리캐시 잔존",
    "정상 업데이트 제어권 전환 실패",
    "정상 업데이트 후 이전 프리캐시 잔존",
    "롤백 프리캐시 불완전",
    "롤백 후 신규 프리캐시 잔존",
    "롤백 후 오프라인 재실행 실패"
  ]);
});

test("service worker variants replace version and append deliberate canary assets", () => {
  const source = 'const VERSION = "original";\nconst PRECACHE_URLS = ["./", "./index.html"];\n';
  const variant = createServiceWorkerVariant(source, "next", ["./missing"]);
  assert.match(variant, /const VERSION = "next";/);
  assert.match(variant, /const PRECACHE_URLS = \["\.\/","\.\/index\.html","\.\/missing"\];/);
});

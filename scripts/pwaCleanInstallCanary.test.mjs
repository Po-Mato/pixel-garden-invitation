import test from "node:test";
import assert from "node:assert/strict";
import {
  auditPwaCleanInstallCanary,
  auditPwaReadinessTimeline,
  criticalOfflineAssetFailures
} from "./lib/pwaCleanInstallCanary.mjs";

const readinessTimeline = [
  "first-navigation", "entry-visible", "service-worker-ready", "precache-ready", "session-seeded",
  "offline-enabled", "preview-stopped", "offline-reload-complete", "offline-entry-visible", "offline-game-visible"
].map((phase) => ({ phase, outcome: "completed" }));

const ready = {
  serviceWorkerSupported: true,
  controlled: true,
  precacheName: "wedding-garden-precache-release",
  cachedPaths: 24,
  expectedPaths: 24,
  offlineEntryVisible: true,
  offlineStatusVisible: true,
  offlineGameVisible: true,
  blockingNoticeVisible: false,
  fallbackDocumentVisible: false,
  criticalAssetFailures: [],
  pageErrors: [],
  readinessTimeline
};

test("clean-install canary accepts a fully cached offline invitation journey", () => {
  assert.deepEqual(auditPwaCleanInstallCanary(ready), []);
});

test("clean-install canary reports the exact missing readiness phases", () => {
  assert.deepEqual(auditPwaReadinessTimeline(readinessTimeline.slice(0, -2)), [
    "PWA 준비 단계 증거 누락 offline-entry-visible, offline-game-visible"
  ]);
});

test("clean-install canary reports cache and offline fallback regressions", () => {
  assert.deepEqual(auditPwaCleanInstallCanary({
    ...ready,
    controlled: false,
    cachedPaths: 20,
    offlineGameVisible: false,
    blockingNoticeVisible: true,
    fallbackDocumentVisible: true,
    criticalAssetFailures: ["/assets/missing-font.woff2"],
    pageErrors: ["chunk missing"]
  }), [
    "첫 설치 페이지 제어 실패",
    "핵심 프리캐시 누락 20/24",
    "오프라인 저장 여정 재개 실패",
    "오프라인 재실행 차단 안내 노출",
    "오프라인 비상 문서로 강등",
    "오프라인 핵심 화면 자산 누락 /assets/missing-font.woff2",
    "오프라인 재실행 페이지 오류 chunk missing"
  ]);
});

test("clean-install canary ignores expected offline API fallbacks but keeps static asset failures", () => {
  assert.deepEqual(criticalOfflineAssetFailures([
    { url: "http://127.0.0.1:4187/api/invitations/sample/release" },
    { url: "http://127.0.0.1:4187/assets/GameWorld-missing.js" },
    { url: "https://worker.example/api/invitations/sample/release" }
  ], "http://127.0.0.1:4187/"), ["/assets/GameWorld-missing.js"]);
});

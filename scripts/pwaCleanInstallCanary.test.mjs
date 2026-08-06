import test from "node:test";
import assert from "node:assert/strict";
import { auditPwaCleanInstallCanary } from "./lib/pwaCleanInstallCanary.mjs";

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
  pageErrors: []
};

test("clean-install canary accepts a fully cached offline invitation journey", () => {
  assert.deepEqual(auditPwaCleanInstallCanary(ready), []);
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

import assert from "node:assert/strict";
import test from "node:test";
import { auditDevicePwaOffline } from "./lib/devicePwaOfflineAudit.mjs";

const healthy = {
  cleanInstallReady: true,
  previewHostUnavailable: true,
  serviceWorkerSupported: true,
  controlled: true,
  precacheName: "wedding-garden-precache-device",
  cachedPaths: 32,
  expectedPaths: 32,
  offlineEntryVisible: true,
  offlineStatusVisible: true,
  offlineGameVisible: true,
  blockingNoticeVisible: false,
  fallbackDocumentVisible: false,
  criticalAssetFailures: [],
  brokenImages: [],
  pageErrors: []
};

test("device PWA audit accepts a clean installed offline journey", () => {
  assert.deepEqual(auditDevicePwaOffline(healthy), []);
});

test("device PWA audit rejects stale install, live host, and broken offline assets", () => {
  const issues = auditDevicePwaOffline({
    ...healthy,
    cleanInstallReady: false,
    previewHostUnavailable: false,
    controlled: false,
    brokenImages: ["/assets/guest.png"],
    criticalAssetFailures: ["/assets/guest.png"]
  });
  assert.ok(issues.some((issue) => issue.includes("초기화")));
  assert.ok(issues.some((issue) => issue.includes("서버 종료")));
  assert.ok(issues.some((issue) => issue.includes("이미지 손상")));
  assert.ok(issues.some((issue) => issue.includes("페이지 제어")));
});

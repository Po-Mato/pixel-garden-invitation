import assert from "node:assert/strict";
import test from "node:test";
import {
  auditDevicePwaOffline,
  describeDevicePwaPrecacheSnapshot
} from "./lib/devicePwaOfflineAudit.mjs";

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
  navigatorOnlineAfterReload: true,
  offlineEventDispatched: true,
  transportProbe: {
    previewHostReachableAfterStop: false,
    browserFetchResolved: false,
    browserError: "Failed to fetch",
    transportBlocked: true
  },
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

test("device PWA audit rejects an offline label without blocked browser transport", () => {
  const issues = auditDevicePwaOffline({
    ...healthy,
    transportProbe: {
      previewHostReachableAfterStop: false,
      browserFetchResolved: true,
      browserStatus: 200,
      transportBlocked: false
    }
  });
  assert.ok(issues.includes("오프라인 실제 전송 차단 실패"));
});

test("device PWA precache diagnostics preserve the last retry state", () => {
  assert.equal(describeDevicePwaPrecacheSnapshot(null), "snapshot=unavailable");
  assert.equal(
    describeDevicePwaPrecacheSnapshot({
      controlled: false,
      precacheName: "wedding-garden-precache-release",
      cachedPaths: 81,
      expectedPaths: 82,
      error: "install stalled"
    }),
    "controlled=false · precache=wedding-garden-precache-release · cached=81/82 · error=install stalled"
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  auditPhysicalQualityCaptureSession,
  buildPhysicalQualityEvidence,
  createPhysicalQualityCaptureTemplate,
  physicalQualityCaptureArtifactCount,
  physicalQualityCaptureEntries
} from "./lib/physicalQualityCapture.mjs";

test("physical capture session enumerates all nine real-device evidence artifacts", () => {
  const session = createPhysicalQualityCaptureTemplate({
    androidDevices: [{ id: "android-1" }],
    iosDevices: [{ id: "ios-1" }]
  });
  assert.equal(physicalQualityCaptureArtifactCount, 9);
  assert.equal(physicalQualityCaptureEntries(session).length, 9);
  assert.equal(session.accessibility.android.deviceId, "android-1");
  assert.equal(session.accessibility.ios.deviceId, "ios-1");
  assert.deepEqual(auditPhysicalQualityCaptureSession(session), []);
  session.motion[0].artifactPath = session.accessibility.android.artifactPath;
  assert.deepEqual(auditPhysicalQualityCaptureSession(session), [
    "60hz-normal 증거 파일 경로 중복 evidence/android-talkback.mp4"
  ]);
});

test("physical capture seals reviewer metadata and artifact hashes without inventing measurements", () => {
  const session = createPhysicalQualityCaptureTemplate();
  session.reviewedBy = "QA";
  session.capturedAt = "2026-08-09T00:00:00.000Z";
  const hashes = new Map(physicalQualityCaptureEntries(session).map(([, entry], index) => [
    entry.artifactPath, String(index).padStart(64, "a")
  ]));
  const evidence = buildPhysicalQualityEvidence(session, hashes);
  assert.equal(evidence.version, 2);
  assert.equal(evidence.displayCalibration.length, 4);
  assert.equal(evidence.motion.length, 3);
  assert.equal(evidence.accessibility.android.reviewedBy, "QA");
  assert.equal(evidence.accessibility.android.artifactSha256.length, 64);
  assert.equal(evidence.motion[0].inputLatencyMs, null);
});

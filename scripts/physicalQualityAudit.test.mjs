import assert from "node:assert/strict";
import test from "node:test";
import {
  assessPhysicalQualityEvidence,
  parseAdbDevices,
  parseDisplays,
  parseXctraceDevices,
  physicalAccessibilityFlow,
  physicalQualityEvidenceVersion,
  requiredDisplayScenarios,
  requiredMotionScenarios
} from "./lib/physicalQualityAudit.mjs";

test("physical quality contract covers both screen readers, display conditions, and motion modes", () => {
  assert.deepEqual(physicalAccessibilityFlow, ["entry", "menu", "directions", "close"]);
  assert.deepEqual(requiredDisplayScenarios, [
    "oled-low-brightness", "oled-outdoor-p3", "lcd-low-brightness", "lcd-outdoor-srgb"
  ]);
  assert.deepEqual(requiredMotionScenarios.map(({ id }) => id), [
    "60hz-normal", "120hz-normal", "60hz-low-power"
  ]);
});

test("device discovery parsers reject simulators and offline Android devices", () => {
  assert.deepEqual(parseAdbDevices("List of devices attached\nABC device product:p model:Pixel_8\nOFF offline\n"), [
    { id: "ABC", detail: "product:p model:Pixel_8" }
  ]);
  assert.deepEqual(parseXctraceDevices(`Known Devices:\nSJ iPhone (18.5) (00008110-001234567890001E)\niPhone 16 Pro Simulator (18.5) (AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE)\nSJ Mac (15.5) (MAC-ID)`), [
    { id: "00008110-001234567890001E", detail: "SJ iPhone" }
  ]);
  assert.deepEqual(parseDisplays("        Odyssey G70B:\n          UI Looks like: 3840 x 2160 @ 60.00Hz\n"), [
    { name: "Odyssey G70B", refreshHz: 60 }
  ]);
});

test("physical quality evidence passes only when every real-device scenario is complete", () => {
  const flow = Object.fromEntries(physicalAccessibilityFlow.map((step) => [step, true]));
  const integrity = {
    reviewedBy: "QA",
    capturedAt: "2026-08-07T03:00:00.000Z",
    artifactPath: "evidence.mp4",
    artifactSha256: "a".repeat(64),
    artifactVerified: true
  };
  const evidence = {
    version: physicalQualityEvidenceVersion,
    accessibility: {
      android: { ...integrity, deviceId: "android-1", screenReaderEnabled: true, flow },
      ios: { ...integrity, deviceId: "ios-1", screenReaderEnabled: true, flow }
    },
    displayCalibration: requiredDisplayScenarios.map((id) => ({
      ...integrity, id, deviceModel: "fixture", panel: id.startsWith("oled") ? "oled" : "lcd",
      brightnessPercent: 20, ambientLux: 50, labelsReadable: true,
      characterEdgesClear: true, uiOverlapFree: true
    })),
    motion: requiredMotionScenarios.map(({ id }) => ({
      ...integrity, id, inputLatencyMs: 20, settleLatencyMs: 120, settledJitterPx: 0.25
    }))
  };
  const report = assessPhysicalQualityEvidence({
    evidence,
    androidDevices: [{ id: "android-1", detail: "Pixel" }],
    iosDevices: [{ id: "ios-1", detail: "iPhone" }],
    displays: [],
    now: new Date("2026-08-07T04:00:00.000Z")
  });
  assert.equal(report.status, "passed");
  assert.deepEqual(report.issues, []);
});

test("physical quality evidence rejects stale or checksum-unbound captures", () => {
  const report = assessPhysicalQualityEvidence({
    evidence: {
      version: physicalQualityEvidenceVersion,
      accessibility: {
        android: {
          deviceId: "android-1", reviewedBy: "QA", capturedAt: "2026-07-01T00:00:00.000Z",
          artifactPath: "talkback.mp4", artifactSha256: "b".repeat(64), artifactVerified: false,
          screenReaderEnabled: true,
          flow: Object.fromEntries(physicalAccessibilityFlow.map((step) => [step, true]))
        }
      }
    },
    androidDevices: [{ id: "android-1", detail: "Pixel" }],
    now: new Date("2026-08-07T04:00:00.000Z")
  });
  assert.equal(report.status, "pending");
  assert.ok(report.issues.includes("android 증거가 14일보다 오래됨"));
  assert.ok(report.issues.includes("android 증거 파일 SHA-256 불일치"));
});

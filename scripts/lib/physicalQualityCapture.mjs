import {
  physicalAccessibilityFlow,
  physicalQualityEvidenceVersion,
  requiredDisplayScenarios,
  requiredMotionScenarios
} from "./physicalQualityAudit.mjs";

export const physicalQualityCaptureArtifactCount = 9;

export function assessPhysicalQualityCaptureReadiness({
  adbAvailable = false,
  xctraceAvailable = false,
  androidDevices = [],
  iosDevices = []
} = {}) {
  const issues = [];
  if (!adbAvailable) issues.push("Android Platform Tools(adb) 설치 필요");
  else if (androidDevices.length === 0) issues.push("USB 디버깅을 허용한 실제 Android 연결 필요");
  if (!xctraceAvailable) issues.push("Xcode 명령줄 도구(xctrace) 설치 필요");
  else if (iosDevices.length === 0) issues.push("신뢰 연결된 실제 iPhone 연결 필요");
  return {
    status: issues.length === 0 ? "ready" : "blocked",
    android: { toolAvailable: adbAvailable, devices: androidDevices },
    ios: { toolAvailable: xctraceAvailable, devices: iosDevices },
    requiredArtifactCount: physicalQualityCaptureArtifactCount,
    issues
  };
}

const completedFlow = (value = false) => Object.fromEntries(
  physicalAccessibilityFlow.map((step) => [step, value])
);

export function createPhysicalQualityCaptureTemplate({ androidDevices = [], iosDevices = [] } = {}) {
  return {
    version: 1,
    reviewedBy: "",
    capturedAt: "",
    accessibility: {
      android: {
        deviceId: androidDevices[0]?.id ?? "",
        artifactPath: "evidence/android-talkback.mp4",
        flow: completedFlow()
      },
      ios: {
        deviceId: iosDevices[0]?.id ?? "",
        screenReaderEnabled: false,
        artifactPath: "evidence/ios-voiceover.mp4",
        flow: completedFlow()
      }
    },
    displayCalibration: requiredDisplayScenarios.map((id) => ({
      id,
      deviceModel: "",
      panel: id.startsWith("oled") ? "oled" : "lcd",
      brightnessPercent: null,
      ambientLux: null,
      artifactPath: `evidence/${id}.jpg`,
      labelsReadable: false,
      characterEdgesClear: false,
      uiOverlapFree: false
    })),
    motion: requiredMotionScenarios.map(({ id }) => ({
      id,
      inputLatencyMs: null,
      settleLatencyMs: null,
      settledJitterPx: null,
      artifactPath: `evidence/${id}.mp4`
    }))
  };
}

export function physicalQualityCaptureEntries(session) {
  return [
    ["android", session.accessibility?.android],
    ["ios", session.accessibility?.ios],
    ...requiredDisplayScenarios.map((id) => [id, session.displayCalibration?.find((item) => item.id === id)]),
    ...requiredMotionScenarios.map(({ id }) => [id, session.motion?.find((item) => item.id === id)])
  ];
}

export function auditPhysicalQualityCaptureSession(session) {
  const entries = physicalQualityCaptureEntries(session);
  const issues = [];
  const paths = new Set();
  for (const [id, entry] of entries) {
    if (!entry) {
      issues.push(`${id} 수집 항목 누락`);
      continue;
    }
    if (typeof entry.artifactPath !== "string" || entry.artifactPath.length === 0) {
      issues.push(`${id} 증거 파일 경로 누락`);
    } else if (paths.has(entry.artifactPath)) {
      issues.push(`${id} 증거 파일 경로 중복 ${entry.artifactPath}`);
    } else {
      paths.add(entry.artifactPath);
    }
  }
  return issues;
}

export function buildPhysicalQualityEvidence(session, artifactShaByPath = new Map()) {
  const common = (entry) => ({
    ...entry,
    reviewedBy: entry?.reviewedBy || session.reviewedBy,
    capturedAt: entry?.capturedAt || session.capturedAt,
    artifactSha256: artifactShaByPath.get(entry?.artifactPath) ?? ""
  });
  const displayById = new Map((session.displayCalibration ?? []).map((entry) => [entry.id, entry]));
  const motionById = new Map((session.motion ?? []).map((entry) => [entry.id, entry]));
  return {
    version: physicalQualityEvidenceVersion,
    accessibility: {
      android: common(session.accessibility?.android),
      ios: common(session.accessibility?.ios)
    },
    displayCalibration: requiredDisplayScenarios.map((id) => common(displayById.get(id))),
    motion: requiredMotionScenarios.map(({ id }) => common(motionById.get(id)))
  };
}

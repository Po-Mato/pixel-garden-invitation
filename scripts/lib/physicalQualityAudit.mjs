export const physicalAccessibilityFlow = Object.freeze([
  "entry",
  "menu",
  "directions",
  "close"
]);

export const physicalQualityEvidenceVersion = 2;
export const maximumEvidenceAgeDays = 14;

export const requiredDisplayScenarios = Object.freeze([
  "oled-low-brightness",
  "oled-outdoor-p3",
  "lcd-low-brightness",
  "lcd-outdoor-srgb"
]);

export const requiredMotionScenarios = Object.freeze([
  { id: "60hz-normal", maximumInputLatencyMs: 50, maximumSettleLatencyMs: 250, maximumJitterPx: 0.75 },
  { id: "120hz-normal", maximumInputLatencyMs: 30, maximumSettleLatencyMs: 200, maximumJitterPx: 0.75 },
  { id: "60hz-low-power", maximumInputLatencyMs: 80, maximumSettleLatencyMs: 320, maximumJitterPx: 1 }
]);

export function parseAdbDevices(output) {
  return String(output).split(/\r?\n/).slice(1).flatMap((line) => {
    const match = line.trim().match(/^(\S+)\s+device(?:\s+(.*))?$/);
    if (!match) return [];
    return [{ id: match[1], detail: match[2] ?? "" }];
  });
}

export function parseXctraceDevices(output) {
  return String(output).split(/\r?\n/).flatMap((line) => {
    if (/Simulator|Mac \(|Apple Watch|Apple TV/.test(line)) return [];
    const match = line.trim().match(/^(.+?)\s+\([^)]*\)\s+\(([0-9A-Fa-f-]{20,})\)$/);
    if (!match) return [];
    return [{ id: match[2], detail: match[1].trim() }];
  });
}

export function parseDisplays(output) {
  const displays = [];
  let current = null;
  for (const line of String(output).split(/\r?\n/)) {
    const name = line.match(/^\s{8}([^:]+):\s*$/)?.[1];
    if (name && name !== "Displays") {
      current = { name, refreshHz: null };
      displays.push(current);
      continue;
    }
    const refresh = line.match(/UI Looks like:.*@\s*([\d.]+)Hz/);
    if (current && refresh) current.refreshHz = Number(refresh[1]);
  }
  return displays;
}

function checkEvidenceIntegrity(id, evidence, now) {
  const issues = [];
  if (typeof evidence.reviewedBy !== "string" || evidence.reviewedBy.trim().length < 2) {
    issues.push(`${id} 검토자 기록 누락`);
  }
  const capturedAt = Date.parse(evidence.capturedAt ?? "");
  if (!Number.isFinite(capturedAt)) issues.push(`${id} 촬영 시각 누락`);
  else {
    const ageMs = now.getTime() - capturedAt;
    if (ageMs < -300_000) issues.push(`${id} 촬영 시각이 미래임`);
    if (ageMs > maximumEvidenceAgeDays * 86_400_000) issues.push(`${id} 증거가 ${maximumEvidenceAgeDays}일보다 오래됨`);
  }
  if (typeof evidence.artifactPath !== "string" || evidence.artifactPath.length === 0) {
    issues.push(`${id} 증거 파일 경로 누락`);
  }
  if (!/^[a-f0-9]{64}$/i.test(evidence.artifactSha256 ?? "")) issues.push(`${id} SHA-256 누락`);
  if (evidence.artifactVerified !== true) issues.push(`${id} 증거 파일 SHA-256 불일치`);
  return issues;
}

function checkAccessibility(platform, evidence, connectedIds, now) {
  if (!evidence) return { id: platform, status: "pending", issues: [`${platform} 스크린리더 실기기 증거 없음`] };
  const issues = checkEvidenceIntegrity(platform, evidence, now);
  if (!connectedIds.has(evidence.deviceId)) issues.push(`${platform} 증거 기기가 현재 연결되지 않음`);
  if (evidence.screenReaderEnabled !== true) issues.push(`${platform} 스크린리더 활성 확인 누락`);
  for (const step of physicalAccessibilityFlow) {
    if (evidence.flow?.[step] !== true) issues.push(`${platform} ${step} 동선 확인 누락`);
  }
  return { id: platform, status: issues.length === 0 ? "passed" : "pending", issues };
}

function checkDisplays(evidence, now) {
  return requiredDisplayScenarios.map((id) => {
    const capture = evidence.find((item) => item.id === id);
    const issues = [];
    if (!capture) issues.push(`${id} 실기기 보정 증거 없음`);
    else {
      issues.push(...checkEvidenceIntegrity(id, capture, now));
      if (!capture.deviceModel || !capture.panel) issues.push(`${id} 기기·패널 정보 누락`);
      if (!Number.isFinite(capture.brightnessPercent)) issues.push(`${id} 밝기 기록 누락`);
      if (!Number.isFinite(capture.ambientLux)) issues.push(`${id} 주변 조도 기록 누락`);
      if (capture.labelsReadable !== true) issues.push(`${id} 라벨 가독성 미통과`);
      if (capture.characterEdgesClear !== true) issues.push(`${id} 캐릭터 경계 미통과`);
      if (capture.uiOverlapFree !== true) issues.push(`${id} UI 중첩 미통과`);
    }
    return { id, status: issues.length === 0 ? "passed" : "pending", issues };
  });
}

function checkMotion(evidence, now) {
  return requiredMotionScenarios.map((policy) => {
    const sample = evidence.find((item) => item.id === policy.id);
    const issues = [];
    if (!sample) issues.push(`${policy.id} 실기기 동작 표본 없음`);
    else {
      issues.push(...checkEvidenceIntegrity(policy.id, sample, now));
      if (!Number.isFinite(sample.inputLatencyMs) || sample.inputLatencyMs > policy.maximumInputLatencyMs) {
        issues.push(`${policy.id} 입력 지연 ${sample.inputLatencyMs ?? "미측정"}ms`);
      }
      if (!Number.isFinite(sample.settleLatencyMs) || sample.settleLatencyMs > policy.maximumSettleLatencyMs) {
        issues.push(`${policy.id} 카메라 안정화 ${sample.settleLatencyMs ?? "미측정"}ms`);
      }
      if (!Number.isFinite(sample.settledJitterPx) || sample.settledJitterPx > policy.maximumJitterPx) {
        issues.push(`${policy.id} 정지 흔들림 ${sample.settledJitterPx ?? "미측정"}px`);
      }
    }
    return { id: policy.id, status: issues.length === 0 ? "passed" : "pending", issues };
  });
}

export function assessPhysicalQualityEvidence({ evidence = {}, androidDevices = [], iosDevices = [], displays = [], now = new Date() }) {
  const schemaIssues = evidence.version === physicalQualityEvidenceVersion
    ? [] : [`실기기 증거 형식 v${physicalQualityEvidenceVersion} 필요`];
  const accessibility = [
    checkAccessibility("android", evidence.accessibility?.android, new Set(androidDevices.map(({ id }) => id)), now),
    checkAccessibility("ios", evidence.accessibility?.ios, new Set(iosDevices.map(({ id }) => id)), now)
  ];
  const displayCalibration = checkDisplays(evidence.displayCalibration ?? [], now);
  const motion = checkMotion(evidence.motion ?? [], now);
  const checks = [...accessibility, ...displayCalibration, ...motion];
  return {
    status: schemaIssues.length === 0 && checks.every((check) => check.status === "passed") ? "passed" : "pending",
    detected: { androidDevices, iosDevices, displays },
    accessibility,
    displayCalibration,
    motion,
    issues: [...schemaIssues, ...checks.flatMap((check) => check.issues)]
  };
}

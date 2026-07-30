export type DeviceQaCheckId = "movement" | "portal" | "feedback" | "layout" | "photo";
export type DeviceQaCheckState = Record<DeviceQaCheckId, boolean>;
export type DeviceReadinessStatus = "pass" | "info" | "warning";

export type DeviceReadinessItem = {
  id: string;
  label: string;
  detail: string;
  status: DeviceReadinessStatus;
};

export type DeviceReadinessReport = {
  schema: "wedding-game-device-qa";
  version: 1;
  createdAt: string;
  deviceFamily: "iPhone/iPad" | "Android" | "기타";
  viewport: string;
  pixelRatio: number;
  items: DeviceReadinessItem[];
  manualChecks: DeviceQaCheckState;
};

export const deviceQaStorageKey = "wedding-game:device-qa:v1";
export const deviceQaChecks: readonly { id: DeviceQaCheckId; label: string }[] = [
  { id: "movement", label: "조이스틱과 타일 이동이 자연스러움" },
  { id: "portal", label: "포털 도착 후 전환이 자연스러움" },
  { id: "feedback", label: "발소리·진동·음소거가 정상 작동" },
  { id: "layout", label: "가로·세로 화면에서 UI가 겹치지 않음" },
  { id: "photo", label: "사진 저장·공유가 정상 작동" }
];

export function emptyDeviceQaChecks(): DeviceQaCheckState {
  return { movement: false, portal: false, feedback: false, layout: false, photo: false };
}

export function loadDeviceQaChecks(storage?: Pick<Storage, "getItem"> | null): DeviceQaCheckState {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    const value = JSON.parse(target?.getItem(deviceQaStorageKey) ?? "null") as Partial<DeviceQaCheckState> | null;
    return Object.fromEntries(deviceQaChecks.map(({ id }) => [id, value?.[id] === true])) as DeviceQaCheckState;
  } catch {
    return emptyDeviceQaChecks();
  }
}

export function saveDeviceQaChecks(checks: DeviceQaCheckState, storage?: Pick<Storage, "setItem"> | null) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(deviceQaStorageKey, JSON.stringify(checks));
  } catch {
    // The checklist remains usable in memory when device storage is blocked.
  }
}

function deviceFamily(userAgent: string): DeviceReadinessReport["deviceFamily"] {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iPhone/iPad";
  if (/Android/i.test(userAgent)) return "Android";
  return "기타";
}

export function buildDeviceReadinessReport(input: {
  userAgent: string;
  width: number;
  height: number;
  pixelRatio: number;
  touchPoints: number;
  online: boolean;
  storageAvailable: boolean;
  audioAvailable: boolean;
  vibrationAvailable: boolean;
  shareAvailable: boolean;
  standalone: boolean;
  manualChecks: DeviceQaCheckState;
  createdAt?: string;
}): DeviceReadinessReport {
  const shortSide = Math.min(input.width, input.height);
  const items: DeviceReadinessItem[] = [
    { id: "viewport", label: "화면 크기", detail: `${input.width}×${input.height} CSS px`, status: shortSide >= 320 ? "pass" : "warning" },
    { id: "touch", label: "터치 입력", detail: input.touchPoints > 0 ? `${input.touchPoints}점 멀티터치 감지` : "터치 입력을 감지하지 못함", status: input.touchPoints > 0 ? "pass" : "warning" },
    { id: "storage", label: "진행 저장", detail: input.storageAvailable ? "기기 저장소 사용 가능" : "기기 저장소 사용 불가", status: input.storageAvailable ? "pass" : "warning" },
    { id: "network", label: "네트워크", detail: input.online ? "온라인 연결" : "오프라인 모드", status: input.online ? "pass" : "info" },
    { id: "audio", label: "게임 사운드", detail: input.audioAvailable ? "웹 오디오 지원" : "웹 오디오 미지원", status: input.audioAvailable ? "pass" : "warning" },
    { id: "haptic", label: "햅틱", detail: input.vibrationAvailable ? "진동 API 지원" : "진동 API 미지원 또는 iOS", status: "info" },
    { id: "share", label: "사진 공유", detail: input.shareAvailable ? "기기 공유창 지원" : "파일 저장 방식 사용", status: input.shareAvailable ? "pass" : "info" },
    { id: "pwa", label: "홈 화면 모드", detail: input.standalone ? "앱 모드로 실행 중" : "브라우저에서 실행 중", status: "info" }
  ];
  return {
    schema: "wedding-game-device-qa",
    version: 1,
    createdAt: input.createdAt ?? new Date().toISOString(),
    deviceFamily: deviceFamily(input.userAgent),
    viewport: `${input.width}x${input.height}`,
    pixelRatio: input.pixelRatio,
    items,
    manualChecks: input.manualChecks
  };
}

export function collectDeviceReadinessReport(manualChecks: DeviceQaCheckState): DeviceReadinessReport {
  let storageAvailable = false;
  try {
    const key = "wedding-game:device-qa-probe";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return buildDeviceReadinessReport({
    userAgent: navigator.userAgent,
    width: Math.round(window.visualViewport?.width ?? window.innerWidth),
    height: Math.round(window.visualViewport?.height ?? window.innerHeight),
    pixelRatio: window.devicePixelRatio,
    touchPoints: navigator.maxTouchPoints,
    online: navigator.onLine,
    storageAvailable,
    audioAvailable: "AudioContext" in window || "webkitAudioContext" in window,
    vibrationAvailable: typeof navigator.vibrate === "function",
    shareAvailable: typeof navigator.share === "function",
    standalone,
    manualChecks
  });
}

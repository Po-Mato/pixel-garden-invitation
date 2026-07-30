import type { DeviceQaTrend } from "./deviceQaTrend";
import type { DeviceQaDeviceDetail } from "./deviceQaBreakdown";

export type DeviceQaAlertThreshold = "watch" | "regression";
export type DeviceQaAdminAlertPreferences = {
  enabled: boolean;
  threshold: DeviceQaAlertThreshold;
  lastNotifiedSignature: string | null;
  acknowledgedSignature: string | null;
};

export type DeviceQaAdminAlert = {
  severity: "watch" | "regression";
  signature: string;
  title: string;
  body: string;
};

const storageKey = "wedding-admin:device-qa-alerts:v1";
export const defaultDeviceQaAdminAlertPreferences: DeviceQaAdminAlertPreferences = {
  enabled: false,
  threshold: "regression",
  lastNotifiedSignature: null,
  acknowledgedSignature: null
};

export function createDeviceQaAdminAlert(trend: DeviceQaTrend, details: readonly DeviceQaDeviceDetail[] = []): DeviceQaAdminAlert | null {
  if (trend.status !== "watch" && trend.status !== "regression") return null;
  const currentPercent = Math.round(trend.currentRate * 100);
  const previousPercent = Math.round(trend.previousRate * 100);
  const leadingDevice = details.find(({ issues }) => issues > 0);
  const detailSignature = details.map(({ id, reports, warnings, issues }) => `${id}-${reports}-${warnings}-${issues}`).join(":");
  const leadingCopy = leadingDevice
    ? ` · ${leadingDevice.label} ${leadingDevice.topIssues[0]?.label ?? "불편"} ${leadingDevice.topIssues[0]?.count ?? leadingDevice.issues}건`
    : "";
  return {
    severity: trend.status,
    signature: `${trend.status}:${trend.currentReports}:${trend.currentIssues}:${trend.previousReports}:${trend.previousIssues}:${detailSignature}`,
    title: trend.status === "regression" ? "기기 QA 회귀 경고" : "기기 QA 주의 추세",
    body: `최근 불편 ${currentPercent}% · 직전 ${previousPercent}% · 최근 점검 ${trend.currentReports}회${leadingCopy}`
  };
}

export function shouldNotifyDeviceQaAlert(alert: DeviceQaAdminAlert, preferences: DeviceQaAdminAlertPreferences) {
  if (!preferences.enabled || preferences.lastNotifiedSignature === alert.signature) return false;
  return preferences.threshold === "watch" || alert.severity === "regression";
}

export function loadDeviceQaAdminAlertPreferences(storage: Pick<Storage, "getItem"> = localStorage): DeviceQaAdminAlertPreferences {
  try {
    const value = JSON.parse(storage.getItem(storageKey) ?? "null") as Partial<DeviceQaAdminAlertPreferences> | null;
    return {
      enabled: value?.enabled === true,
      threshold: value?.threshold === "watch" ? "watch" : "regression",
      lastNotifiedSignature: typeof value?.lastNotifiedSignature === "string" ? value.lastNotifiedSignature : null,
      acknowledgedSignature: typeof value?.acknowledgedSignature === "string" ? value.acknowledgedSignature : null
    };
  } catch {
    return defaultDeviceQaAdminAlertPreferences;
  }
}

export function saveDeviceQaAdminAlertPreferences(preferences: DeviceQaAdminAlertPreferences, storage: Pick<Storage, "setItem"> = localStorage) {
  try {
    storage.setItem(storageKey, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export async function requestDeviceQaNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported" as const;
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export async function showDeviceQaAdminNotification(alert: DeviceQaAdminAlert) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  const options: NotificationOptions = { body: alert.body, tag: `device-qa:${alert.signature}`, icon: "./icons/icon-192.png" };
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration) await registration.showNotification(alert.title, options);
    else new Notification(alert.title, options);
    return true;
  } catch {
    return false;
  }
}

import { describe, expect, it } from "vitest";
import {
  createDeviceQaAdminAlert,
  defaultDeviceQaAdminAlertPreferences,
  loadDeviceQaAdminAlertPreferences,
  saveDeviceQaAdminAlertPreferences,
  shouldNotifyDeviceQaAlert
} from "./deviceQaAdminAlerts";

describe("deviceQaAdminAlerts", () => {
  const regressionTrend = {
    status: "regression" as const,
    currentReports: 8,
    currentIssues: 4,
    currentRate: 0.5,
    previousReports: 8,
    previousIssues: 1,
    previousRate: 0.125,
    rateDelta: 0.375
  };

  it("회귀 추세를 중복 없는 관리자 알림으로 만든다", () => {
    const alert = createDeviceQaAdminAlert(regressionTrend)!;
    const enabled = { ...defaultDeviceQaAdminAlertPreferences, enabled: true };
    expect(alert.title).toBe("기기 QA 회귀 경고");
    expect(shouldNotifyDeviceQaAlert(alert, enabled)).toBe(true);
    expect(shouldNotifyDeviceQaAlert(alert, { ...enabled, lastNotifiedSignature: alert.signature })).toBe(false);
  });

  it("알림 기준과 확인 상태를 저장하고 다시 읽는다", () => {
    let saved = "";
    const preferences = { ...defaultDeviceQaAdminAlertPreferences, enabled: true, threshold: "watch" as const, acknowledgedSignature: "alert-1" };
    expect(saveDeviceQaAdminAlertPreferences(preferences, { setItem: (_key, value) => { saved = value; } })).toBe(true);
    expect(loadDeviceQaAdminAlertPreferences({ getItem: () => saved })).toEqual(preferences);
  });
});

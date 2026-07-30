import { AlertTriangle, Bell, BellOff, CheckCircle2, Cloud, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { InvitationAnalyticsBreakdown } from "@wedding-game/shared";
import {
  createDeviceQaAdminAlert,
  loadDeviceQaAdminAlertPreferences,
  notificationPermission,
  requestDeviceQaNotificationPermission,
  saveDeviceQaAdminAlertPreferences,
  shouldNotifyDeviceQaAlert,
  showDeviceQaAdminNotification,
  type DeviceQaAdminAlertPreferences,
  type DeviceQaAlertThreshold
} from "../invitation/deviceQaAdminAlerts";
import type { DeviceQaTrend } from "../invitation/deviceQaTrend";
import { analyzeDeviceQaBreakdown } from "../invitation/deviceQaBreakdown";

type DeviceQaAdminAlertProps = {
  trend: DeviceQaTrend;
  deviceResults: readonly InvitationAnalyticsBreakdown[];
  issueResults: readonly InvitationAnalyticsBreakdown[];
  generatedAt: string;
};

export function DeviceQaAdminAlert({ trend, deviceResults, issueResults, generatedAt }: DeviceQaAdminAlertProps) {
  const [preferences, setPreferences] = useState(loadDeviceQaAdminAlertPreferences);
  const [permission, setPermission] = useState(notificationPermission);
  const [message, setMessage] = useState("");
  const details = useMemo(() => analyzeDeviceQaBreakdown(deviceResults, issueResults), [deviceResults, issueResults]);
  const alert = useMemo(() => createDeviceQaAdminAlert(trend, details), [details, trend]);

  const updatePreferences = (next: DeviceQaAdminAlertPreferences) => {
    setPreferences(next);
    saveDeviceQaAdminAlertPreferences(next);
  };

  useEffect(() => {
    if (!alert || permission !== "granted" || !shouldNotifyDeviceQaAlert(alert, preferences)) return;
    let active = true;
    void showDeviceQaAdminNotification(alert).then((shown) => {
      if (!active || !shown) return;
      updatePreferences({ ...preferences, lastNotifiedSignature: alert.signature });
    });
    return () => { active = false; };
  }, [alert, permission, preferences]);

  const toggleNotifications = async () => {
    if (preferences.enabled) {
      updatePreferences({ ...preferences, enabled: false });
      setMessage("기기 QA 브라우저 알림을 껐습니다.");
      return;
    }
    const nextPermission = await requestDeviceQaNotificationPermission();
    setPermission(nextPermission);
    if (nextPermission !== "granted") {
      setMessage(nextPermission === "unsupported" ? "이 브라우저는 알림을 지원하지 않습니다." : "브라우저 알림 권한이 필요합니다.");
      return;
    }
    updatePreferences({ ...preferences, enabled: true });
    setMessage("기기 QA 이상 추세 브라우저 알림을 켰습니다.");
  };

  const acknowledged = Boolean(alert && preferences.acknowledgedSignature === alert.signature);
  return (
    <section className="device-qa-admin-alert" data-severity={alert?.severity ?? "clear"} data-acknowledged={acknowledged || undefined} aria-label="기기 QA 이상 알림">
      <span>{alert ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}</span>
      <div><strong>{alert?.title ?? "새로운 기기 이상 추세 없음"}</strong><small>{alert?.body ?? "점검 표본이 쌓이면 선택한 기준에 따라 알려드립니다."}</small>{message ? <em role="status">{message}</em> : null}</div>
      <label><span>알림 기준</span><select value={preferences.threshold} onChange={(event) => updatePreferences({ ...preferences, threshold: event.target.value as DeviceQaAlertThreshold })}><option value="regression">회귀만</option><option value="watch">주의부터</option></select></label>
      <div className="device-qa-admin-alert__actions">
        <button type="button" disabled={permission === "unsupported"} aria-pressed={preferences.enabled} onClick={() => void toggleNotifications()}>{preferences.enabled ? <BellOff aria-hidden="true" /> : <Bell aria-hidden="true" />}{preferences.enabled ? "알림 끄기" : "브라우저 알림"}</button>
        {alert ? <button type="button" disabled={acknowledged} onClick={() => updatePreferences({ ...preferences, acknowledgedSignature: alert.signature })}><CheckCircle2 aria-hidden="true" />{acknowledged ? "확인 완료" : "확인"}</button> : null}
      </div>
      <section className="device-qa-admin-alert__server" aria-label="기기별 QA 상세 분석">
        <header><Cloud aria-hidden="true" /><span><strong>서버 집계 알림 연결</strong><small>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(generatedAt))} 갱신</small></span></header>
        <div>{details.length > 0 ? details.map((detail) => <article key={detail.id} data-warning={detail.issues > 0 || undefined}><Smartphone aria-hidden="true" /><span><strong>{detail.label}</strong><small>점검 {detail.reports}회 · 경고 {detail.warnings}회 · 불편률 {Math.round(detail.issueRate * 100)}%</small></span><ul>{detail.topIssues.length > 0 ? detail.topIssues.map((issue) => <li key={issue.id}>{issue.label} <strong>{issue.count}</strong></li>) : <li>보고된 불편 없음</li>}</ul></article>) : <p>기기별 점검 표본을 기다리고 있습니다.</p>}</div>
      </section>
    </section>
  );
}

import { AlertTriangle, Bell, BellOff, CheckCircle2, Cloud, Mail, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DeviceQaDetailAdminState, InvitationAnalyticsBreakdown } from "@wedding-game/shared";
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
  serverState?: DeviceQaDetailAdminState;
  onUpdateServerSettings?: (input: { emailEnabled: boolean; warningThreshold: number }) => Promise<DeviceQaDetailAdminState>;
};

export function DeviceQaAdminAlert({ trend, deviceResults, issueResults, generatedAt, serverState, onUpdateServerSettings }: DeviceQaAdminAlertProps) {
  const [preferences, setPreferences] = useState(loadDeviceQaAdminAlertPreferences);
  const [permission, setPermission] = useState(notificationPermission);
  const [message, setMessage] = useState("");
  const [serverBusy, setServerBusy] = useState(false);
  const details = useMemo(() => analyzeDeviceQaBreakdown(deviceResults, issueResults), [deviceResults, issueResults]);
  const trendAlert = useMemo(() => createDeviceQaAdminAlert(trend, details), [details, trend]);
  const alert = serverState?.latestAlert ? {
    severity: serverState.latestAlert.severity,
    signature: serverState.latestAlert.id,
    title: serverState.latestAlert.title,
    body: serverState.latestAlert.body
  } : trendAlert;

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
  const updateServerSettings = async (patch: Partial<{ emailEnabled: boolean; warningThreshold: number }>) => {
    if (!serverState || !onUpdateServerSettings || serverBusy) return;
    setServerBusy(true);
    try {
      const updated = await onUpdateServerSettings({
        emailEnabled: patch.emailEnabled ?? serverState.emailEnabled,
        warningThreshold: patch.warningThreshold ?? serverState.warningThreshold
      });
      setMessage(updated.emailEnabled ? "반복 경고 이메일을 켰습니다." : "반복 경고 이메일을 껐습니다.");
    } catch {
      setMessage("서버 알림 설정을 저장하지 못했습니다.");
    } finally {
      setServerBusy(false);
    }
  };
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
        {serverState ? <section className="device-qa-admin-alert__profiles" aria-label="운영체제와 브라우저별 점검"><header><strong>OS·브라우저 주요 버전</strong><small>최근 30일 · 개인 식별 정보 없음</small></header>{serverState.profiles.length > 0 ? <ol>{serverState.profiles.map((profile) => <li key={profile.key} data-warning={profile.warnings > 0 || undefined}><span><strong>{profile.osLabel}</strong><small>{profile.browserLabel}</small></span><em>점검 {profile.reports} · 경고 {profile.warnings} · 불편 {profile.issues}</em></li>)}</ol> : <p>상세 기기 표본을 기다리고 있습니다.</p>}</section> : null}
        {serverState ? <div className="device-qa-admin-alert__delivery"><Mail aria-hidden="true" /><span><strong>서버 반복 경고</strong><small>{serverState.emailConfigured ? `${serverState.warningThreshold}회부터 이메일·브라우저 알림` : "발신 도메인 설정 후 이메일 사용 가능"}</small></span><label><span>기준</span><select aria-label="기기 QA 서버 경고 기준" value={serverState.warningThreshold} disabled={serverBusy} onChange={(event) => void updateServerSettings({ warningThreshold: Number(event.target.value) })}><option value="2">2회</option><option value="3">3회</option><option value="5">5회</option><option value="10">10회</option></select></label><button type="button" disabled={!serverState.emailConfigured || serverBusy} aria-pressed={serverState.emailEnabled} onClick={() => void updateServerSettings({ emailEnabled: !serverState.emailEnabled })}>{serverState.emailEnabled ? "이메일 끄기" : "이메일 켜기"}</button></div> : null}
      </section>
    </section>
  );
}

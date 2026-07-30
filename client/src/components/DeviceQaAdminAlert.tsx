import { AlertTriangle, Bell, BellOff, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type DeviceQaAdminAlertProps = {
  trend: DeviceQaTrend;
};

export function DeviceQaAdminAlert({ trend }: DeviceQaAdminAlertProps) {
  const [preferences, setPreferences] = useState(loadDeviceQaAdminAlertPreferences);
  const [permission, setPermission] = useState(notificationPermission);
  const [message, setMessage] = useState("");
  const alert = useMemo(() => createDeviceQaAdminAlert(trend), [trend]);

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
    </section>
  );
}

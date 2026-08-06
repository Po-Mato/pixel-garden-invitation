import { Check, ClipboardCheck, Download, Play, Send, TriangleAlert } from "lucide-react";
import { useState } from "react";
import "@fontsource-variable/noto-sans-kr/wght.css";
import { flushInvitationAnalytics, trackInvitationAnalytics } from "../analytics/invitationAnalytics";
import { postDeviceQaDetailReport } from "../api/deviceQaReportApi";
import { currentDeviceQaProfile } from "../invitation/deviceQaProfile";
import {
  collectDeviceReadinessReport,
  deviceQaChecks,
  loadDeviceQaChecks,
  saveDeviceQaChecks,
  type DeviceQaCheckState,
  type DeviceReadinessReport
} from "../game/gameDeviceReadiness";
import "../game-vault-optional.css";

function downloadReport(report: DeviceReadinessReport) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `wedding-game-device-qa-${report.createdAt.slice(0, 10)}.json`;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function GameDeviceReadinessCenter() {
  const [manualChecks, setManualChecks] = useState(loadDeviceQaChecks);
  const [report, setReport] = useState<DeviceReadinessReport | null>(null);
  const [reportedIssues, setReportedIssues] = useState<Partial<Record<keyof DeviceQaCheckState, boolean>>>({});
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateCheck = (id: keyof DeviceQaCheckState, checked: boolean) => {
    const next = { ...manualChecks, [id]: checked };
    setManualChecks(next);
    saveDeviceQaChecks(next);
    if (checked) setReportedIssues((current) => ({ ...current, [id]: false }));
    if (report) setReport(collectDeviceReadinessReport(next));
  };

  const toggleReportedIssue = (id: keyof DeviceQaCheckState) => {
    const selected = reportedIssues[id] !== true;
    setReportedIssues((current) => ({ ...current, [id]: selected }));
    if (selected && manualChecks[id]) updateCheck(id, false);
  };

  const submitAnonymousReport = async () => {
    if (!report || submitting) return;
    setSubmitting(true);
    const profile = currentDeviceQaProfile();
    const device = profile.platform;
    const automaticIssues = report.items
      .filter(({ status, id }) => status === "warning" && ["viewport", "touch", "storage", "audio"].includes(id))
      .map(({ id }) => id);
    const manualIssues = Object.entries(reportedIssues).filter(([, selected]) => selected).map(([id]) => id);
    const issues = Array.from(new Set([...automaticIssues, ...manualIssues]));
    trackInvitationAnalytics("device_qa", `${device}:${issues.length > 0 ? "warning" : "complete"}`);
    issues.forEach((id) => trackInvitationAnalytics("device_qa", `${device}:issue-${id}`));
    const [, detailed] = await Promise.allSettled([
      flushInvitationAnalytics(),
      postDeviceQaDetailReport({ ...profile, status: issues.length > 0 ? "warning" : "complete", issues })
    ]);
    setSubmitting(false);
    setSubmitStatus(detailed.status === "fulfilled"
      ? `개인정보 없이 ${profile.osName} ${profile.osVersion} · ${profile.browserName} ${profile.browserVersion} 익명 점검을 보냈어요`
      : "기본 익명 점검을 보냈어요 · 상세 기기 집계는 다음에 다시 시도합니다");
  };

  return (
    <details className="game-device-readiness">
      <summary><span><ClipboardCheck aria-hidden="true" /><strong>내 휴대폰 최종 점검</strong><small>실제 기기에서 바로 확인</small></span></summary>
      <p>이 휴대폰의 화면·터치·저장·사운드·공유 지원을 확인합니다.</p>
      <button type="button" onClick={() => setReport(collectDeviceReadinessReport(manualChecks))}><Play aria-hidden="true" />자동 점검 실행</button>
      {report ? (
        <section className="game-device-readiness__report" aria-label="휴대폰 자동 점검 결과" aria-live="polite">
          <header><strong>{report.deviceFamily}</strong><small>{report.viewport} · {report.pixelRatio}x</small></header>
          <ul>
            {report.items.map((item) => (
              <li key={item.id} data-status={item.status}>
                {item.status === "warning" ? <TriangleAlert aria-hidden="true" /> : <Check aria-hidden="true" />}
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <fieldset>
        <legend>직접 확인</legend>
        {deviceQaChecks.map((check) => (
          <label key={check.id}>
            <input type="checkbox" checked={manualChecks[check.id]} onChange={(event) => updateCheck(check.id, event.target.checked)} />
            <span>{check.label}</span>
          </label>
        ))}
      </fieldset>
      {report ? (
        <fieldset className="game-device-readiness__issues">
          <legend>불편이 있었던 항목만 선택</legend>
          {deviceQaChecks.map((check) => {
            const shortLabel = check.id === "movement" ? "이동" : check.id === "portal" ? "포털" : check.id === "feedback" ? "소리·진동" : check.id === "layout" ? "화면 배치" : "사진";
            const selected = reportedIssues[check.id] === true;
            return <button key={check.id} type="button" aria-pressed={selected} aria-label={`${shortLabel} 불편 ${selected ? "선택 해제" : "선택"}`} onClick={() => toggleReportedIssue(check.id)}><TriangleAlert aria-hidden="true" /><span>{shortLabel}</span></button>;
          })}
        </fieldset>
      ) : null}
      <button type="button" disabled={!report || submitting} onClick={() => void submitAnonymousReport()}><Send aria-hidden="true" />{submitting ? "보내는 중" : "익명 점검 보내기"}</button>
      {submitStatus ? <small className="game-device-readiness__submit-status" role="status">{submitStatus}</small> : null}
      <button type="button" disabled={!report} onClick={() => report && downloadReport(report)}><Download aria-hidden="true" />점검 결과 저장</button>
    </details>
  );
}

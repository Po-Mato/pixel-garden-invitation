import { Check, ClipboardCheck, Download, Play, TriangleAlert } from "lucide-react";
import { useState } from "react";
import {
  collectDeviceReadinessReport,
  deviceQaChecks,
  loadDeviceQaChecks,
  saveDeviceQaChecks,
  type DeviceQaCheckState,
  type DeviceReadinessReport
} from "../game/gameDeviceReadiness";

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

  const updateCheck = (id: keyof DeviceQaCheckState, checked: boolean) => {
    const next = { ...manualChecks, [id]: checked };
    setManualChecks(next);
    saveDeviceQaChecks(next);
    if (report) setReport(collectDeviceReadinessReport(next));
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
      <button type="button" disabled={!report} onClick={() => report && downloadReport(report)}><Download aria-hidden="true" />점검 결과 저장</button>
    </details>
  );
}

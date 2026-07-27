import { History, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RsvpHistoryEntry, RsvpHistoryResult, RsvpRecord } from "@wedding-game/shared";
import { fetchAdminRsvpHistory } from "../api/rsvpHistoryApi";
import { WeddingApiError } from "../api/weddingApi";
import "../rsvp-history-admin.css";

type RsvpHistoryDialogProps = {
  token: string;
  response: RsvpRecord;
  onClose: () => void;
  onUnauthorized: () => void;
};

const fieldLabels: Array<[keyof RsvpRecord, string]> = [
  ["side", "대상"],
  ["guestName", "이름"],
  ["phone", "연락처"],
  ["attendance", "참석"],
  ["partySize", "인원"],
  ["childCount", "어린이"],
  ["mealStatus", "식사"],
  ["note", "전달사항"]
];

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

function actionLabel(action: RsvpHistoryEntry["action"]): string {
  if (action === "created") return "최초 답변";
  if (action === "snapshot") return "이력 추적 시작";
  return "답변 수정";
}

function changedFields(entry: RsvpHistoryEntry, previous?: RsvpHistoryEntry): string[] {
  if (!previous) return entry.action === "snapshot" ? ["현재 상태"] : ["최초 저장"];
  return fieldLabels
    .filter(([field]) => entry.response[field] !== previous.response[field])
    .map(([, label]) => label);
}

export function RsvpHistoryDialog({ token, response, onClose, onUnauthorized }: RsvpHistoryDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const [result, setResult] = useState<RsvpHistoryResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetchAdminRsvpHistory(token, response.id).then((next) => {
      if (active) setResult(next);
    }).catch((loadError) => {
      if (!active) return;
      if (loadError instanceof WeddingApiError && loadError.status === 401) {
        onUnauthorized();
        return;
      }
      setError("변경 이력을 불러오지 못했습니다.");
    });
    dialogRef.current?.focus();
    return () => { active = false; };
  }, [onUnauthorized, response.id, token]);

  const entries = useMemo(() => result?.entries ?? [], [result]);

  return (
    <div className="rsvp-admin-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={dialogRef}
        className="rsvp-admin-dialog rsvp-history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rsvp-history-title"
        tabIndex={-1}
        onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
      >
        <header>
          <div><p className="rsvp-admin-eyebrow">REVISION HISTORY</p><h2 id="rsvp-history-title">{response.guestName}님 답변 이력</h2></div>
          <button type="button" className="rsvp-admin-secondary" aria-label="변경 이력 닫기" onClick={onClose}><X aria-hidden="true" /></button>
        </header>
        {!result && !error ? <p className="rsvp-admin-message" role="status">변경 이력을 불러오고 있습니다.</p> : null}
        {error ? <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p> : null}
        {result ? (
          <ol className="rsvp-history-list">
            {entries.map((entry, index) => {
              const changes = changedFields(entry, entries[index + 1]);
              return (
                <li key={entry.id}>
                  <History aria-hidden="true" />
                  <div>
                    <header><strong>{actionLabel(entry.action)} · rev. {entry.revision}</strong><time dateTime={entry.occurredAt}>{formatDate(entry.occurredAt)}</time></header>
                    <p>{entry.response.attendance === "yes" ? `참석 ${entry.response.partySize}명` : entry.response.attendance === "no" ? "불참" : `참석 미정 ${entry.response.partySize}명`} · {entry.response.note || "전달사항 없음"}</p>
                    <div>{changes.map((field) => <span key={field}>{field}</span>)}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>
    </div>
  );
}

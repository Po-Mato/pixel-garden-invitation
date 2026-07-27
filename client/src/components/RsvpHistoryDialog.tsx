import { ArrowRight, History, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RsvpHistoryEntry, RsvpHistoryResult, RsvpRecord } from "@wedding-game/shared";
import {
  fetchAdminRsvpHistory,
  fetchOwnedRsvpHistory,
  restoreAdminRsvpHistory
} from "../api/rsvpHistoryApi";
import { WeddingApiError, type RsvpCredential } from "../api/weddingApi";
import { getRsvpHistoryChanges } from "../invitation/rsvpHistoryChanges";
import "../rsvp-history-admin.css";

type RsvpHistoryDialogProps = {
  token?: string;
  credential?: RsvpCredential;
  response: RsvpRecord;
  onClose: () => void;
  onUnauthorized: () => void;
  onRestored?: () => void;
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

function actionLabel(entry: RsvpHistoryEntry): string {
  if (entry.changeReason) return "이전 답변 복원";
  const { action } = entry;
  if (action === "created") return "최초 답변";
  if (action === "snapshot") return "이력 추적 시작";
  return "답변 수정";
}

export function RsvpHistoryDialog({
  token,
  credential,
  response,
  onClose,
  onUnauthorized,
  onRestored
}: RsvpHistoryDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const [result, setResult] = useState<RsvpHistoryResult | null>(null);
  const [error, setError] = useState("");
  const [restoreRevision, setRestoreRevision] = useState<number | null>(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let active = true;
    const request = credential
      ? fetchOwnedRsvpHistory(credential)
      : token
        ? fetchAdminRsvpHistory(token, response.id)
        : Promise.reject(new WeddingApiError(401, "unauthorized"));
    void request.then((next) => {
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
  }, [credential, onUnauthorized, response.id, token]);

  const entries = useMemo(() => result?.entries ?? [], [result]);

  async function submitRestore(entry: RsvpHistoryEntry) {
    if (!token || restoring) return;
    const reason = restoreReason.trim();
    if (reason.length < 2) {
      setError("복원 사유를 두 글자 이상 입력해 주세요.");
      return;
    }
    setRestoring(true);
    setError("");
    try {
      const next = await restoreAdminRsvpHistory(token, response.id, {
        targetRevision: entry.revision,
        currentRevision: response.revision,
        reason
      });
      setResult(next);
      setRestoreRevision(null);
      setRestoreReason("");
      onRestored?.();
    } catch (restoreError) {
      if (restoreError instanceof WeddingApiError && restoreError.status === 401) {
        onUnauthorized();
        return;
      }
      setError(restoreError instanceof WeddingApiError && restoreError.status === 409
        ? "다른 변경이 먼저 저장되었습니다. 목록을 새로고침한 뒤 다시 시도해 주세요."
        : "이 버전으로 복원하지 못했습니다.");
    } finally {
      setRestoring(false);
    }
  }

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
              const changes = getRsvpHistoryChanges(entry, entries[index + 1]);
              return (
                <li key={entry.id}>
                  <History aria-hidden="true" />
                  <div>
                    <header><strong>{actionLabel(entry)} · rev. {entry.revision}</strong><time dateTime={entry.occurredAt}>{formatDate(entry.occurredAt)}</time></header>
                    <p>{entry.response.attendance === "yes" ? `참석 ${entry.response.partySize}명` : entry.response.attendance === "no" ? "불참" : `참석 미정 ${entry.response.partySize}명`} · {entry.response.note || "전달사항 없음"}</p>
                    {entry.changeReason ? <p className="rsvp-history-reason"><strong>복원 사유</strong>{entry.changeReason}</p> : null}
                    {changes.length > 0 ? (
                      <ul className="rsvp-history-changes" aria-label={`rev. ${entry.revision} 변경 내용`}>
                        {changes.map((change) => (
                          <li key={change.field}>
                            <strong>{change.label}</strong>
                            <div><del>{change.before}</del><ArrowRight aria-hidden="true" /><ins>{change.after}</ins></div>
                          </li>
                        ))}
                      </ul>
                    ) : <span className="rsvp-history-initial">{entry.action === "snapshot" ? "현재 상태" : "최초 저장"}</span>}
                    {token && entry.revision < response.revision ? (
                      restoreRevision === entry.revision ? (
                        <form className="rsvp-history-restore" onSubmit={(event) => {
                          event.preventDefault();
                          void submitRestore(entry);
                        }}>
                          <label htmlFor={`restore-reason-${entry.id}`}>복원 사유</label>
                          <textarea
                            id={`restore-reason-${entry.id}`}
                            value={restoreReason}
                            minLength={2}
                            maxLength={120}
                            rows={2}
                            autoFocus
                            disabled={restoring}
                            onChange={(event) => setRestoreReason(event.target.value)}
                          />
                          <small>{restoreReason.length}/120</small>
                          <div>
                            <button type="button" className="rsvp-admin-secondary" disabled={restoring} onClick={() => {
                              setRestoreRevision(null);
                              setRestoreReason("");
                            }}>취소</button>
                            <button type="submit" disabled={restoring || restoreReason.trim().length < 2}>
                              <RotateCcw aria-hidden="true" /> {restoring ? "복원 중" : "이 버전으로 복원"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button type="button" className="rsvp-history-restore-trigger" onClick={() => {
                          setRestoreRevision(entry.revision);
                          setRestoreReason("");
                          setError("");
                        }}><RotateCcw aria-hidden="true" /> 이 버전으로 복원</button>
                      )
                    ) : null}
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

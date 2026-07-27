import { CheckCircle2, History, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RsvpRecord, WeddingEvent } from "@wedding-game/shared";
import { fetchOwnedRsvp, WeddingApiError } from "../api/weddingApi";
import { RsvpHistoryDialog } from "./RsvpHistoryDialog";
import {
  clearRsvpCredential,
  loadRsvpCredential,
  rsvpCredentialChangedEvent
} from "../invitation/rsvpStorage";

type RsvpSavedStatusProps = {
  event: WeddingEvent;
  onOpenDetails: () => void;
};

type SavedStatusState =
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "ready"; response: RsvpRecord }
  | { kind: "offline" };

const attendanceLabels = {
  yes: "참석 예정",
  no: "불참",
  unsure: "참석 여부 미정"
} as const;

function formatHistoryTime(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function RsvpSavedStatus({ event, onOpenDetails }: RsvpSavedStatusProps) {
  const invitationId = import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
  const requestIdRef = useRef(0);
  const [state, setState] = useState<SavedStatusState>(() => (
    loadRsvpCredential(invitationId) ? { kind: "loading" } : { kind: "hidden" }
  ));
  const [historyOpen, setHistoryOpen] = useState(false);

  const refresh = useCallback(async () => {
    const credential = loadRsvpCredential(invitationId);
    const requestId = ++requestIdRef.current;
    if (!credential) {
      setState({ kind: "hidden" });
      return;
    }

    setState((current) => current.kind === "ready" ? current : { kind: "loading" });
    try {
      const response = await fetchOwnedRsvp(credential);
      if (requestId === requestIdRef.current) setState({ kind: "ready", response });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      if (error instanceof WeddingApiError && (error.status === 401 || error.status === 404)) {
        clearRsvpCredential(invitationId);
        setState({ kind: "hidden" });
        return;
      }
      setState({ kind: "offline" });
    }
  }, [invitationId]);

  useEffect(() => {
    void refresh();
    const sync = () => void refresh();
    window.addEventListener(rsvpCredentialChangedEvent, sync);
    window.addEventListener("storage", sync);
    return () => {
      requestIdRef.current += 1;
      window.removeEventListener(rsvpCredentialChangedEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, [refresh]);

  if (state.kind === "hidden") return null;

  const credential = loadRsvpCredential(invitationId);

  return (
    <>
    <section className="rsvp-saved-status" aria-label="이 기기에 저장된 참석 답변">
      <header>
        <CheckCircle2 aria-hidden="true" />
        <span><strong>참석 답변이 저장되어 있어요</strong><small>이 기기에서 언제든 확인하고 수정할 수 있습니다.</small></span>
        <em>같은 기기</em>
      </header>

      {state.kind === "loading" ? <p role="status">저장된 답변을 확인하고 있어요...</p> : null}
      {state.kind === "offline" ? (
        <div className="rsvp-saved-status__offline">
          <p>저장 정보는 있지만 최신 내용을 불러오지 못했습니다.</p>
          <button type="button" onClick={() => void refresh()}><RefreshCw aria-hidden="true" /> 다시 확인</button>
        </div>
      ) : null}
      {state.kind === "ready" ? (
        <div className="rsvp-saved-status__history">
          <div>
            <History aria-hidden="true" />
            <span><strong>{attendanceLabels[state.response.attendance]}</strong><small>{state.response.revision}번째 저장</small></span>
          </div>
          <dl>
            <div><dt>최초 답변</dt><dd>{formatHistoryTime(state.response.createdAt, event.timeZone)}</dd></div>
            <div><dt>최근 수정</dt><dd>{formatHistoryTime(state.response.updatedAt, event.timeZone)}</dd></div>
          </dl>
          <div className="rsvp-saved-status__actions">
            <button type="button" onClick={() => void refresh()} aria-label="참석 답변 최신 상태 확인" title="최신 상태 확인">
              <RefreshCw aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setHistoryOpen(true)}><History aria-hidden="true" /> 변경 이력</button>
            <button type="button" className="primary-button" onClick={onOpenDetails}>답변 확인·수정</button>
          </div>
        </div>
      ) : null}
    </section>
    {historyOpen && state.kind === "ready" && credential ? (
      <RsvpHistoryDialog
        credential={credential}
        response={state.response}
        onClose={() => setHistoryOpen(false)}
        onUnauthorized={() => {
          setHistoryOpen(false);
          clearRsvpCredential(invitationId);
          setState({ kind: "hidden" });
        }}
      />
    ) : null}
    </>
  );
}

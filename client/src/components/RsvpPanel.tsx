import { useCallback, useEffect, useRef, useState } from "react";
import { invitationContent, type RsvpCreateResult, type RsvpRecord, type RsvpSubmission } from "@wedding-game/shared";
import { fetchOwnedRsvp, updateOwnedRsvp, WeddingApiError, type RsvpCredential } from "../api/weddingApi";
import { createRsvpWithInviteLink } from "../api/invitationInviteLinksApi";
import { loadStoredInvitationInvite } from "../invitation/inviteLinkStorage";
import { loadRsvpFormDraft } from "../invitation/publicFormDraftStorage";
import {
  clearRsvpSendQueue,
  loadRsvpSendQueue,
  saveRsvpSendQueue
} from "../invitation/publicFormQueueStorage";
import { clearRsvpCredential, loadRsvpCredential, saveRsvpCredential } from "../invitation/rsvpStorage";
import { RsvpForm, type RsvpFormInitialValue } from "./RsvpForm";
import { trackAnalyticsContextEvent } from "../analytics/invitationAnalytics";

type PanelState =
  | { kind: "loading" }
  | { kind: "saving" }
  | { kind: "new" }
  | { kind: "summary"; response: RsvpRecord }
  | { kind: "editing"; response: RsvpRecord }
  | { kind: "error"; message: string; recoverTo: "new" | "summary" };

const sideLabel = { groom: "신랑측", bride: "신부측", legacy: "하객" } as const;
const attendanceLabel = { yes: "참석", no: "불참", unsure: "미정" } as const;
const mealLabel = { yes: "식사 예정", no: "식사 안 함", unsure: "미정", not_applicable: "해당 없음" } as const;

type PendingCreateResult = {
  result: RsvpCreateResult;
  credentialSaved: boolean;
};

const pendingCreates = new Map<string, Promise<PendingCreateResult>>();

function createOnce(id: string, payload: RsvpSubmission): Promise<PendingCreateResult> {
  const existing = pendingCreates.get(id);
  if (existing) return existing;

  const pending = createRsvpWithInviteLink(payload)
    .then((result) => ({ result, credentialSaved: saveRsvpCredential(id, result.credential) }))
    .finally(() => {
      if (pendingCreates.get(id) === pending) pendingCreates.delete(id);
    });
  pendingCreates.set(id, pending);
  return pending;
}

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function editableValue(response: RsvpRecord): RsvpFormInitialValue {
  return {
    side: response.side === "legacy" ? "groom" : response.side,
    guestName: response.guestName,
    phone: response.phone ?? "",
    attendance: response.attendance,
    partySize: response.partySize,
    mealStatus: response.mealStatus,
    note: response.note,
    consentVersion: response.consentVersion
  };
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: invitationContent.event.timeZone,
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit"
  }).format(date);
}

function apiMessage(error: unknown, fallback: string): Error {
  if (error instanceof WeddingApiError && error.status === 429 && error.retryAfterSeconds !== undefined) {
    return new Error(`요청이 잠시 제한되었습니다. ${error.retryAfterSeconds}초 후 다시 시도해 주세요.`);
  }
  if (error instanceof WeddingApiError && error.status >= 500) return new Error("서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.");
  return new Error(fallback);
}

export function RsvpPanel() {
  const id = invitationId();
  const credentialRef = useRef<RsvpCredential | null>(loadRsvpCredential(id));
  const pendingAtRender = pendingCreates.get(id);
  const mountedRef = useRef(true);
  const initialLoadStartedRef = useRef(false);
  const startTrackedRef = useRef(false);
  const [state, setState] = useState<PanelState>(
    pendingAtRender ? { kind: "saving" } : credentialRef.current ? { kind: "loading" } : { kind: "new" }
  );
  const [notice, setNotice] = useState("");
  const invitedGuest = loadStoredInvitationInvite(id)?.invite ?? null;
  const storedDraftRef = useRef(loadRsvpFormDraft(id));
  const queuedSubmissionRef = useRef(loadRsvpSendQueue(id));
  const [queuedAt, setQueuedAt] = useState<string | null>(queuedSubmissionRef.current?.queuedAt ?? null);
  const invitedInitialValue: RsvpFormInitialValue | undefined = invitedGuest ? {
    side: invitedGuest.side,
    guestName: invitedGuest.guestName,
    phone: "",
    attendance: "yes",
    partySize: 1,
    mealStatus: "unsure",
    note: "",
    consentVersion: invitationContent.event.rsvp.consentVersion
  } : undefined;
  const initialValue = queuedSubmissionRef.current?.value ?? storedDraftRef.current?.value ?? invitedInitialValue;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadOwned = useCallback(async () => {
    const credential = credentialRef.current;
    if (!credential) {
      if (mountedRef.current) setState({ kind: "new" });
      return;
    }
    if (mountedRef.current) setState({ kind: "loading" });
    try {
      const response = await fetchOwnedRsvp(credential);
      if (mountedRef.current) setState({ kind: "summary", response });
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof WeddingApiError && (error.status === 401 || error.status === 404)) {
        clearRsvpCredential(id);
        credentialRef.current = null;
        setState({ kind: "new" });
        return;
      }
      setState({ kind: "error", message: "저장된 답변을 불러오지 못했습니다.", recoverTo: "new" });
    }
  }, [id]);

  const applyCreated = useCallback((created: PendingCreateResult) => {
    credentialRef.current = created.result.credential;
    if (!mountedRef.current) return;
    setNotice(created.credentialSaved
      ? "답변이 저장되었습니다."
      : "답변은 저장되었지만 이 기기에서 다시 수정하기 어려울 수 있습니다.");
    setState({ kind: "summary", response: created.result.response });
  }, []);

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    const pending = pendingCreates.get(id);
    if (pending) {
      initialLoadStartedRef.current = true;
      setState({ kind: "saving" });
      void pending.then(applyCreated).catch(() => {
        if (!mountedRef.current) return;
        setNotice("답변 저장이 완료되지 않았습니다. 내용을 다시 입력해 주세요.");
        setState({ kind: "new" });
      });
      return;
    }
    if (!credentialRef.current) return;
    initialLoadStartedRef.current = true;
    void loadOwned();
  }, [applyCreated, id, loadOwned]);

  async function handleCreate(payload: RsvpSubmission) {
    if (navigator.onLine === false) {
      const queued = saveRsvpSendQueue(id, payload);
      if (!queued) throw new Error("전송 대기함에 저장하지 못했습니다. 이 화면을 닫지 말아주세요.");
      queuedSubmissionRef.current = queued;
      setQueuedAt(queued.queuedAt);
      setNotice("참석 답변을 전송 대기함에 저장했습니다. 연결되면 내용을 확인하고 보내주세요.");
      return;
    }
    try {
      applyCreated(await createOnce(id, payload));
      clearRsvpSendQueue(id);
      queuedSubmissionRef.current = null;
      setQueuedAt(null);
      trackAnalyticsContextEvent("rsvp_submit");
    } catch (error) {
      throw apiMessage(error, "답변을 보내지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
    }
  }

  async function handleUpdate(response: RsvpRecord, payload: RsvpSubmission) {
    const credential = credentialRef.current;
    if (!credential) {
      setState({ kind: "new" });
      throw new Error("수정 정보를 찾지 못했습니다. 새 답변을 작성해 주세요.");
    }
    try {
      const updated = await updateOwnedRsvp(credential, { ...payload, revision: response.revision });
      if (!mountedRef.current) return;
      setNotice("답변을 수정했습니다.");
      setState({ kind: "summary", response: updated });
    } catch (error) {
      if (error instanceof WeddingApiError && (error.status === 401 || error.status === 404)) {
        clearRsvpCredential(id);
        credentialRef.current = null;
        if (mountedRef.current) {
          setNotice("수정 정보를 확인할 수 없어 새 답변 작성으로 전환했습니다.");
          setState({ kind: "new" });
        }
        return;
      }
      if (error instanceof WeddingApiError && error.status === 409) {
        try {
          const latest = await fetchOwnedRsvp(credential);
          if (mountedRef.current) {
            setNotice("다른 변경사항을 반영했습니다. 내용을 확인한 뒤 다시 수정해 주세요.");
            setState({ kind: "summary", response: latest });
          }
          return;
        } catch (refreshError) {
          throw apiMessage(refreshError, "최신 답변을 불러오지 못했습니다. 다시 시도해 주세요.");
        }
      }
      throw apiMessage(error, "답변을 수정하지 못했습니다. 입력 내용을 유지했으니 다시 시도해 주세요.");
    }
  }

  function resetToNew() {
    clearRsvpCredential(id);
    credentialRef.current = null;
    setNotice("");
    setState({ kind: "new" });
  }

  function discardQueuedSubmission() {
    if (!clearRsvpSendQueue(id)) {
      setNotice("전송 대기를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    queuedSubmissionRef.current = null;
    setQueuedAt(null);
    setNotice("전송 대기함에서 참석 답변을 삭제했습니다.");
  }

  function trackFormStart(event: React.SyntheticEvent<HTMLDivElement>) {
    if (state.kind !== "new" || startTrackedRef.current) return;
    if (!(event.target instanceof Element) || !event.target.closest("form")) return;
    startTrackedRef.current = true;
    trackAnalyticsContextEvent("rsvp_start");
  }

  return (
    <div
      className="rsvp-panel"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onFocusCapture={trackFormStart}
      onChangeCapture={trackFormStart}
    >
      {notice ? <p className="rsvp-panel__notice" role="status">{notice}</p> : null}
      {state.kind === "loading" ? <p className="rsvp-panel__loading" role="status">답변을 확인하고 있습니다...</p> : null}
      {state.kind === "saving" ? <p className="rsvp-panel__loading" role="status">답변을 저장하고 있습니다...</p> : null}
      {state.kind === "new" ? (
        <RsvpForm
          initialValue={initialValue}
          policy={invitationContent.event.rsvp}
          draftStorageId={id}
          restoredDraftAt={storedDraftRef.current?.savedAt}
          draftResetValue={invitedInitialValue}
          queuedAt={queuedAt ?? undefined}
          onDiscardQueued={discardQueuedSubmission}
          submitLabel="참석 답변 보내기"
          onSubmit={handleCreate}
        />
      ) : null}
      {state.kind === "editing" ? (
        <RsvpForm
          initialValue={editableValue(state.response)}
          policy={invitationContent.event.rsvp}
          submitLabel="수정 저장"
          onSubmit={(payload) => handleUpdate(state.response, payload)}
        />
      ) : null}
      {state.kind === "summary" ? (
        <section className="rsvp-summary" aria-labelledby="rsvp-summary-title">
          <h3 id="rsvp-summary-title">보내주신 답변</h3>
          <dl>
            <div><dt>대상</dt><dd>{sideLabel[state.response.side]}</dd></div>
            <div><dt>이름</dt><dd>{state.response.guestName}</dd></div>
            <div><dt>연락처</dt><dd>{state.response.phone ?? "-"}</dd></div>
            <div><dt>참석</dt><dd>{attendanceLabel[state.response.attendance]}</dd></div>
            {state.response.attendance !== "no" ? <div><dt>인원</dt><dd>{state.response.partySize}명</dd></div> : null}
            {state.response.attendance === "yes" ? <div><dt>식사</dt><dd>{mealLabel[state.response.mealStatus]}</dd></div> : null}
            <div><dt>전달사항</dt><dd>{state.response.note || "없음"}</dd></div>
            <div><dt>마지막 수정</dt><dd>{formatUpdatedAt(state.response.updatedAt)}</dd></div>
          </dl>
          <button type="button" className="primary-button" onClick={() => { setNotice(""); setState({ kind: "editing", response: state.response }); }}>답변 수정</button>
        </section>
      ) : null}
      {state.kind === "error" ? (
        <div className="rsvp-panel__error" role="alert">
          <p>{state.message}</p>
          <div>
            <button type="button" className="primary-button" onClick={() => void loadOwned()}>다시 불러오기</button>
            <button type="button" onClick={resetToNew}>새 답변 작성</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

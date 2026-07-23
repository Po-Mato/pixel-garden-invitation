import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import {
  invitationContent,
  type GuestbookMessage,
  type GuestbookOwnedMessage,
  type GuestbookSubmission
} from "@wedding-game/shared";

import { WeddingApiError } from "../api/weddingApi";
import {
  clearGuestbookFormDraft,
  loadGuestbookFormDraft,
  saveGuestbookFormDraft
} from "../invitation/publicFormDraftStorage";

type GuestbookPanelProps = {
  nickname: string;
  messages: GuestbookMessage[];
  ownedMessage: GuestbookOwnedMessage | null;
  ownerError: string;
  nextCursor: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  listError: string;
  onCreate: (payload: GuestbookSubmission) => Promise<void>;
  onUpdate: (payload: GuestbookSubmission & { revision: number }) => Promise<void>;
  onDelete: () => Promise<void>;
  onLoadMore: () => Promise<void>;
  onRetry: () => Promise<void>;
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Seoul"
    }).format(date);
}

const guestbookDeleteDate = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "long",
  timeZone: "Asia/Seoul"
}).format(new Date(invitationContent.event.guestbook.deleteAt));

function operationError(error: unknown, fallback: string): string {
  if (!(error instanceof WeddingApiError)) return fallback;
  if (error.status === 409) return "다른 변경이 먼저 저장되었습니다. 방명록을 다시 열어 확인해 주세요.";
  if (error.status === 429) {
    return error.retryAfterSeconds
      ? `${error.retryAfterSeconds}초 후 다시 시도해 주세요.`
      : "작성 요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  return fallback;
}

export function GuestbookPanel({
  nickname,
  messages,
  ownedMessage,
  ownerError,
  nextCursor,
  isLoading,
  isLoadingMore,
  listError,
  onCreate,
  onUpdate,
  onDelete,
  onLoadMore,
  onRetry
}: GuestbookPanelProps) {
  const invitationId = import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
  const storedDraftRef = useRef(loadGuestbookFormDraft(invitationId));
  const [draftNickname, setDraftNickname] = useState(storedDraftRef.current?.value.nickname ?? nickname);
  const [draftMessage, setDraftMessage] = useState(storedDraftRef.current?.value.message ?? "");
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState<"create" | "update" | "delete" | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [draftTouched, setDraftTouched] = useState(false);
  const [draftStatus, setDraftStatus] = useState(() => (
    storedDraftRef.current ? "이 기기에 저장된 작성 내용을 복원했습니다." : ""
  ));
  const previousOnlineRef = useRef(online);

  useEffect(() => {
    if (!ownedMessage || editing) return;
    setDraftNickname(ownedMessage.nickname);
    setDraftMessage(ownedMessage.message);
  }, [editing, ownedMessage]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (ownedMessage || !draftTouched) return;
    const timer = window.setTimeout(() => {
      const saved = saveGuestbookFormDraft(invitationId, {
        nickname: draftNickname,
        message: draftMessage
      });
      setDraftStatus(saved
        ? online
          ? "작성 중인 메시지를 이 기기에 임시 저장했습니다."
          : "오프라인입니다. 작성 중인 메시지를 이 기기에 임시 저장했습니다."
        : "이 기기에 임시 저장하지 못했습니다. 이 화면을 닫지 말아주세요.");
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draftMessage, draftNickname, draftTouched, invitationId, online, ownedMessage]);

  useEffect(() => {
    if (draftTouched && online && !previousOnlineRef.current) {
      setDraftStatus("연결이 복구됐습니다. 내용을 확인하고 메시지를 보내주세요.");
    }
    previousOnlineRef.current = online;
  }, [draftTouched, online]);

  const visibleMessages = useMemo(
    () => messages.filter(({ id }) => id !== ownedMessage?.id),
    [messages, ownedMessage?.id]
  );

  function validateDraft(): GuestbookSubmission | null {
    const nextNickname = draftNickname.trim();
    const nextMessage = draftMessage.trim();
    if (!nextNickname) {
      setError("이름 또는 닉네임을 입력해 주세요.");
      return null;
    }
    if (!nextMessage) {
      setError("축하 메시지를 입력해 주세요.");
      return null;
    }
    return { nickname: nextNickname, message: nextMessage };
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const payload = validateDraft();
    if (!payload) return;
    setBusy("create");
    setError("");
    setStatus("");
    try {
      await onCreate(payload);
      clearGuestbookFormDraft(invitationId);
      setDraftStatus("");
      setStatus("축하 메시지를 남겼습니다. 이 기기에서 수정하거나 삭제할 수 있습니다.");
    } catch (createError) {
      setDraftTouched(true);
      setError(operationError(createError, "전송에 실패했습니다. 작성한 내용은 그대로 유지됩니다."));
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ownedMessage || busy) return;
    const payload = validateDraft();
    if (!payload) return;
    setBusy("update");
    setError("");
    setStatus("");
    try {
      await onUpdate({ ...payload, revision: ownedMessage.revision });
      setEditing(false);
      setStatus("메시지를 수정했습니다.");
    } catch (updateError) {
      setError(operationError(updateError, "수정하지 못했습니다. 작성한 내용은 그대로 유지됩니다."));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (busy) return;
    setBusy("delete");
    setError("");
    setStatus("");
    try {
      await onDelete();
      setConfirmingDelete(false);
      setDraftNickname(nickname);
      setDraftMessage("");
      setStatus("메시지를 삭제했습니다.");
    } catch (deleteError) {
      setError(operationError(deleteError, "삭제하지 못했습니다. 기존 메시지는 유지됩니다."));
    } finally {
      setBusy(null);
    }
  }

  function cancelEdit() {
    if (busy || !ownedMessage) return;
    setDraftNickname(ownedMessage.nickname);
    setDraftMessage(ownedMessage.message);
    setEditing(false);
    setError("");
  }

  return (
    <div className="guestbook-panel">
      <p className="guestbook-policy-note">
        작성한 이름과 메시지는 방명록에 공개되며 {guestbookDeleteDate}에 자동 삭제됩니다.
      </p>
      {ownedMessage ? (
        <section className="guestbook-owned" aria-labelledby="guestbook-owned-title">
          <div className="guestbook-section-heading">
            <h3 id="guestbook-owned-title">내가 남긴 메시지</h3>
            {ownedMessage.isHidden && <span className="guestbook-visibility-badge">비공개</span>}
          </div>
          {editing ? (
            <form className="form-stack" onSubmit={handleUpdate}>
              <label className="field">
                <span>이름 또는 닉네임</span>
                <input
                  value={draftNickname}
                  maxLength={16}
                  onChange={(event) => setDraftNickname(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>축하 메시지</span>
                <textarea
                  value={draftMessage}
                  maxLength={240}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  required
                />
              </label>
              <span className="guestbook-character-count">{draftMessage.length}/240</span>
              <div className="guestbook-action-row">
                <button className="secondary-button" type="button" onClick={cancelEdit} disabled={busy !== null}>
                  <X aria-hidden="true" /> 취소
                </button>
                <button className="primary-button" type="submit" disabled={busy !== null}>
                  <Check aria-hidden="true" /> {busy === "update" ? "저장 중" : "수정 저장"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <article className="guestbook-message guestbook-message--owned">
                <div>
                  <strong>{ownedMessage.nickname}</strong>
                  <time dateTime={ownedMessage.updatedAt}>{formatDate(ownedMessage.updatedAt)}</time>
                </div>
                <p>{ownedMessage.message}</p>
              </article>
              {ownedMessage.isHidden && (
                <p className="guestbook-private-note">관리자 확인으로 현재 공개 목록에서는 보이지 않습니다.</p>
              )}
              {confirmingDelete ? (
                <div className="guestbook-delete-confirm" role="group" aria-label="메시지 삭제 확인">
                  <span>이 메시지를 삭제할까요?</span>
                  <button type="button" className="secondary-button" onClick={() => setConfirmingDelete(false)} disabled={busy !== null}>
                    취소
                  </button>
                  <button type="button" className="danger-button" onClick={handleDelete} disabled={busy !== null}>
                    <Trash2 aria-hidden="true" /> {busy === "delete" ? "삭제 중" : "삭제"}
                  </button>
                </div>
              ) : (
                <div className="guestbook-action-row">
                  <button type="button" className="secondary-button" onClick={() => setEditing(true)}>
                    <Pencil aria-hidden="true" /> 수정
                  </button>
                  <button type="button" className="danger-button" onClick={() => setConfirmingDelete(true)}>
                    <Trash2 aria-hidden="true" /> 삭제
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      ) : ownerError ? (
        <section className="guestbook-owned guestbook-list-state" role="alert">
          <p>{ownerError}</p>
          <button type="button" className="secondary-button" onClick={() => void onRetry()}>
            <RefreshCw aria-hidden="true" /> 내 메시지 다시 확인
          </button>
        </section>
      ) : (
        <form className="form-stack guestbook-compose" onSubmit={handleCreate}>
          <label className="field">
            <span>이름 또는 닉네임</span>
            <input
              value={draftNickname}
              maxLength={16}
              onChange={(event) => {
                setDraftTouched(true);
                setDraftNickname(event.target.value);
              }}
              required
            />
          </label>
          <label className="field">
            <span>축하 메시지</span>
            <textarea
              value={draftMessage}
              maxLength={240}
              onChange={(event) => {
                setDraftTouched(true);
                setDraftMessage(event.target.value);
              }}
              required
            />
          </label>
          <span className="guestbook-character-count">{draftMessage.length}/240</span>
          <button className="primary-button" type="submit" disabled={busy !== null || !online}>
            {busy === "create" ? "메시지 보내는 중" : !online ? "연결 후 전송 가능" : "메시지 남기기"}
          </button>
          {draftStatus ? <p className="form-draft-status" role="status">{draftStatus}</p> : null}
        </form>
      )}

      {status && <p className="form-status" role="status">{status}</p>}
      {error && <p className="form-status form-status--error" role="alert">{error}</p>}

      <section className="guestbook-public" aria-labelledby="guestbook-public-title">
        <div className="guestbook-section-heading">
          <h3 id="guestbook-public-title">축하 메시지</h3>
          <span>{messages.length}개 표시</span>
        </div>
        {isLoading ? (
          <p className="guestbook-list-state" role="status">메시지를 불러오는 중입니다.</p>
        ) : listError ? (
          <div className="guestbook-list-state" role="alert">
            <p>{listError}</p>
            <button type="button" className="secondary-button" onClick={() => void onRetry()}>
              <RefreshCw aria-hidden="true" /> 다시 불러오기
            </button>
          </div>
        ) : visibleMessages.length === 0 ? (
          <p className="guestbook-list-state">아직 공개된 축하 메시지가 없습니다.</p>
        ) : (
          <ul className="guestbook-list">
            {visibleMessages.map((item) => (
              <li key={item.id} className="guestbook-message">
                <div>
                  <strong>{item.nickname}</strong>
                  <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                </div>
                <p>{item.message}</p>
              </li>
            ))}
          </ul>
        )}
        {nextCursor && !listError && (
          <button
            type="button"
            className="secondary-button guestbook-load-more"
            onClick={() => void onLoadMore()}
            disabled={isLoadingMore}
          >
            <ChevronDown aria-hidden="true" /> {isLoadingMore ? "불러오는 중" : "메시지 더 보기"}
          </button>
        )}
      </section>
    </div>
  );
}

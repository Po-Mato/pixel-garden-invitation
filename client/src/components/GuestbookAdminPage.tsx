import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, LockKeyhole, LogOut, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import type { GuestbookAdminResult, GuestbookOwnedMessage } from "@wedding-game/shared";

import {
  createAdminSession,
  deleteAdminGuestbook,
  fetchAdminGuestbook,
  moderateAdminGuestbook,
  updateAdminGuestbook,
  WeddingApiError,
  type AdminSession
} from "../api/weddingApi";
import { downloadGuestbookCsv } from "../invitation/guestbookCsv";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import { AdminNotificationInbox } from "./AdminNotificationInbox";

type VisibilityFilter = "all" | "visible" | "hidden";

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Seoul"
    }).format(date);
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s/g, "");
}

function messageForError(error: unknown, fallback: string): string {
  if (!(error instanceof WeddingApiError)) return fallback;
  if (error.status === 401) return "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (error.status === 409) return "다른 변경이 먼저 저장되었습니다. 목록을 새로고침해 주세요.";
  if (error.status === 429) return error.retryAfterSeconds
    ? `${error.retryAfterSeconds}초 후 다시 시도해 주세요.`
    : "요청이 제한되었습니다. 잠시 후 다시 시도해 주세요.";
  return fallback;
}

export function GuestbookAdminPage() {
  const id = invitationId();
  const mountedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [result, setResult] = useState<GuestbookAdminResult | null>(null);
  const [password, setPassword] = useState("");
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuestbookOwnedMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function logout(message = "") {
    sessionRef.current = null;
    clearAdminSession(id);
    setSession(null);
    setResult(null);
    setPassword("");
    setError(message);
    setStatus("");
    setBusyId(null);
    setDeleteTarget(null);
    setEditingId(null);
    setEditNickname("");
    setEditMessage("");
  }

  async function loadMessages(token: string, announcement = "") {
    setLoading(true);
    setError("");
    try {
      const next = await fetchAdminGuestbook(token);
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      setResult(next);
      setStatus(announcement);
    } catch (loadError) {
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      if (loadError instanceof WeddingApiError && loadError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(messageForError(loadError, "방명록을 불러오지 못했습니다."));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    const restored = loadAdminSession(id);
    if (restored) {
      sessionRef.current = restored;
      setSession(restored);
      void loadMessages(restored.token);
    }
    return () => {
      mountedRef.current = false;
    };
    // The invitation id is fixed for this administration page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!session) return;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      return;
    }
    const timer = window.setTimeout(() => logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요."), remaining);
    return () => window.clearTimeout(timer);
    // The timer intentionally expires the session snapshot that created it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.expiresAt, session?.token]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !password) return;
    setLoading(true);
    setError("");
    try {
      const nextSession = await createAdminSession(password);
      if (!mountedRef.current) return;
      sessionRef.current = nextSession;
      setSession(nextSession);
      saveAdminSession(id, nextSession);
      setPassword("");
      await loadMessages(nextSession.token);
    } catch (loginError) {
      if (!mountedRef.current) return;
      setPassword("");
      setError(messageForError(loginError, "로그인하지 못했습니다. 비밀번호를 확인해 주세요."));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function handleModerate(message: GuestbookOwnedMessage) {
    const token = sessionRef.current?.token;
    if (!token || busyId) return;
    setBusyId(message.id);
    setError("");
    setStatus("");
    try {
      await moderateAdminGuestbook(token, message.id, !message.isHidden, message.revision);
      await loadMessages(token, message.isHidden ? "메시지를 다시 공개했습니다." : "메시지를 비공개 처리했습니다.");
    } catch (moderateError) {
      if (moderateError instanceof WeddingApiError && moderateError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(messageForError(moderateError, "공개 상태를 변경하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  async function handleDelete() {
    const token = sessionRef.current?.token;
    const target = deleteTarget;
    if (!token || !target || busyId) return;
    setBusyId(target.id);
    setError("");
    setStatus("");
    try {
      await deleteAdminGuestbook(token, target.id);
      setDeleteTarget(null);
      await loadMessages(token, `${target.nickname}님의 메시지를 삭제했습니다.`);
    } catch (deleteError) {
      if (deleteError instanceof WeddingApiError && deleteError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(messageForError(deleteError, "메시지를 삭제하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  function startEditing(message: GuestbookOwnedMessage) {
    setDeleteTarget(null);
    setEditingId(message.id);
    setEditNickname(message.nickname);
    setEditMessage(message.message);
    setError("");
    setStatus("");
  }

  function cancelEditing() {
    if (busyId) return;
    setEditingId(null);
    setEditNickname("");
    setEditMessage("");
  }

  async function handleUpdate(message: GuestbookOwnedMessage) {
    const token = sessionRef.current?.token;
    const nickname = editNickname.trim();
    const nextMessage = editMessage.trim();
    if (!token || busyId || editingId !== message.id || !nickname || !nextMessage) return;
    setBusyId(message.id);
    setError("");
    setStatus("");
    try {
      await updateAdminGuestbook(token, message.id, {
        nickname,
        message: nextMessage,
        revision: message.revision
      });
      setEditingId(null);
      setEditNickname("");
      setEditMessage("");
      await loadMessages(token, `${nickname}님의 메시지를 수정했습니다.`);
    } catch (updateError) {
      if (updateError instanceof WeddingApiError && updateError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(messageForError(updateError, "메시지를 수정하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  const filteredMessages = useMemo(() => {
    if (!result) return [];
    const query = normalizeSearch(search);
    return result.messages.filter((message) => {
      const matchesQuery = !query
        || normalizeSearch(message.nickname).includes(query)
        || normalizeSearch(message.message).includes(query);
      const matchesVisibility = visibility === "all"
        || (visibility === "hidden" ? message.isHidden : !message.isHidden);
      return matchesQuery && matchesVisibility;
    });
  }, [result, search, visibility]);

  if (!session) {
    return (
      <main className="rsvp-admin-page">
        <section className="rsvp-admin-login" aria-labelledby="guestbook-admin-title">
          <LockKeyhole aria-hidden="true" />
          <p className="rsvp-admin-eyebrow">PRIVATE ACCESS</p>
          <h1 id="guestbook-admin-title">방명록 관리</h1>
          <form onSubmit={handleLogin}>
            <label htmlFor="guestbook-admin-password">관리자 비밀번호</label>
            <input
              id="guestbook-admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              required
            />
            <button type="submit" disabled={loading || !password}>{loading ? "로그인 중" : "로그인"}</button>
          </form>
          {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="rsvp-admin-page">
      <div className="rsvp-admin-shell">
        <header className="rsvp-admin-header">
          <div>
            <p className="rsvp-admin-eyebrow">MJ CONVENTION · 2027.05.01</p>
            <h1>방명록 관리</h1>
          </div>
          <div className="guestbook-admin-header-actions">
            <a className="rsvp-admin-nav-link" href="?admin=analytics">방문 통계</a>
            <a className="rsvp-admin-nav-link" href="?admin=release">통합 공개</a>
            <a className="rsvp-admin-nav-link" href="?admin=content">실데이터 편집</a>
            <a className="rsvp-admin-nav-link" href="?admin=gallery">사진 관리</a>
            <a className="rsvp-admin-nav-link" href="?admin=readiness">공개 준비</a>
            <a className="rsvp-admin-nav-link" href="?admin=rsvp">참석 답변 관리</a>
            <button type="button" className="rsvp-admin-secondary" onClick={() => logout()}>
              <LogOut aria-hidden="true" /> 로그아웃
            </button>
          </div>
        </header>

        <AdminNotificationInbox
          token={session.token}
          onUnauthorized={() => logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.")}
        />

        {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        {status && <p className="rsvp-admin-message" role="status">{status}</p>}
        {loading && !result && <p className="rsvp-admin-message" role="status">방명록을 불러오고 있습니다.</p>}
        {error && !result && (
          <button type="button" onClick={() => void loadMessages(session.token)} disabled={loading}>
            <RefreshCw aria-hidden="true" /> 다시 불러오기
          </button>
        )}

        {result && (
          <>
            <section className="rsvp-admin-summary" aria-labelledby="guestbook-summary-title">
              <h2 id="guestbook-summary-title">방명록 현황</h2>
              <dl>
                <div><dt>전체 메시지</dt><dd>{result.summary.totalCount}</dd></div>
                <div><dt>공개 메시지</dt><dd>{result.summary.visibleCount}</dd></div>
                <div><dt>비공개 메시지</dt><dd>{result.summary.hiddenCount}</dd></div>
                <div><dt>자동 삭제일</dt><dd>{formatDate(result.summary.deleteAt)}</dd></div>
              </dl>
            </section>

            <section className="rsvp-admin-results" aria-labelledby="guestbook-results-title">
              <div className="rsvp-admin-results__header">
                <div>
                  <h2 id="guestbook-results-title">전체 메시지</h2>
                  <p>표시 {filteredMessages.length}건 · 전체 {result.messages.length}건</p>
                </div>
                <div className="rsvp-admin-actions">
                  <button type="button" onClick={() => void loadMessages(session.token, "방명록을 새로고침했습니다.")} disabled={loading}>
                    <RefreshCw aria-hidden="true" /> {loading ? "불러오는 중" : "새로고침"}
                  </button>
                  <button type="button" onClick={() => downloadGuestbookCsv(result)}>
                    <Download aria-hidden="true" /> CSV 저장
                  </button>
                </div>
              </div>

              <div className="rsvp-admin-filters guestbook-admin-filters">
                <label className="rsvp-admin-search">
                  <span>검색</span>
                  <span><Search aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름 또는 메시지" /></span>
                </label>
                <label>
                  <span>공개 상태</span>
                  <select aria-label="공개 상태 필터" value={visibility} onChange={(event) => setVisibility(event.target.value as VisibilityFilter)}>
                    <option value="all">전체</option>
                    <option value="visible">공개</option>
                    <option value="hidden">비공개</option>
                  </select>
                </label>
                <button type="button" className="rsvp-admin-secondary" onClick={() => { setSearch(""); setVisibility("all"); }}>필터 초기화</button>
              </div>

              {filteredMessages.length === 0 ? (
                <p className="rsvp-admin-empty" role="status">조건에 맞는 메시지가 없습니다.</p>
              ) : (
                <ul className="guestbook-admin-list">
                  {filteredMessages.map((message) => (
                    <li key={message.id} className={message.isHidden ? "guestbook-admin-item guestbook-admin-item--hidden" : "guestbook-admin-item"}>
                      <div className="guestbook-admin-item__meta">
                        <strong>{message.nickname}</strong>
                        <span>{message.isHidden ? "비공개" : "공개"}</span>
                        <time dateTime={message.updatedAt}>{formatDate(message.updatedAt)}</time>
                      </div>
                      {editingId === message.id ? (
                        <form
                          className="guestbook-admin-edit"
                          onSubmit={(event) => { event.preventDefault(); void handleUpdate(message); }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape" && !busyId) {
                              event.preventDefault();
                              cancelEditing();
                            }
                          }}
                        >
                          <label>
                            <span>작성자</span>
                            <input autoFocus value={editNickname} maxLength={16} onChange={(event) => setEditNickname(event.target.value)} disabled={busyId !== null} required />
                          </label>
                          <label>
                            <span>메시지</span>
                            <textarea value={editMessage} maxLength={240} rows={4} onChange={(event) => setEditMessage(event.target.value)} disabled={busyId !== null} required />
                            <small>{editMessage.length}/240</small>
                          </label>
                          <div>
                            <button type="button" className="rsvp-admin-secondary" onClick={cancelEditing} disabled={busyId !== null}>취소</button>
                            <button type="submit" disabled={busyId !== null || !editNickname.trim() || !editMessage.trim()}>{busyId === message.id ? "저장 중" : "변경 저장"}</button>
                          </div>
                        </form>
                      ) : (
                        <p>{message.message}</p>
                      )}
                      {editingId === message.id ? null : deleteTarget?.id === message.id ? (
                        <div className="guestbook-delete-confirm" role="group" aria-label={`${message.nickname} 메시지 삭제 확인`}>
                          <span>영구 삭제할까요?</span>
                          <button type="button" className="rsvp-admin-secondary" onClick={() => setDeleteTarget(null)} disabled={busyId !== null}>취소</button>
                          <button type="button" className="rsvp-admin-danger" onClick={() => void handleDelete()} disabled={busyId !== null}>
                            {busyId === message.id ? "삭제 중" : "삭제"}
                          </button>
                        </div>
                      ) : (
                        <div className="guestbook-admin-item__actions">
                          <button type="button" className="rsvp-admin-secondary" onClick={() => startEditing(message)} disabled={busyId !== null}>
                            <Pencil aria-hidden="true" /> 수정
                          </button>
                          <button type="button" className="rsvp-admin-secondary" onClick={() => void handleModerate(message)} disabled={busyId !== null}>
                            {message.isHidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                            {busyId === message.id ? "변경 중" : message.isHidden ? "다시 공개" : "비공개"}
                          </button>
                          <button type="button" className="rsvp-admin-delete" aria-label={`${message.nickname} 메시지 삭제`} onClick={() => setDeleteTarget(message)} disabled={busyId !== null}>
                            <Trash2 aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

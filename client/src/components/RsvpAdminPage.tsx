import { useEffect, useMemo, useRef, useState } from "react";
import { Download, LockKeyhole, LogOut, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import { normalizeRsvpPhone } from "@wedding-game/shared";
import type {
  RsvpAdminResult,
  RsvpAttendance,
  RsvpMealStatus,
  RsvpRecord,
  RsvpRecordSide
} from "@wedding-game/shared";
import {
  createAdminSession,
  deleteAdminRsvp,
  fetchAdminRsvps,
  updateAdminRsvp,
  WeddingApiError,
  type AdminSession
} from "../api/weddingApi";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { coupleSides } from "../invitation/coupleOrder";
import { downloadRsvpCsv } from "../invitation/rsvpCsv";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import { AdminNotificationInbox } from "./AdminNotificationInbox";

type FilterValue<T extends string> = "all" | T;

type EditableRsvpSide = Exclude<RsvpRecordSide, "legacy">;

type RsvpEditDraft = {
  side: EditableRsvpSide;
  guestName: string;
  phone: string;
  attendance: RsvpAttendance;
  partySize: number;
  mealStatus: RsvpMealStatus;
  note: string;
};

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s/g, "");
}

function isPhoneSearch(value: string): boolean {
  const normalized = value.normalize("NFKC").trim();
  return /\d/.test(normalized) && /^[\d\s+().-]+$/.test(normalized);
}

function sideLabel(side: RsvpRecordSide): string {
  return side === "groom" ? "신랑측" : side === "bride" ? "신부측" : "기존";
}

function attendanceLabel(attendance: RsvpAttendance): string {
  return attendance === "yes" ? "참석" : attendance === "no" ? "불참" : "미정";
}

function mealLabel(meal: RsvpMealStatus): string {
  if (meal === "yes") return "식사 예정";
  if (meal === "no") return "식사 안 함";
  if (meal === "unsure") return "미정";
  return "해당 없음";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(date);
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof WeddingApiError)) return fallback;
  if (error.status === 403) return "비밀번호를 확인해 주세요.";
  if (error.status === 429) {
    return error.retryAfterSeconds === undefined
      ? "로그인 시도가 제한되었습니다. 잠시 후 다시 시도해 주세요."
      : `${error.retryAfterSeconds}초 후 다시 시도해 주세요.`;
  }
  return fallback;
}

function isEditableRsvp(response: RsvpRecord): response is RsvpRecord & {
  side: EditableRsvpSide;
  phone: string;
  consentVersion: string;
} {
  return response.side !== "legacy" && Boolean(response.phone) && Boolean(response.consentVersion);
}

function editDraft(response: RsvpRecord & { side: EditableRsvpSide; phone: string }): RsvpEditDraft {
  return {
    side: response.side,
    guestName: response.guestName,
    phone: response.phone,
    attendance: response.attendance,
    partySize: response.partySize,
    mealStatus: response.mealStatus,
    note: response.note
  };
}

export function RsvpAdminPage() {
  const id = invitationId();
  const coupleOrder = useCoupleOrder();
  const sideOrder = coupleSides(coupleOrder);
  const mountedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const loginBusyRef = useRef(false);
  const fetchBusyRef = useRef(false);
  const deleteBusyRef = useRef(false);
  const updateBusyRef = useRef(false);
  const loginVersionRef = useRef(0);
  const fetchVersionRef = useRef(0);
  const deleteVersionRef = useRef(0);
  const shellRef = useRef<HTMLDivElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useRef<HTMLElement>(null);
  const editDialogRef = useRef<HTMLFormElement>(null);
  const editNameRef = useRef<HTMLInputElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreDeleteFocusRef = useRef(false);
  const restoreEditFocusRef = useRef(false);
  const focusAfterDeleteRef = useRef(false);
  const loginInputRef = useRef<HTMLInputElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  const [session, setSession] = useState<AdminSession | null>(null);
  const [result, setResult] = useState<RsvpAdminResult | null>(null);
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RsvpRecord | null>(null);
  const [editTarget, setEditTarget] = useState<RsvpRecord | null>(null);
  const [editValues, setEditValues] = useState<RsvpEditDraft | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [retryUntil, setRetryUntil] = useState(0);
  const [retryClock, setRetryClock] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [side, setSide] = useState<FilterValue<RsvpRecordSide>>("all");
  const [attendance, setAttendance] = useState<FilterValue<RsvpAttendance>>("all");
  const [meal, setMeal] = useState<FilterValue<RsvpMealStatus>>("all");
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - retryClock) / 1_000));

  function resetAdminState(message = "", resetInteraction = false) {
    sessionRef.current = null;
    loginVersionRef.current += 1;
    fetchVersionRef.current += 1;
    deleteVersionRef.current += 1;
    loginBusyRef.current = false;
    fetchBusyRef.current = false;
    deleteBusyRef.current = false;
    updateBusyRef.current = false;
    clearAdminSession(id);
    setSession(null);
    setResult(null);
    setIsLoggingIn(false);
    setIsFetching(false);
    setDeletingId(null);
    setDeleteTarget(null);
    setEditTarget(null);
    setEditValues(null);
    setUpdatingId(null);
    setError(message);
    setStatus("");
    setPassword("");
    setRetryUntil(0);
    setRetryClock(Date.now());
    if (resetInteraction) {
      setSearch("");
      setSide("all");
      setAttendance("all");
      setMeal("all");
    }
  }

  async function loadAll(token: string, options: {
    force?: boolean;
    successMessage?: string;
    announce?: boolean;
  } = {}) {
    if (fetchBusyRef.current && !options.force) return;
    fetchBusyRef.current = true;
    const version = ++fetchVersionRef.current;
    setIsFetching(true);
    setError("");
    if (options.force) setStatus("");
    else if (options.announce) setStatus("참석 답변을 새로고침하고 있습니다.");
    try {
      const nextResult = await fetchAdminRsvps(token);
      if (!mountedRef.current || version !== fetchVersionRef.current || sessionRef.current?.token !== token) return;
      setResult(nextResult);
      setStatus(options.successMessage || (options.announce ? "참석 답변 새로고침을 완료했습니다." : ""));
    } catch (loadError) {
      if (!mountedRef.current || version !== fetchVersionRef.current || sessionRef.current?.token !== token) return;
      if (loadError instanceof WeddingApiError && loadError.status === 401) {
        resetAdminState("세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (options.force || options.announce) setStatus("");
      setError(errorMessage(loadError, "참석 답변을 불러오지 못했습니다. 다시 시도해 주세요."));
    } finally {
      if (version === fetchVersionRef.current) {
        fetchBusyRef.current = false;
        if (mountedRef.current) setIsFetching(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    const restored = loadAdminSession(id);
    if (restored) {
      sessionRef.current = restored;
      setSession(restored);
      void loadAll(restored.token);
    }
    return () => {
      mountedRef.current = false;
    };
    // The invitation id is fixed for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!session) return;
    let timer: number | undefined;
    const expireWhenDue = () => {
      const remainingMs = session.expiresAt - Date.now();
      if (remainingMs <= 0) {
        if (sessionRef.current?.token === session.token) {
          resetAdminState("세션이 만료되었습니다. 다시 로그인해 주세요.");
        }
        return;
      }
      timer = window.setTimeout(expireWhenDue, Math.min(remainingMs, 2_147_483_647));
    };
    expireWhenDue();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // The timer intentionally expires the session snapshot that created it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.expiresAt, session?.token]);

  useEffect(() => {
    if (retryUntil <= 0) return;
    const syncRetryClock = () => {
      const now = Date.now();
      setRetryClock(now);
      if (now >= retryUntil) setRetryUntil(0);
    };
    const timer = window.setInterval(syncRetryClock, 1_000);
    document.addEventListener("visibilitychange", syncRetryClock);
    window.addEventListener("focus", syncRetryClock);
    window.addEventListener("pageshow", syncRetryClock);
    syncRetryClock();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", syncRetryClock);
      window.removeEventListener("focus", syncRetryClock);
      window.removeEventListener("pageshow", syncRetryClock);
    };
  }, [retryUntil]);

  useEffect(() => {
    shellRef.current?.toggleAttribute("inert", Boolean(deleteTarget || editTarget));
    if (editTarget) {
      if (updatingId !== null) editDialogRef.current?.focus();
      else editNameRef.current?.focus();
      return;
    }
    if (restoreEditFocusRef.current && editTriggerRef.current?.isConnected) {
      editTriggerRef.current.focus();
    }
    restoreEditFocusRef.current = false;
    editTriggerRef.current = null;
    if (deleteTarget) {
      if (deletingId !== null) deleteDialogRef.current?.focus();
      else cancelDeleteRef.current?.focus();
      return;
    }
    if (focusAfterDeleteRef.current) {
      (resultsHeadingRef.current ?? loginInputRef.current)?.focus();
      focusAfterDeleteRef.current = false;
      restoreDeleteFocusRef.current = false;
      deleteTriggerRef.current = null;
      return;
    }
    if (restoreDeleteFocusRef.current && deleteTriggerRef.current?.isConnected) {
      deleteTriggerRef.current.focus();
    }
    restoreDeleteFocusRef.current = false;
    deleteTriggerRef.current = null;
  }, [deleteTarget, deletingId, editTarget, updatingId]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginBusyRef.current || retrySeconds > 0 || !password) return;
    loginBusyRef.current = true;
    const version = ++loginVersionRef.current;
    setIsLoggingIn(true);
    setError("");
    setStatus("");
    try {
      const nextSession = await createAdminSession(password);
      if (!mountedRef.current || version !== loginVersionRef.current) return;
      sessionRef.current = nextSession;
      setSession(nextSession);
      saveAdminSession(id, nextSession);
      setPassword("");
      await loadAll(nextSession.token);
    } catch (loginError) {
      if (!mountedRef.current || version !== loginVersionRef.current) return;
      setPassword("");
      if (loginError instanceof WeddingApiError && loginError.status === 401) {
        resetAdminState("인증할 수 없습니다. 다시 로그인해 주세요.");
      } else {
        if (loginError instanceof WeddingApiError
          && loginError.status === 429
          && loginError.retryAfterSeconds !== undefined) {
          const now = Date.now();
          const seconds = Math.max(1, loginError.retryAfterSeconds);
          setError("");
          setRetryClock(now);
          setRetryUntil(now + seconds * 1_000);
        } else {
          setError(errorMessage(loginError, "로그인하지 못했습니다. 다시 시도해 주세요."));
        }
      }
    } finally {
      if (version === loginVersionRef.current) {
        loginBusyRef.current = false;
        if (mountedRef.current) setIsLoggingIn(false);
      }
    }
  }

  async function handleDelete() {
    const target = deleteTarget;
    const token = sessionRef.current?.token;
    if (!target || !token || deleteBusyRef.current) return;
    deleteBusyRef.current = true;
    const version = ++deleteVersionRef.current;
    setDeletingId(target.id);
    setError("");
    try {
      await deleteAdminRsvp(token, target.id);
      if (!mountedRef.current || version !== deleteVersionRef.current || sessionRef.current?.token !== token) return;
      restoreDeleteFocusRef.current = false;
      focusAfterDeleteRef.current = true;
      await loadAll(token, {
        force: true,
        successMessage: `${target.guestName}님의 답변을 삭제했습니다.`
      });
      if (mountedRef.current && sessionRef.current?.token === token) setDeleteTarget(null);
    } catch (deleteError) {
      if (!mountedRef.current || version !== deleteVersionRef.current || sessionRef.current?.token !== token) return;
      if (deleteError instanceof WeddingApiError && deleteError.status === 401) {
        resetAdminState("세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(errorMessage(deleteError, "답변을 삭제하지 못했습니다. 기존 목록은 유지됩니다."));
      focusAfterDeleteRef.current = false;
      restoreDeleteFocusRef.current = true;
      setDeleteTarget(null);
    } finally {
      if (version === deleteVersionRef.current) {
        deleteBusyRef.current = false;
        if (mountedRef.current) setDeletingId(null);
      }
    }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = editTarget;
    const values = editValues;
    const token = sessionRef.current?.token;
    if (!target || !values || !token || updateBusyRef.current || !isEditableRsvp(target)) return;

    const phone = normalizeRsvpPhone(values.phone);
    if (phone.length < 8 || phone.length > 15) {
      setError("연락처는 숫자 8~15자리로 입력해 주세요.");
      editDialogRef.current?.focus();
      return;
    }

    updateBusyRef.current = true;
    setUpdatingId(target.id);
    setError("");
    setStatus("");
    try {
      await updateAdminRsvp(token, target.id, {
        ...values,
        phone,
        guestName: values.guestName.trim(),
        note: values.note.trim(),
        revision: target.revision
      });
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      await loadAll(token, {
        force: true,
        successMessage: `${values.guestName.trim()}님의 답변을 수정했습니다.`
      });
      if (mountedRef.current && sessionRef.current?.token === token) {
        setEditTarget(null);
        setEditValues(null);
      }
    } catch (updateError) {
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      if (updateError instanceof WeddingApiError && updateError.status === 401) {
        resetAdminState("세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (updateError instanceof WeddingApiError && updateError.status === 409) {
        setError("다른 변경이 먼저 저장되었습니다. 목록을 새로고침한 뒤 다시 수정해 주세요.");
      } else {
        setError(errorMessage(updateError, "답변을 수정하지 못했습니다. 입력 내용을 확인해 주세요."));
      }
    } finally {
      updateBusyRef.current = false;
      if (mountedRef.current) setUpdatingId(null);
    }
  }

  const filteredResponses = useMemo(() => {
    if (!result) return [];
    const nameQuery = normalizeSearch(search);
    const phoneQuery = isPhoneSearch(search) ? normalizeRsvpPhone(search) : "";
    return result.responses.filter((response) => {
      const matchesQuery = !nameQuery
        || normalizeSearch(response.guestName).includes(nameQuery)
        || (phoneQuery.length > 0 && normalizeRsvpPhone(response.phone ?? "").includes(phoneQuery));
      return matchesQuery
        && (side === "all" || response.side === side)
        && (attendance === "all" || response.attendance === attendance)
        && (meal === "all" || response.mealStatus === meal);
    });
  }, [attendance, meal, result, search, side]);

  function resetFilters() {
    setSearch("");
    setSide("all");
    setAttendance("all");
    setMeal("all");
  }

  function openDeleteDialog(response: RsvpRecord, trigger: HTMLButtonElement) {
    deleteTriggerRef.current = trigger;
    focusAfterDeleteRef.current = false;
    restoreDeleteFocusRef.current = true;
    setDeleteTarget(response);
  }

  function openEditDialog(response: RsvpRecord, trigger: HTMLButtonElement) {
    if (!isEditableRsvp(response)) return;
    editTriggerRef.current = trigger;
    restoreEditFocusRef.current = true;
    setError("");
    setEditTarget(response);
    setEditValues(editDraft(response));
  }

  function closeEditDialog() {
    if (updatingId !== null) return;
    restoreEditFocusRef.current = true;
    setEditTarget(null);
    setEditValues(null);
  }

  function updateAttendance(nextAttendance: RsvpAttendance) {
    setEditValues((current) => {
      if (!current) return current;
      if (nextAttendance === "no") {
        return { ...current, attendance: nextAttendance, partySize: 0, mealStatus: "not_applicable" };
      }
      if (nextAttendance === "unsure") {
        return { ...current, attendance: nextAttendance, partySize: Math.max(1, current.partySize), mealStatus: "unsure" };
      }
      return {
        ...current,
        attendance: nextAttendance,
        partySize: Math.max(1, current.partySize),
        mealStatus: current.mealStatus === "not_applicable" ? "unsure" : current.mealStatus
      };
    });
  }

  function closeDeleteDialog() {
    if (deletingId !== null) return;
    restoreDeleteFocusRef.current = true;
    setDeleteTarget(null);
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      if (deletingId === null) {
        event.preventDefault();
        closeDeleteDialog();
      }
      return;
    }
    if (event.key !== "Tab") return;
    if (deletingId !== null) {
      event.preventDefault();
      deleteDialogRef.current?.focus();
      return;
    }
    const focusable = Array.from(
      deleteDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1) ?? first;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleEditDialogKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      if (updatingId === null) {
        event.preventDefault();
        closeEditDialog();
      }
      return;
    }
    if (event.key !== "Tab") return;
    if (updatingId !== null) {
      event.preventDefault();
      editDialogRef.current?.focus();
      return;
    }
    const focusable = Array.from(
      editDialogRef.current?.querySelectorAll<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)") ?? []
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1) ?? first;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!session) {
    return (
      <main className="rsvp-admin-page">
        <section className="rsvp-admin-login" aria-labelledby="rsvp-admin-title">
          <LockKeyhole aria-hidden="true" />
          <p className="rsvp-admin-eyebrow">PRIVATE ACCESS</p>
          <h1 id="rsvp-admin-title">참석 답변 관리</h1>
          <form onSubmit={handleLogin}>
            <label htmlFor="rsvp-admin-password">관리자 비밀번호</label>
            <input
              ref={loginInputRef}
              id="rsvp-admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoggingIn || retrySeconds > 0}
              required
            />
            <button type="submit" disabled={isLoggingIn || retrySeconds > 0 || !password}>
              {isLoggingIn ? "로그인 중" : retrySeconds > 0 ? `${retrySeconds}초 후 로그인` : "로그인"}
            </button>
          </form>
          {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
          {retrySeconds > 0 && (
            <>
              <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">로그인 시도가 제한되었습니다.</p>
              <p className="rsvp-admin-message" aria-live="off">{retrySeconds}초 후 다시 시도해 주세요.</p>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="rsvp-admin-page">
      <div ref={shellRef} className="rsvp-admin-shell" aria-hidden={deleteTarget || editTarget ? true : undefined}>
        <header className="rsvp-admin-header">
          <div>
            <p className="rsvp-admin-eyebrow">MJ CONVENTION · 2027.05.01</p>
            <h1>참석 답변 관리</h1>
          </div>
          <div className="guestbook-admin-header-actions">
            <a className="rsvp-admin-nav-link" href="?admin=analytics">방문 통계</a>
            <a className="rsvp-admin-nav-link" href="?admin=release">통합 공개</a>
            <a className="rsvp-admin-nav-link" href="?admin=content">실데이터 편집</a>
            <a className="rsvp-admin-nav-link" href="?admin=gallery">사진 관리</a>
            <a className="rsvp-admin-nav-link" href="?admin=readiness">공개 준비</a>
            <a className="rsvp-admin-nav-link" href="?admin=guestbook">방명록 관리</a>
            <button type="button" className="rsvp-admin-secondary" onClick={() => resetAdminState("", true)}>
              <LogOut aria-hidden="true" /> 로그아웃
            </button>
          </div>
        </header>

        <AdminNotificationInbox
          token={session.token}
          onUnauthorized={() => resetAdminState("세션이 만료되었습니다. 다시 로그인해 주세요.")}
        />

        {isFetching && !result && <p className="rsvp-admin-message" role="status">참석 답변을 불러오고 있습니다.</p>}
        {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        {error && !result && (
          <button type="button" onClick={() => void loadAll(session.token)} disabled={isFetching}>
            <RefreshCw aria-hidden="true" /> 다시 불러오기
          </button>
        )}
        {status && <p className="rsvp-admin-message" role="status">{status}</p>}

        {result && (
          <>
            <section className="rsvp-admin-summary" aria-labelledby="rsvp-summary-title">
              <h2 id="rsvp-summary-title">참석 답변 현황</h2>
              <dl>
                <div><dt>전체 답변</dt><dd>{result.summary.responseCount}</dd></div>
                <div><dt>참석 확정 응답</dt><dd>{result.summary.attendingResponseCount}</dd></div>
                <div><dt>참석 확정 총인원</dt><dd>{result.summary.attendingPartySize}</dd></div>
                <div><dt>식사 예정 인원</dt><dd>{result.summary.mealPartySize}</dd></div>
                <div><dt>불참 응답</dt><dd>{result.summary.declinedResponseCount}</dd></div>
                <div><dt>미정 응답</dt><dd>{result.summary.unsureResponseCount}</dd></div>
                <div><dt>미정 예상 인원</dt><dd>{result.summary.unsurePartySize}</dd></div>
                <div><dt>자동 삭제일</dt><dd>{formatDate(result.summary.deleteAt)}</dd></div>
              </dl>
            </section>

            <section className="rsvp-admin-results" aria-labelledby="rsvp-results-title">
              <div className="rsvp-admin-results__header">
                <div>
                  <h2 ref={resultsHeadingRef} id="rsvp-results-title" tabIndex={-1}>전체 답변</h2>
                  <p>표시 {filteredResponses.length}건 · 전체 {result.responses.length}건</p>
                </div>
                <div className="rsvp-admin-actions">
                  <button type="button" onClick={() => void loadAll(session.token, { announce: true })} disabled={isFetching}>
                    <RefreshCw aria-hidden="true" /> {isFetching ? "불러오는 중" : "새로고침"}
                  </button>
                  <button type="button" onClick={() => downloadRsvpCsv(result)}>
                    <Download aria-hidden="true" /> CSV 저장
                  </button>
                </div>
              </div>

              <div className="rsvp-admin-filters">
                <label className="rsvp-admin-search">
                  <span>검색</span>
                  <span><Search aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름 또는 연락처" /></span>
                </label>
                <label>
                  <span>대상</span>
                  <select
                    aria-label="대상 필터"
                    value={side}
                    onChange={(event) => setSide(event.target.value as FilterValue<RsvpRecordSide>)}
                  >
                    <option value="all">전체</option>
                    {sideOrder.map((weddingSide) => (
                      <option key={weddingSide} value={weddingSide}>
                        {weddingSide === "bride" ? "신부측" : "신랑측"}
                      </option>
                    ))}
                    <option value="legacy">기존</option>
                  </select>
                </label>
                <label><span>참석</span><select aria-label="참석 필터" value={attendance} onChange={(event) => setAttendance(event.target.value as FilterValue<RsvpAttendance>)}><option value="all">전체</option><option value="yes">참석</option><option value="no">불참</option><option value="unsure">미정</option></select></label>
                <label><span>식사</span><select aria-label="식사 필터" value={meal} onChange={(event) => setMeal(event.target.value as FilterValue<RsvpMealStatus>)}><option value="all">전체</option><option value="yes">식사 예정</option><option value="no">식사 안 함</option><option value="unsure">미정</option><option value="not_applicable">해당 없음</option></select></label>
                <button type="button" className="rsvp-admin-secondary" onClick={resetFilters}>필터 초기화</button>
              </div>

              {filteredResponses.length === 0 ? (
                <p className="rsvp-admin-empty" role="status">조건에 맞는 답변이 없습니다.</p>
              ) : (
                <div className="rsvp-admin-table-wrap">
                  <table className="rsvp-admin-table">
                    <thead><tr><th>대상</th><th>이름</th><th>연락처</th><th>상태</th><th>인원</th><th>식사</th><th>전달사항</th><th>최근 수정</th><th>관리</th></tr></thead>
                    <tbody>
                      {filteredResponses.map((response) => (
                        <tr key={response.id}>
                          <td data-label="대상">{sideLabel(response.side)}</td>
                          <td data-label="이름"><strong>{response.guestName}</strong></td>
                          <td data-label="연락처">{response.phone ?? "-"}</td>
                          <td data-label="상태">{attendanceLabel(response.attendance)}</td>
                          <td data-label="인원">{response.partySize}</td>
                          <td data-label="식사">{mealLabel(response.mealStatus)}</td>
                          <td data-label="전달사항">{response.note || "-"}</td>
                          <td data-label="최근 수정"><time dateTime={response.updatedAt}>{formatDate(response.updatedAt)}</time></td>
                          <td data-label="관리">
                            <div className="rsvp-admin-row-actions">
                              <button
                                type="button"
                                className="rsvp-admin-edit"
                                aria-label={`${response.guestName} 답변 수정`}
                                title={isEditableRsvp(response) ? "답변 수정" : "기존 데이터는 수정할 수 없습니다"}
                                onClick={(event) => openEditDialog(response, event.currentTarget)}
                                disabled={deletingId !== null || updatingId !== null || !isEditableRsvp(response)}
                              >
                                <Pencil aria-hidden="true" />
                              </button>
                              <button type="button" className="rsvp-admin-delete" aria-label={`${response.guestName} 답변 삭제`} title="답변 삭제" onClick={(event) => openDeleteDialog(response, event.currentTarget)} disabled={deletingId !== null || updatingId !== null}><Trash2 aria-hidden="true" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {deleteTarget && (
        <div className="rsvp-admin-dialog-backdrop">
          <section ref={deleteDialogRef} className="rsvp-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="rsvp-delete-title" aria-busy={deletingId !== null} tabIndex={-1} onKeyDown={handleDialogKeyDown}>
            <h2 id="rsvp-delete-title">답변 삭제 확인</h2>
            <p><strong>{deleteTarget.guestName}</strong>님의 참석 답변을 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p>
            <div>
              <button ref={cancelDeleteRef} type="button" className="rsvp-admin-secondary" onClick={closeDeleteDialog} disabled={deletingId !== null}>취소</button>
              <button type="button" className="rsvp-admin-danger" onClick={() => void handleDelete()} disabled={deletingId !== null}>{deletingId ? "삭제 중" : "삭제"}</button>
            </div>
          </section>
        </div>
      )}

      {editTarget && editValues && (
        <div className="rsvp-admin-dialog-backdrop">
          <form
            ref={editDialogRef}
            className="rsvp-admin-dialog rsvp-admin-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rsvp-edit-title"
            aria-busy={updatingId !== null}
            tabIndex={-1}
            onSubmit={handleUpdate}
            onKeyDown={handleEditDialogKeyDown}
          >
            <div className="rsvp-admin-edit-dialog__heading">
              <div>
                <p className="rsvp-admin-eyebrow">RSVP RESPONSE</p>
                <h2 id="rsvp-edit-title">참석 답변 수정</h2>
              </div>
              <span>rev. {editTarget.revision}</span>
            </div>
            {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
            <div className="rsvp-admin-edit-grid">
              <label>
                <span>대상</span>
                <select value={editValues.side} onChange={(event) => setEditValues({ ...editValues, side: event.target.value as EditableRsvpSide })} disabled={updatingId !== null}>
                  {sideOrder.map((weddingSide) => <option key={weddingSide} value={weddingSide}>{weddingSide === "bride" ? "신부측" : "신랑측"}</option>)}
                </select>
              </label>
              <label>
                <span>이름</span>
                <input ref={editNameRef} value={editValues.guestName} maxLength={30} onChange={(event) => setEditValues({ ...editValues, guestName: event.target.value })} disabled={updatingId !== null} required />
              </label>
              <label className="rsvp-admin-edit-grid__wide">
                <span>연락처</span>
                <input type="tel" inputMode="tel" value={editValues.phone} maxLength={20} onChange={(event) => setEditValues({ ...editValues, phone: event.target.value })} disabled={updatingId !== null} required />
              </label>
              <label>
                <span>참석 여부</span>
                <select value={editValues.attendance} onChange={(event) => updateAttendance(event.target.value as RsvpAttendance)} disabled={updatingId !== null}>
                  <option value="yes">참석</option><option value="no">불참</option><option value="unsure">미정</option>
                </select>
              </label>
              <label>
                <span>인원</span>
                <input type="number" min={editValues.attendance === "no" ? 0 : 1} max={10} value={editValues.partySize} onChange={(event) => setEditValues({ ...editValues, partySize: Number(event.target.value) })} disabled={updatingId !== null || editValues.attendance === "no"} required />
              </label>
              <label className="rsvp-admin-edit-grid__wide">
                <span>식사 여부</span>
                <select value={editValues.mealStatus} onChange={(event) => setEditValues({ ...editValues, mealStatus: event.target.value as RsvpMealStatus })} disabled={updatingId !== null || editValues.attendance !== "yes"}>
                  <option value="yes">식사 예정</option><option value="no">식사 안 함</option><option value="unsure">미정</option><option value="not_applicable" disabled>해당 없음</option>
                </select>
              </label>
              <label className="rsvp-admin-edit-grid__full">
                <span>전달사항</span>
                <textarea value={editValues.note} maxLength={160} rows={4} onChange={(event) => setEditValues({ ...editValues, note: event.target.value })} disabled={updatingId !== null} />
                <small>{editValues.note.length}/160</small>
              </label>
            </div>
            <div className="rsvp-admin-dialog-actions">
              <button type="button" className="rsvp-admin-secondary" onClick={closeEditDialog} disabled={updatingId !== null}>취소</button>
              <button type="submit" disabled={updatingId !== null || !editValues.guestName.trim()}>{updatingId ? "저장 중" : "변경 저장"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

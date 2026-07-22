import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardCopy,
  Clock3,
  Eye,
  History,
  Link2,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  QrCode,
  RefreshCw,
  RotateCw,
  Search,
  Send,
  Share2,
  Users,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  InvitationInviteDeliveryChannel,
  InvitationInviteLinkAdminResult,
  InvitationInviteLinkRecord,
  InvitationReminderAdminResult,
  InvitationReminderStage,
  RsvpAdminResult
} from "@wedding-game/shared";
import {
  fetchAdminInvitationInviteLinks,
  rotateAdminInvitationInviteLink,
  updateAdminInvitationInviteLink
} from "../api/invitationInviteLinksApi";
import {
  fetchAdminInvitationReminders,
  recordAdminInvitationReminders
} from "../api/invitationRemindersApi";
import { createAdminSession, fetchAdminRsvps, WeddingApiError, type AdminSession } from "../api/weddingApi";
import { buildAttendanceOperations } from "../invitation/attendanceOperations";
import { copyText, isShareAbortError, NativeShareUnavailableError, shareContent } from "../invitation/browserActions";
import {
  clearAdminInviteLinkTokens,
  loadAdminInviteLinkTokens,
  saveAdminInviteLinkTokens
} from "../invitation/inviteLinkAdminTokens";
import {
  buildInvitationInviteUrl,
  downloadInvitationInviteQr,
  invitationInviteQrDataUrl
} from "../invitation/inviteLinkQr";
import { buildReminderMessage } from "../invitation/reminderMessages";
import {
  buildReminderQueue,
  buildReminderSchedules,
  recommendedReminderStage,
  reminderStageDefinitions,
  type ReminderQueueEntry,
  type ReminderQueueStatus
} from "../invitation/reminderOperations";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import "../reminders-admin.css";

type QueueFilter = "pending" | "completed" | "all";
type SideFilter = "all" | "bride" | "groom";

const emptyInviteResult: InvitationInviteLinkAdminResult = {
  summary: { total: 0, active: 0, delivered: 0, opened: 0, responded: 0 },
  links: []
};

const emptyReminderResult: InvitationReminderAdminResult = {
  summary: {
    totalSent: 0,
    uniqueGuests: 0,
    lastSentAt: null,
    byStage: { d30: 0, d14: 0, d7: 0, d1: 0, manual: 0 }
  },
  events: []
};

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function sideLabel(side: "bride" | "groom"): string {
  return side === "bride" ? "신부측" : "신랑측";
}

function channelLabel(channel: InvitationInviteDeliveryChannel): string {
  if (channel === "kakao") return "카카오톡";
  if (channel === "sms") return "문자";
  if (channel === "in_person") return "직접 전달";
  return "기타";
}

function statusLabel(status: ReminderQueueStatus): string {
  if (status === "unsent") return "미발송";
  if (status === "unopened") return "미열람";
  if (status === "unresponded") return "열람 후 미응답";
  if (status === "unsure") return "참석 미정";
  if (status === "attending") return "참석 예정";
  if (status === "sent") return "이번 단계 발송 완료";
  return "후속 연락 완료";
}

function formatDate(value: string | null, withTime = false): string {
  if (!value) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {})
  }).format(new Date(value));
}

function isCompleted(entry: ReminderQueueEntry): boolean {
  return entry.status === "sent" || entry.status === "resolved";
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof WeddingApiError && error.status === 401) return "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (error instanceof WeddingApiError && error.code === "invalid_request") return "선택 대상과 발송 내용을 확인해 주세요.";
  return fallback;
}

export function ReminderAdminPage() {
  const id = invitationId();
  const { event } = usePublishedInvitationContent();
  const mountedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [password, setPassword] = useState("");
  const [inviteResult, setInviteResult] = useState<InvitationInviteLinkAdminResult>(emptyInviteResult);
  const [rsvpResult, setRsvpResult] = useState<RsvpAdminResult | null>(null);
  const [reminderResult, setReminderResult] = useState<InvitationReminderAdminResult>(emptyReminderResult);
  const [tokens, setTokens] = useState<Record<string, string>>(() => loadAdminInviteLinkTokens(id));
  const [stage, setStage] = useState<InvitationReminderStage>(() => recommendedReminderStage(event));
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("pending");
  const [side, setSide] = useState<SideFilter>("all");
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [historyStage, setHistoryStage] = useState<InvitationReminderStage | "all">("all");
  const [deliveryIds, setDeliveryIds] = useState<string[]>([]);
  const [deliveryChannel, setDeliveryChannel] = useState<InvitationInviteDeliveryChannel>("kakao");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [qrPreview, setQrPreview] = useState<{ guestName: string; url: string; dataUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const logout = useCallback((message = "") => {
    sessionRef.current = null;
    clearAdminSession(id);
    clearAdminInviteLinkTokens(id);
    setSession(null);
    setInviteResult(emptyInviteResult);
    setRsvpResult(null);
    setReminderResult(emptyReminderResult);
    setTokens({});
    setSelectedIds([]);
    setDeliveryIds([]);
    setPassword("");
    setLoading(false);
    setError(message);
    setStatus("");
  }, [id]);

  const loadAll = useCallback(async (token: string, announcement = "") => {
    setLoading(true);
    setError("");
    try {
      const [invites, rsvps, reminders] = await Promise.all([
        fetchAdminInvitationInviteLinks(token),
        fetchAdminRsvps(token),
        fetchAdminInvitationReminders(token)
      ]);
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      setInviteResult(invites);
      setRsvpResult(rsvps);
      setReminderResult(reminders);
      setStatus(announcement);
    } catch (loadError) {
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      if (loadError instanceof WeddingApiError && loadError.status === 401) return logout(errorMessage(loadError, ""));
      setError(errorMessage(loadError, "리마인드 운영 정보를 불러오지 못했습니다."));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    mountedRef.current = true;
    const restored = loadAdminSession(id);
    if (restored) {
      sessionRef.current = restored;
      setSession(restored);
      void loadAll(restored.token);
    }
    return () => { mountedRef.current = false; };
  }, [id, loadAll]);

  useEffect(() => {
    setSelectedIds([]);
    setQueueFilter("pending");
  }, [stage]);

  async function handleLogin(eventForm: React.FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError("");
    try {
      const next = await createAdminSession(password);
      if (!mountedRef.current) return;
      sessionRef.current = next;
      setSession(next);
      saveAdminSession(id, next);
      setPassword("");
      await loadAll(next.token);
    } catch (loginError) {
      if (mountedRef.current) setError(errorMessage(loginError, "로그인하지 못했습니다. 비밀번호를 확인해 주세요."));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  const operations = useMemo(() => (
    rsvpResult ? buildAttendanceOperations(inviteResult, rsvpResult) : null
  ), [inviteResult, rsvpResult]);
  const schedules = useMemo(() => (
    operations ? buildReminderSchedules(event, operations, reminderResult.events) : []
  ), [event, operations, reminderResult.events]);
  const queue = useMemo(() => (
    operations ? buildReminderQueue(stage, operations, reminderResult.events) : []
  ), [operations, reminderResult.events, stage]);
  const groups = useMemo(() => [...new Set(inviteResult.links.map(({ groupLabel }) => groupLabel || "미분류"))].sort((a, b) => a.localeCompare(b, "ko-KR")), [inviteResult.links]);
  const visibleQueue = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    return queue.filter((entry) => {
      const link = entry.link!;
      const completed = isCompleted(entry);
      return (queueFilter === "all" || (queueFilter === "completed" ? completed : !completed))
        && (side === "all" || link.side === side)
        && (group === "all" || (link.groupLabel || "미분류") === group)
        && (!normalized || `${link.guestName} ${link.groupLabel}`.toLocaleLowerCase("ko-KR").includes(normalized));
    });
  }, [group, query, queue, queueFilter, side]);
  const visibleIds = visibleQueue.map(({ link }) => link!.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((linkId) => selectedIds.includes(linkId));
  const history = useMemo(() => reminderResult.events.filter((item) => historyStage === "all" || item.stage === historyStage), [historyStage, reminderResult.events]);

  function tokenFor(link: InvitationInviteLinkRecord): string | null {
    return tokens[link.id] ?? null;
  }

  async function prepareLink(link: InvitationInviteLinkRecord) {
    const adminToken = sessionRef.current?.token;
    if (!adminToken || busyId) return;
    if (!window.confirm(`${link.guestName}님의 기존 초대 링크를 폐기하고 재발급할까요? 이전 링크는 더 이상 열리지 않습니다.`)) return;
    setBusyId(link.id);
    setError("");
    try {
      const next = await rotateAdminInvitationInviteLink(adminToken, link.id);
      setInviteResult({ summary: next.summary, links: next.links });
      setTokens((current) => saveAdminInviteLinkTokens(id, current, next.created));
      setStatus(`${link.guestName}님의 재발송용 개인 링크를 준비했습니다.`);
    } catch (prepareError) {
      if (prepareError instanceof WeddingApiError && prepareError.status === 401) return logout(errorMessage(prepareError, ""));
      setError("개인 링크를 재발급하지 못했습니다.");
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  function messageFor(link: InvitationInviteLinkRecord) {
    const rawToken = tokenFor(link);
    return rawToken ? buildReminderMessage(stage, link.guestName, buildInvitationInviteUrl(rawToken), event) : null;
  }

  async function copyMessage(link: InvitationInviteLinkRecord) {
    const message = messageFor(link);
    if (!message) {
      setError(`${link.guestName}님의 개인 링크를 먼저 준비해 주세요.`);
      return;
    }
    try {
      await copyText(message.copyText);
      setError("");
      setStatus(`${link.guestName}님의 리마인드 문구를 복사했습니다. 실제 발송 후 이력을 기록해 주세요.`);
    } catch {
      setError("리마인드 문구를 복사하지 못했습니다.");
    }
  }

  async function shareMessage(link: InvitationInviteLinkRecord) {
    const message = messageFor(link);
    if (!message) return void setError(`${link.guestName}님의 개인 링크를 먼저 준비해 주세요.`);
    try {
      await shareContent({ title: message.title, text: message.text, url: message.url });
      setSelectedIds([link.id]);
      setStatus(`${link.guestName}님의 공유창을 열었습니다. 발송을 마쳤다면 이력을 기록해 주세요.`);
    } catch (shareError) {
      if (isShareAbortError(shareError)) return;
      if (shareError instanceof NativeShareUnavailableError) return void copyMessage(link);
      setError("공유창을 열지 못했습니다.");
    }
  }

  async function copySelectedMessages() {
    const selected = queue.filter(({ link }) => link && selectedIds.includes(link.id));
    const missing = selected.filter(({ link }) => link && !tokenFor(link));
    if (selected.length === 0) return void setError("리마인드를 보낼 하객을 선택해 주세요.");
    if (missing.length > 0) return void setError(`개인 링크가 없는 ${missing.length}명의 링크를 먼저 준비해 주세요.`);
    try {
      const messages = selected.map(({ link }) => messageFor(link!)!.copyText);
      await copyText(messages.join("\n\n──────────\n\n"));
      setError("");
      setStatus(`${selected.length}명의 개인화 문구를 한 번에 복사했습니다.`);
    } catch {
      setError("선택한 리마인드 문구를 복사하지 못했습니다.");
    }
  }

  async function showQr(link: InvitationInviteLinkRecord) {
    const rawToken = tokenFor(link);
    if (!rawToken || busyId) return;
    const url = buildInvitationInviteUrl(rawToken);
    setBusyId(link.id);
    try {
      setQrPreview({ guestName: link.guestName, url, dataUrl: await invitationInviteQrDataUrl(url) });
    } catch {
      setError("QR 이미지를 만들지 못했습니다.");
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  function openDelivery(ids: string[]) {
    if (ids.length === 0) return;
    const selected = inviteResult.links.filter((link) => ids.includes(link.id));
    setDeliveryIds(selected.map(({ id: linkId }) => linkId));
    setDeliveryChannel(selected.length === 1 && selected[0].deliveryChannel ? selected[0].deliveryChannel : "kakao");
    setDeliveryNote(`${reminderStageDefinitions[stage].shortLabel} 리마인드`);
  }

  async function recordDelivery(eventForm: React.FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const adminToken = sessionRef.current?.token;
    if (!adminToken || recording || deliveryIds.length === 0) return;
    setRecording(true);
    setError("");
    try {
      const reminders = await recordAdminInvitationReminders(adminToken, {
        linkIds: deliveryIds,
        stage,
        channel: deliveryChannel,
        note: deliveryNote
      });
      const invites = await fetchAdminInvitationInviteLinks(adminToken);
      if (!mountedRef.current || sessionRef.current?.token !== adminToken) return;
      setReminderResult(reminders);
      setInviteResult(invites);
      setSelectedIds([]);
      setDeliveryIds([]);
      setStatus(`${deliveryIds.length}명의 ${reminderStageDefinitions[stage].shortLabel} 발송 이력을 기록했습니다.`);
    } catch (recordError) {
      if (recordError instanceof WeddingApiError && recordError.status === 401) return logout(errorMessage(recordError, ""));
      setError(errorMessage(recordError, "발송 이력을 기록하지 못했습니다."));
    } finally {
      if (mountedRef.current) setRecording(false);
    }
  }

  async function toggleCompleted(link: InvitationInviteLinkRecord) {
    const adminToken = sessionRef.current?.token;
    if (!adminToken || busyId) return;
    setBusyId(link.id);
    setError("");
    try {
      const updated = await updateAdminInvitationInviteLink(adminToken, link.id, {
        followUpCompleted: !link.followUpCompletedAt
      });
      setInviteResult((current) => ({
        ...current,
        links: current.links.map((item) => item.id === updated.id ? updated : item)
      }));
      setStatus(link.followUpCompletedAt ? `${link.guestName}님의 연락 완료 표시를 취소했습니다.` : `${link.guestName}님의 후속 연락을 완료 처리했습니다.`);
    } catch (updateError) {
      if (updateError instanceof WeddingApiError && updateError.status === 401) return logout(errorMessage(updateError, ""));
      setError("후속 연락 상태를 변경하지 못했습니다.");
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  if (!session) {
    return (
      <main className="rsvp-admin-page reminder-admin-page">
        <section className="rsvp-admin-login" aria-labelledby="reminder-admin-login-title">
          <LockKeyhole aria-hidden="true" />
          <p className="rsvp-admin-eyebrow">PRIVATE FOLLOW-UP</p>
          <h1 id="reminder-admin-login-title">하객 리마인드·재발송</h1>
          <form onSubmit={handleLogin}>
            <label htmlFor="reminder-admin-password">관리자 비밀번호</label>
            <input id="reminder-admin-password" type="password" autoComplete="current-password" value={password} onChange={(eventInput) => setPassword(eventInput.target.value)} disabled={loading} required />
            <button type="submit" disabled={loading || !password}>{loading ? "로그인 중" : "로그인"}</button>
          </form>
          {error ? <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="rsvp-admin-page reminder-admin-page">
      <div className="rsvp-admin-shell" aria-hidden={deliveryIds.length > 0 || qrPreview ? true : undefined}>
        <header className="rsvp-admin-header reminder-admin-header">
          <div><p className="rsvp-admin-eyebrow">MJ CONVENTION · FOLLOW-UP</p><h1>하객 리마인드·재발송</h1><span>미응답을 놓치지 않고, 이미 답변한 하객에게는 불필요한 연락을 보내지 않습니다.</span></div>
          <div className="guestbook-admin-header-actions">
            <a className="rsvp-admin-nav-link" href="?admin=rsvp">참석 현황</a>
            <a className="rsvp-admin-nav-link" href="?admin=invites">초대 링크</a>
            <a className="rsvp-admin-nav-link" href="?admin=guest-info">공지·FAQ</a>
            <button type="button" className="rsvp-admin-secondary" onClick={() => logout()}><LogOut aria-hidden="true" /> 로그아웃</button>
          </div>
        </header>

        {error ? <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p> : null}
        {status ? <p className="rsvp-admin-message" role="status">{status}</p> : null}
        {loading && !rsvpResult ? <p className="rsvp-admin-message" role="status">하객 명단과 참석 답변을 연결하고 있습니다.</p> : null}

        {operations ? (
          <>
            <section className="reminder-admin-overview" aria-labelledby="reminder-overview-title">
              <div className="reminder-admin-section-heading"><div><p className="rsvp-admin-eyebrow">FOLLOW-UP OVERVIEW</p><h2 id="reminder-overview-title">리마인드 현황</h2></div><button type="button" className="rsvp-admin-secondary" disabled={loading} onClick={() => void loadAll(session.token, "리마인드 현황을 새로고침했습니다.")}><RefreshCw aria-hidden="true" /> 새로고침</button></div>
              <dl>
                <div><Users aria-hidden="true" /><dt>활성 하객</dt><dd>{inviteResult.summary.active}</dd></div>
                <div><CircleAlert aria-hidden="true" /><dt>후속 연락 필요</dt><dd>{operations.summary.followUpNeeded}</dd></div>
                <div><Send aria-hidden="true" /><dt>리마인드 기록</dt><dd>{reminderResult.summary.totalSent}</dd></div>
                <div><CheckCircle2 aria-hidden="true" /><dt>연락한 하객</dt><dd>{reminderResult.summary.uniqueGuests}</dd></div>
                <div><Clock3 aria-hidden="true" /><dt>최근 발송</dt><dd>{formatDate(reminderResult.summary.lastSentAt)}</dd></div>
              </dl>
            </section>

            <section className="reminder-admin-schedule" aria-labelledby="reminder-schedule-title">
              <div className="reminder-admin-section-heading"><div><p className="rsvp-admin-eyebrow">RECOMMENDED TIMELINE</p><h2 id="reminder-schedule-title">권장 발송 일정</h2></div><span>답변 마감 {formatDate(event.rsvp.responseDeadline)}</span></div>
              <div className="reminder-admin-schedule-grid">
                {schedules.map((item) => (
                  <button key={item.stage} type="button" className={stage === item.stage ? "is-selected" : ""} aria-pressed={stage === item.stage} onClick={() => setStage(item.stage)}>
                    <span><CalendarClock aria-hidden="true" />{item.scheduledAt ? formatDate(item.scheduledAt) : "필요할 때"}</span>
                    <strong>{item.label}</strong>
                    <p>{item.description}</p>
                    <small>대기 {item.pendingCount}명 · 완료 {item.completedCount}명</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="reminder-admin-queue" aria-labelledby="reminder-queue-title">
              <div className="reminder-admin-section-heading"><div><p className="rsvp-admin-eyebrow">TARGET QUEUE</p><h2 id="reminder-queue-title">{reminderStageDefinitions[stage].label} 대상</h2></div><span>{visibleQueue.length}명 표시</span></div>
              <div className="reminder-admin-toolbar">
                <label><Search aria-hidden="true" /><span className="sr-only">하객 검색</span><input type="search" value={query} placeholder="이름·관계 검색" onChange={(eventInput) => setQuery(eventInput.target.value)} /></label>
                <select aria-label="대상 측 필터" value={side} onChange={(eventInput) => setSide(eventInput.target.value as SideFilter)}><option value="all">양가 전체</option><option value="bride">신부측</option><option value="groom">신랑측</option></select>
                <select aria-label="관계 그룹 필터" value={group} onChange={(eventInput) => setGroup(eventInput.target.value)}><option value="all">모든 관계</option>{groups.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <div role="group" aria-label="처리 상태 필터"><button type="button" aria-pressed={queueFilter === "pending"} onClick={() => setQueueFilter("pending")}>대기</button><button type="button" aria-pressed={queueFilter === "completed"} onClick={() => setQueueFilter("completed")}>완료</button><button type="button" aria-pressed={queueFilter === "all"} onClick={() => setQueueFilter("all")}>전체</button></div>
              </div>
              {visibleQueue.length > 0 ? (
                <div className="reminder-admin-selection">
                  <label><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds((current) => allVisibleSelected ? current.filter((linkId) => !visibleIds.includes(linkId)) : [...new Set([...current, ...visibleIds])])} /> 현재 목록 전체 선택</label>
                  <strong>{selectedIds.length}명 선택</strong>
                  <button type="button" className="rsvp-admin-secondary" disabled={selectedIds.length === 0} onClick={() => void copySelectedMessages()}><MessageSquareText aria-hidden="true" /> 문구 묶음 복사</button>
                  <button type="button" disabled={selectedIds.length === 0} onClick={() => openDelivery(selectedIds)}><Send aria-hidden="true" /> 발송 완료 기록</button>
                </div>
              ) : null}

              {visibleQueue.length === 0 ? <p className="rsvp-admin-empty">선택한 조건에 해당하는 하객이 없습니다.</p> : (
                <ul className="reminder-admin-list">
                  {visibleQueue.map((entry) => {
                    const link = entry.link!;
                    const hasToken = Boolean(tokenFor(link));
                    return (
                      <li key={entry.key} className={isCompleted(entry) ? "is-completed" : ""}>
                        <label className="reminder-admin-row-select"><input type="checkbox" checked={selectedIds.includes(link.id)} onChange={() => setSelectedIds((current) => current.includes(link.id) ? current.filter((linkId) => linkId !== link.id) : [...current, link.id])} /><span className="sr-only">{link.guestName} 선택</span></label>
                        <div className="reminder-admin-person"><span className={`reminder-admin-status reminder-admin-status--${entry.status}`}>{statusLabel(entry.status)}</span><strong>{link.guestName}</strong><p>{sideLabel(link.side)} · {link.groupLabel || "미분류"}</p><small>발송 {link.sendCount}회 · 열람 {link.openCount}회 · 최근 {formatDate(link.lastSentAt, true)}</small></div>
                        <div className="reminder-admin-row-actions">
                          {hasToken ? <><button type="button" className="rsvp-admin-secondary" onClick={() => void copyMessage(link)}><ClipboardCopy aria-hidden="true" /> 문구</button><button type="button" className="rsvp-admin-secondary" onClick={() => void shareMessage(link)}><Share2 aria-hidden="true" /> 공유</button><button type="button" className="reminder-admin-icon-button" aria-label={`${link.guestName} QR 보기`} onClick={() => void showQr(link)} disabled={busyId !== null}><QrCode aria-hidden="true" /></button></> : <button type="button" className="rsvp-admin-secondary" onClick={() => void prepareLink(link)} disabled={busyId !== null}><RotateCw aria-hidden="true" /> 링크 준비</button>}
                          <button type="button" onClick={() => openDelivery([link.id])}><Send aria-hidden="true" /> 기록</button>
                          {stage !== "d1" ? <button type="button" className="reminder-admin-icon-button" aria-label={`${link.guestName} ${link.followUpCompletedAt ? "연락 완료 취소" : "연락 완료"}`} onClick={() => void toggleCompleted(link)} disabled={busyId !== null}><CheckCircle2 aria-hidden="true" /></button> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="reminder-admin-history" aria-labelledby="reminder-history-title">
              <div className="reminder-admin-section-heading"><div><p className="rsvp-admin-eyebrow">DELIVERY HISTORY</p><h2 id="reminder-history-title">리마인드 발송 이력</h2></div><select aria-label="발송 이력 단계 필터" value={historyStage} onChange={(eventInput) => setHistoryStage(eventInput.target.value as InvitationReminderStage | "all")}><option value="all">전체 단계</option>{Object.entries(reminderStageDefinitions).map(([value, definition]) => <option key={value} value={value}>{definition.label}</option>)}</select></div>
              {history.length === 0 ? <p className="rsvp-admin-empty">아직 기록된 리마인드 발송이 없습니다.</p> : (
                <ol>{history.map((item) => <li key={item.id}><History aria-hidden="true" /><div><strong>{item.guestName}</strong><span>{sideLabel(item.side)} · {item.groupLabel || "미분류"}</span></div><div><strong>{reminderStageDefinitions[item.stage].shortLabel}</strong><span>{channelLabel(item.channel)}{item.note ? ` · ${item.note}` : ""}</span></div><time dateTime={item.sentAt}>{formatDate(item.sentAt, true)}</time></li>)}</ol>
              )}
            </section>
          </>
        ) : null}
      </div>

      {deliveryIds.length > 0 ? (
        <div className="rsvp-admin-dialog-backdrop" onMouseDown={(eventMouse) => { if (eventMouse.target === eventMouse.currentTarget && !recording) setDeliveryIds([]); }}>
          <section className="rsvp-admin-dialog reminder-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="reminder-delivery-title">
            <header><div><p className="rsvp-admin-eyebrow">CONFIRM DELIVERY</p><h2 id="reminder-delivery-title">{deliveryIds.length}명 발송 완료 기록</h2></div><button type="button" className="reminder-admin-icon-button" aria-label="발송 기록 닫기" disabled={recording} onClick={() => setDeliveryIds([])}><X aria-hidden="true" /></button></header>
            <form onSubmit={recordDelivery}><p><strong>{reminderStageDefinitions[stage].label}</strong> 이력으로 저장합니다. 실제로 문구나 링크를 전달한 뒤 기록해 주세요.</p><label><span>발송 경로</span><select value={deliveryChannel} onChange={(eventInput) => setDeliveryChannel(eventInput.target.value as InvitationInviteDeliveryChannel)}><option value="kakao">카카오톡</option><option value="sms">문자</option><option value="in_person">직접 전달</option><option value="other">기타</option></select></label><label><span>관리 메모</span><textarea rows={3} maxLength={200} value={deliveryNote} onChange={(eventInput) => setDeliveryNote(eventInput.target.value)} /></label><div><button type="button" className="rsvp-admin-secondary" disabled={recording} onClick={() => setDeliveryIds([])}>취소</button><button type="submit" disabled={recording}><Send aria-hidden="true" />{recording ? "기록 중" : "발송 완료 저장"}</button></div></form>
          </section>
        </div>
      ) : null}

      {qrPreview ? (
        <div className="rsvp-admin-dialog-backdrop" onMouseDown={(eventMouse) => { if (eventMouse.target === eventMouse.currentTarget) setQrPreview(null); }}>
          <section className="rsvp-admin-dialog reminder-admin-qr" role="dialog" aria-modal="true" aria-labelledby="reminder-qr-title"><header><div><p className="rsvp-admin-eyebrow">PERSONAL QR</p><h2 id="reminder-qr-title">{qrPreview.guestName}님 재발송 QR</h2></div><button type="button" className="reminder-admin-icon-button" aria-label="QR 닫기" onClick={() => setQrPreview(null)}><X aria-hidden="true" /></button></header><img src={qrPreview.dataUrl} alt={`${qrPreview.guestName}님 개인 초대 링크 QR 코드`} /><p>QR에는 이름이나 연락처 대신 무작위 초대 토큰만 포함됩니다.</p><div><button type="button" onClick={() => void downloadInvitationInviteQr(qrPreview.url, qrPreview.guestName)}><QrCode aria-hidden="true" /> PNG 다운로드</button><button type="button" className="rsvp-admin-secondary" onClick={() => setQrPreview(null)}>닫기</button></div></section>
        </div>
      ) : null}
    </main>
  );
}

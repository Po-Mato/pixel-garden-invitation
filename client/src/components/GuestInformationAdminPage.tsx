import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  HelpCircle,
  Link2,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2
} from "lucide-react";
import type {
  GuestAnnouncementInput,
  GuestAnnouncementRecord,
  GuestFaqInput,
  GuestFaqRecord,
  GuestInformationAdminResult
} from "@wedding-game/shared";
import {
  createAdminGuestAnnouncement,
  createAdminGuestFaq,
  deleteAdminGuestInformationItem,
  fetchAdminGuestInformation,
  updateAdminGuestAnnouncement,
  updateAdminGuestFaq
} from "../api/guestInformationApi";
import { createAdminSession, WeddingApiError, type AdminSession } from "../api/weddingApi";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import "../guest-information-admin.css";

type AdminTab = "announcements" | "faqs";
type DeleteTarget = { kind: AdminTab; id: string; label: string };
type AnnouncementDraft = Omit<GuestAnnouncementInput, "startsAt" | "endsAt" | "actionUrl"> & {
  startsAt: string;
  endsAt: string;
  actionUrl: string;
};

const emptyAnnouncement: AnnouncementDraft = {
  title: "",
  body: "",
  tone: "info",
  active: true,
  pinned: false,
  startsAt: "",
  endsAt: "",
  actionKind: "none",
  actionLabel: "",
  actionUrl: "",
  sortOrder: 100
};

const emptyFaq: GuestFaqInput = {
  category: "예식 안내",
  question: "",
  answer: "",
  active: true,
  featured: false,
  sortOrder: 100
};

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function messageForError(error: unknown, fallback: string): string {
  if (!(error instanceof WeddingApiError)) return fallback;
  if (error.status === 401) return "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (error.status === 400) return "입력 내용을 확인해 주세요.";
  return fallback;
}

function localInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoOrNull(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDate(value: string | null): string {
  if (!value) return "제한 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function announcementInput(record: GuestAnnouncementRecord): GuestAnnouncementInput {
  return {
    title: record.title,
    body: record.body,
    tone: record.tone,
    active: record.active,
    pinned: record.pinned,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    actionKind: record.actionKind,
    actionLabel: record.actionLabel,
    actionUrl: record.actionUrl,
    sortOrder: record.sortOrder
  };
}

function faqInput(record: GuestFaqRecord): GuestFaqInput {
  return {
    category: record.category,
    question: record.question,
    answer: record.answer,
    active: record.active,
    featured: record.featured,
    sortOrder: record.sortOrder
  };
}

function announcementState(item: GuestAnnouncementRecord, now = Date.now()): string {
  if (!item.active) return "비공개";
  if (item.startsAt && Date.parse(item.startsAt) > now) return "공개 예약";
  if (item.endsAt && Date.parse(item.endsAt) <= now) return "공개 종료";
  return "공개 중";
}

function toneLabel(tone: GuestAnnouncementRecord["tone"]): string {
  return tone === "urgent" ? "긴급" : tone === "important" ? "중요" : "일반";
}

export function GuestInformationAdminPage() {
  const id = invitationId();
  const mountedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [result, setResult] = useState<GuestInformationAdminResult | null>(null);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<AdminTab>("announcements");
  const [announcementDraft, setAnnouncementDraft] = useState<AnnouncementDraft>(emptyAnnouncement);
  const [faqDraft, setFaqDraft] = useState<GuestFaqInput>(emptyFaq);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function resetEditors() {
    setAnnouncementDraft(emptyAnnouncement);
    setFaqDraft(emptyFaq);
    setEditingAnnouncementId(null);
    setEditingFaqId(null);
  }

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
    resetEditors();
  }

  async function loadInformation(token: string, announcement = "") {
    setLoading(true);
    setError("");
    try {
      const next = await fetchAdminGuestInformation(token);
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      setResult(next);
      setStatus(announcement);
    } catch (loadError) {
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      if (loadError instanceof WeddingApiError && loadError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(messageForError(loadError, "공지·FAQ 정보를 불러오지 못했습니다."));
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
      void loadInformation(restored.token);
    }
    return () => { mountedRef.current = false; };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.expiresAt, session?.token]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !password) return;
    setLoading(true);
    setError("");
    try {
      const next = await createAdminSession(password);
      if (!mountedRef.current) return;
      sessionRef.current = next;
      setSession(next);
      saveAdminSession(id, next);
      setPassword("");
      await loadInformation(next.token);
    } catch (loginError) {
      if (mountedRef.current) setError(messageForError(loginError, "로그인하지 못했습니다. 비밀번호를 확인해 주세요."));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function saveAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = sessionRef.current?.token;
    if (!token || busyId) return;
    const input: GuestAnnouncementInput = {
      ...announcementDraft,
      startsAt: isoOrNull(announcementDraft.startsAt),
      endsAt: isoOrNull(announcementDraft.endsAt),
      actionUrl: announcementDraft.actionKind === "external" ? announcementDraft.actionUrl : null
    };
    if (input.startsAt && input.endsAt && Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      setError("종료 시각은 시작 시각보다 늦어야 합니다.");
      return;
    }
    const operationId = editingAnnouncementId ?? "new-announcement";
    setBusyId(operationId);
    setError("");
    setStatus("");
    try {
      if (editingAnnouncementId) {
        await updateAdminGuestAnnouncement(token, editingAnnouncementId, input);
      } else {
        await createAdminGuestAnnouncement(token, input);
      }
      const message = editingAnnouncementId ? "공지를 수정했습니다." : "새 공지를 등록했습니다.";
      setAnnouncementDraft(emptyAnnouncement);
      setEditingAnnouncementId(null);
      await loadInformation(token, message);
    } catch (saveError) {
      if (saveError instanceof WeddingApiError && saveError.status === 401) return logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      setError(messageForError(saveError, "공지를 저장하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  async function saveFaq(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = sessionRef.current?.token;
    if (!token || busyId) return;
    const operationId = editingFaqId ?? "new-faq";
    setBusyId(operationId);
    setError("");
    setStatus("");
    try {
      if (editingFaqId) await updateAdminGuestFaq(token, editingFaqId, faqDraft);
      else await createAdminGuestFaq(token, faqDraft);
      const message = editingFaqId ? "FAQ를 수정했습니다." : "새 FAQ를 등록했습니다.";
      setFaqDraft(emptyFaq);
      setEditingFaqId(null);
      await loadInformation(token, message);
    } catch (saveError) {
      if (saveError instanceof WeddingApiError && saveError.status === 401) return logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      setError(messageForError(saveError, "FAQ를 저장하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  async function toggleAnnouncement(item: GuestAnnouncementRecord) {
    const token = sessionRef.current?.token;
    if (!token || busyId) return;
    setBusyId(item.id);
    setError("");
    try {
      await updateAdminGuestAnnouncement(token, item.id, { ...announcementInput(item), active: !item.active });
      await loadInformation(token, item.active ? "공지를 비공개 처리했습니다." : "공지를 공개 상태로 전환했습니다.");
    } catch (toggleError) {
      if (toggleError instanceof WeddingApiError && toggleError.status === 401) return logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      setError("공지 공개 상태를 변경하지 못했습니다.");
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  async function toggleFaq(item: GuestFaqRecord) {
    const token = sessionRef.current?.token;
    if (!token || busyId) return;
    setBusyId(item.id);
    setError("");
    try {
      await updateAdminGuestFaq(token, item.id, { ...faqInput(item), active: !item.active });
      await loadInformation(token, item.active ? "FAQ를 비공개 처리했습니다." : "FAQ를 공개 상태로 전환했습니다.");
    } catch (toggleError) {
      if (toggleError instanceof WeddingApiError && toggleError.status === 401) return logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      setError("FAQ 공개 상태를 변경하지 못했습니다.");
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  async function handleDelete() {
    const token = sessionRef.current?.token;
    if (!token || !deleteTarget || busyId) return;
    const target = deleteTarget;
    setBusyId(target.id);
    setError("");
    try {
      await deleteAdminGuestInformationItem(token, target.kind, target.id);
      setDeleteTarget(null);
      if (target.id === editingAnnouncementId || target.id === editingFaqId) resetEditors();
      await loadInformation(token, `${target.label} 항목을 삭제했습니다.`);
    } catch (deleteError) {
      if (deleteError instanceof WeddingApiError && deleteError.status === 401) return logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      setError("항목을 삭제하지 못했습니다.");
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  function editAnnouncement(item: GuestAnnouncementRecord) {
    setTab("announcements");
    setEditingAnnouncementId(item.id);
    setAnnouncementDraft({
      ...announcementInput(item),
      startsAt: localInput(item.startsAt),
      endsAt: localInput(item.endsAt),
      actionUrl: item.actionUrl ?? ""
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editFaq(item: GuestFaqRecord) {
    setTab("faqs");
    setEditingFaqId(item.id);
    setFaqDraft(faqInput(item));
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const faqCategories = useMemo(() => [...new Set(result?.faqs.map(({ category }) => category) ?? [])], [result]);

  if (!session) {
    return (
      <main className="rsvp-admin-page guest-info-admin-page">
        <section className="rsvp-admin-login" aria-labelledby="guest-info-admin-title">
          <LockKeyhole aria-hidden="true" />
          <p className="rsvp-admin-eyebrow">PRIVATE ACCESS</p>
          <h1 id="guest-info-admin-title">하객 공지·FAQ 운영</h1>
          <form onSubmit={handleLogin}>
            <label htmlFor="guest-info-admin-password">관리자 비밀번호</label>
            <input id="guest-info-admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} required />
            <button type="submit" disabled={loading || !password}>{loading ? "로그인 중" : "로그인"}</button>
          </form>
          {error ? <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="rsvp-admin-page guest-info-admin-page">
      <div className="rsvp-admin-shell">
        <header className="rsvp-admin-header">
          <div><p className="rsvp-admin-eyebrow">MJ CONVENTION · GUEST SUPPORT</p><h1>하객 공지·FAQ 운영</h1></div>
          <div className="guestbook-admin-header-actions">
            <a className="rsvp-admin-nav-link" href="?admin=rsvp">참석 현황</a>
            <a className="rsvp-admin-nav-link" href="?admin=invites">초대 링크</a>
            <a className="rsvp-admin-nav-link" href="?admin=analytics">방문 통계</a>
            <a className="rsvp-admin-nav-link" href="?admin=release">통합 공개</a>
            <button type="button" className="rsvp-admin-secondary" onClick={() => logout()}><LogOut aria-hidden="true" /> 로그아웃</button>
          </div>
        </header>

        {error ? <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p> : null}
        {status ? <p className="rsvp-admin-message" role="status">{status}</p> : null}
        {loading && !result ? <p className="rsvp-admin-message" role="status">공지·FAQ 정보를 불러오고 있습니다.</p> : null}
        {error && !result ? <button type="button" onClick={() => void loadInformation(session.token)}><RefreshCw aria-hidden="true" /> 다시 불러오기</button> : null}

        {result ? (
          <>
            <section className="guest-info-admin-summary" aria-labelledby="guest-info-summary-title">
              <div className="guest-info-admin-section-heading"><div><p className="rsvp-admin-eyebrow">LIVE OVERVIEW</p><h2 id="guest-info-summary-title">공개 현황</h2></div><button type="button" className="rsvp-admin-secondary" onClick={() => void loadInformation(session.token, "공지·FAQ를 새로고침했습니다.")} disabled={loading}><RefreshCw aria-hidden="true" /> 새로고침</button></div>
              <dl>
                <div><Bell aria-hidden="true" /><dt>전체 공지</dt><dd>{result.summary.totalAnnouncements}</dd></div>
                <div><CheckCircle2 aria-hidden="true" /><dt>현재 공개</dt><dd>{result.summary.activeAnnouncements}</dd></div>
                <div><CircleAlert aria-hidden="true" /><dt>긴급 공지</dt><dd>{result.summary.urgentAnnouncements}</dd></div>
                <div><HelpCircle aria-hidden="true" /><dt>공개 FAQ</dt><dd>{result.summary.activeFaqs}</dd></div>
                <div><Eye aria-hidden="true" /><dt>공지 조회</dt><dd>{result.summary.announcementViews}</dd></div>
              </dl>
            </section>

            <div className="guest-info-admin-tabs" role="tablist" aria-label="관리 대상">
              <button type="button" role="tab" aria-selected={tab === "announcements"} onClick={() => setTab("announcements")}><Bell aria-hidden="true" /> 공지 {result.announcements.length}</button>
              <button type="button" role="tab" aria-selected={tab === "faqs"} onClick={() => setTab("faqs")}><HelpCircle aria-hidden="true" /> FAQ {result.faqs.length}</button>
            </div>

            {tab === "announcements" ? (
              <section className="guest-info-admin-workspace" aria-labelledby="announcement-workspace-title">
                <form className="guest-info-admin-editor" onSubmit={saveAnnouncement}>
                  <div className="guest-info-admin-editor__heading"><div><p className="rsvp-admin-eyebrow">ANNOUNCEMENT</p><h2 id="announcement-workspace-title">{editingAnnouncementId ? "공지 수정" : "새 공지"}</h2></div><Bell aria-hidden="true" /></div>
                  <label><span>제목</span><input value={announcementDraft.title} maxLength={60} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, title: event.target.value })} required /></label>
                  <label><span>내용</span><textarea value={announcementDraft.body} maxLength={300} rows={5} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, body: event.target.value })} required /><small>{announcementDraft.body.length}/300</small></label>
                  <div className="guest-info-admin-editor__grid">
                    <label><span>중요도</span><select value={announcementDraft.tone} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, tone: event.target.value as GuestAnnouncementInput["tone"] })}><option value="info">일반 안내</option><option value="important">중요 안내</option><option value="urgent">긴급 안내</option></select></label>
                    <label><span>정렬 순서</span><input type="number" min={0} max={999} value={announcementDraft.sortOrder} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, sortOrder: Number(event.target.value) })} required /></label>
                    <label><span>공개 시작</span><input type="datetime-local" value={announcementDraft.startsAt} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, startsAt: event.target.value })} /></label>
                    <label><span>공개 종료</span><input type="datetime-local" value={announcementDraft.endsAt} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, endsAt: event.target.value })} /></label>
                    <label><span>행동 버튼</span><select value={announcementDraft.actionKind} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, actionKind: event.target.value as GuestAnnouncementInput["actionKind"], actionUrl: "" })}><option value="none">없음</option><option value="directions">길 찾기</option><option value="venue_phone">예식장 전화</option><option value="external">외부 링크</option></select></label>
                    <label><span>버튼 문구</span><input value={announcementDraft.actionLabel} maxLength={24} placeholder="자동 문구 사용 가능" onChange={(event) => setAnnouncementDraft({ ...announcementDraft, actionLabel: event.target.value })} /></label>
                  </div>
                  {announcementDraft.actionKind === "external" ? <label><span>외부 HTTPS 주소</span><input type="url" value={announcementDraft.actionUrl} maxLength={500} pattern="https://.*" onChange={(event) => setAnnouncementDraft({ ...announcementDraft, actionUrl: event.target.value })} required /></label> : null}
                  <div className="guest-info-admin-checks">
                    <label><input type="checkbox" checked={announcementDraft.active} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, active: event.target.checked })} /> 공개 활성화</label>
                    <label><input type="checkbox" checked={announcementDraft.pinned} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, pinned: event.target.checked })} /> 상단 고정</label>
                  </div>
                  <div className="guest-info-admin-editor__actions">
                    {editingAnnouncementId ? <button type="button" className="rsvp-admin-secondary" onClick={() => { setEditingAnnouncementId(null); setAnnouncementDraft(emptyAnnouncement); }}>수정 취소</button> : null}
                    <button type="submit" disabled={busyId !== null || !announcementDraft.title.trim() || !announcementDraft.body.trim()}>{editingAnnouncementId ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}{busyId === (editingAnnouncementId ?? "new-announcement") ? "저장 중" : editingAnnouncementId ? "변경 저장" : "공지 등록"}</button>
                  </div>
                </form>

                <div className="guest-info-admin-list" aria-label="공지 목록">
                  {result.announcements.length === 0 ? <p className="rsvp-admin-empty">등록된 공지가 없습니다.</p> : result.announcements.map((item) => (
                    <article key={item.id} className={`guest-info-admin-item guest-info-admin-item--${item.tone}${item.active ? "" : " guest-info-admin-item--inactive"}`}>
                      <div className="guest-info-admin-item__status"><span>{announcementState(item)}</span><span>{toneLabel(item.tone)}</span>{item.pinned ? <span>상단 고정</span> : null}</div>
                      <h3>{item.title}</h3><p>{item.body}</p>
                      <dl><div><dt>공개 시작</dt><dd>{formatDate(item.startsAt)}</dd></div><div><dt>공개 종료</dt><dd>{formatDate(item.endsAt)}</dd></div><div><dt>조회</dt><dd>{item.viewCount}회</dd></div></dl>
                      <div className="guest-info-admin-item__actions">
                        <button type="button" className="rsvp-admin-secondary" onClick={() => void toggleAnnouncement(item)} disabled={busyId !== null}>{item.active ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{item.active ? "비공개" : "공개"}</button>
                        <button type="button" onClick={() => editAnnouncement(item)} disabled={busyId !== null}><Pencil aria-hidden="true" /> 수정</button>
                        <button type="button" className="rsvp-admin-danger" aria-label={`${item.title} 공지 삭제`} onClick={() => setDeleteTarget({ kind: "announcements", id: item.id, label: item.title })} disabled={busyId !== null}><Trash2 aria-hidden="true" /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="guest-info-admin-workspace" aria-labelledby="faq-workspace-title">
                <form className="guest-info-admin-editor" onSubmit={saveFaq}>
                  <div className="guest-info-admin-editor__heading"><div><p className="rsvp-admin-eyebrow">FREQUENTLY ASKED</p><h2 id="faq-workspace-title">{editingFaqId ? "FAQ 수정" : "새 FAQ"}</h2></div><HelpCircle aria-hidden="true" /></div>
                  <label><span>카테고리</span><input value={faqDraft.category} maxLength={30} list="guest-info-faq-categories" onChange={(event) => setFaqDraft({ ...faqDraft, category: event.target.value })} required /><datalist id="guest-info-faq-categories">{faqCategories.map((category) => <option key={category} value={category} />)}</datalist></label>
                  <label><span>질문</span><input value={faqDraft.question} maxLength={80} onChange={(event) => setFaqDraft({ ...faqDraft, question: event.target.value })} required /></label>
                  <label><span>답변</span><textarea value={faqDraft.answer} maxLength={500} rows={7} onChange={(event) => setFaqDraft({ ...faqDraft, answer: event.target.value })} required /><small>{faqDraft.answer.length}/500</small></label>
                  <label><span>정렬 순서</span><input type="number" min={0} max={999} value={faqDraft.sortOrder} onChange={(event) => setFaqDraft({ ...faqDraft, sortOrder: Number(event.target.value) })} required /></label>
                  <div className="guest-info-admin-checks">
                    <label><input type="checkbox" checked={faqDraft.active} onChange={(event) => setFaqDraft({ ...faqDraft, active: event.target.checked })} /> 공개 활성화</label>
                    <label><input type="checkbox" checked={faqDraft.featured} onChange={(event) => setFaqDraft({ ...faqDraft, featured: event.target.checked })} /> 추천 질문</label>
                  </div>
                  <div className="guest-info-admin-editor__actions">
                    {editingFaqId ? <button type="button" className="rsvp-admin-secondary" onClick={() => { setEditingFaqId(null); setFaqDraft(emptyFaq); }}>수정 취소</button> : null}
                    <button type="submit" disabled={busyId !== null || !faqDraft.category.trim() || !faqDraft.question.trim() || !faqDraft.answer.trim()}>{editingFaqId ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}{busyId === (editingFaqId ?? "new-faq") ? "저장 중" : editingFaqId ? "변경 저장" : "FAQ 등록"}</button>
                  </div>
                </form>

                <div className="guest-info-admin-list" aria-label="FAQ 목록">
                  {result.faqs.map((item) => (
                    <article key={item.id} className={`guest-info-admin-item guest-info-admin-faq${item.active ? "" : " guest-info-admin-item--inactive"}`}>
                      <div className="guest-info-admin-item__status"><span>{item.active ? "공개" : "비공개"}</span><span>{item.category}</span>{item.featured ? <span>추천</span> : null}</div>
                      <h3>{item.question}</h3><p>{item.answer}</p>
                      <div className="guest-info-admin-item__actions">
                        <button type="button" className="rsvp-admin-secondary" onClick={() => void toggleFaq(item)} disabled={busyId !== null}>{item.active ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{item.active ? "비공개" : "공개"}</button>
                        <button type="button" onClick={() => editFaq(item)} disabled={busyId !== null}><Pencil aria-hidden="true" /> 수정</button>
                        <button type="button" className="rsvp-admin-danger" aria-label={`${item.question} FAQ 삭제`} onClick={() => setDeleteTarget({ kind: "faqs", id: item.id, label: item.question })} disabled={busyId !== null}><Trash2 aria-hidden="true" /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>

      {deleteTarget ? (
        <div className="rsvp-admin-dialog-backdrop">
          <section className="rsvp-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-info-delete-title">
            <h2 id="guest-info-delete-title">항목 삭제 확인</h2>
            <p><strong>{deleteTarget.label}</strong> 항목을 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p>
            <div><button type="button" className="rsvp-admin-secondary" onClick={() => setDeleteTarget(null)} disabled={busyId !== null}>취소</button><button type="button" className="rsvp-admin-danger" onClick={() => void handleDelete()} disabled={busyId !== null}>{busyId === deleteTarget.id ? "삭제 중" : "삭제"}</button></div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

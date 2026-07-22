import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock3,
  Eye,
  FilePenLine,
  History,
  Landmark,
  Link2,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Phone,
  RotateCcw,
  Save,
  Send,
  UsersRound,
  X
} from "lucide-react";
import {
  buildDefaultEditableInvitationContent,
  editableInvitationContentPublishIssues,
  invitationContent,
  parseEditableInvitationContent,
  type EditableInvitationContent,
  type InvitationContentAdminResult,
  type InvitationContentVersion,
  type WeddingContent,
  type WeddingFamilyContact,
  type WeddingGiftAccount
} from "@wedding-game/shared";

import {
  fetchAdminInvitationContent,
  publishAdminInvitationContent,
  restoreAdminInvitationContent,
  saveAdminInvitationContent
} from "../api/invitationContentApi";
import { createAdminSession, WeddingApiError, type AdminSession } from "../api/weddingApi";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import { resolveInvitationShareText } from "../invitation/shareInvitation";
import { CoupleProfilePanel } from "./CoupleProfilePanel";
import { FamilyContactContent } from "./FamilyContactSheet";
import { GiftAccountContent } from "./GiftAccountSheet";
import { WeddingStoryTimeline } from "./WeddingStoryTimeline";
import "../content-admin.css";

type EditorTab = "contacts" | "accounts" | "story" | "share" | "preview" | "history";
type BusyAction = "load" | "save" | "publish" | "restore" | null;

const tabs: Array<{ id: EditorTab; label: string }> = [
  { id: "contacts", label: "연락처" },
  { id: "accounts", label: "계좌" },
  { id: "story", label: "소개·스토리" },
  { id: "share", label: "공유 문구" },
  { id: "preview", label: "미리보기" },
  { id: "history", label: "변경 이력" }
];

const issueLabels: Record<string, string> = {
  family_contacts: "연락처 6건",
  gift_accounts: "계좌 6건",
  couple_introduction: "신랑·신부 소개",
  story_timeline: "네 단계 스토리",
  share: "공유 문구"
};

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function defaultDraft(): EditableInvitationContent {
  return structuredClone(buildDefaultEditableInvitationContent(
    invitationContent.event,
    invitationContent.content
  ));
}

function formatDate(value: string | null): string {
  if (!value) return "없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul"
      }).format(date);
}

function versionActionLabel(action: InvitationContentVersion["action"]): string {
  if (action === "publish") return "공개 반영";
  if (action === "restore") return "이전 버전 복구";
  return "초안 저장";
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof WeddingApiError)) return fallback;
  if (error.status === 401) return "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (error.status === 409 && error.code === "conflict") return "다른 변경이 먼저 저장되었습니다. 다시 불러와 주세요.";
  if (error.status === 413) return "입력 내용이 너무 큽니다. 문구 길이를 줄여 주세요.";
  return fallback;
}

function buildPreviewContent(draft: EditableInvitationContent): WeddingContent {
  return {
    ...invitationContent.content,
    coupleProfiles: invitationContent.content.coupleProfiles.map((profile) => ({
      ...profile,
      message: profile.role === "bride" ? draft.coupleIntroduction.bride : draft.coupleIntroduction.groom
    })),
    coupleMessage: draft.coupleIntroduction.together,
    storyTimeline: invitationContent.content.storyTimeline.map((step, index) => ({
      ...step,
      title: draft.storyTimeline[index]?.title ?? step.title,
      body: draft.storyTimeline[index]?.body ?? step.body
    }))
  };
}

export function ContentAdminPage() {
  const id = invitationId();
  const mountedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState<EditableInvitationContent>(defaultDraft);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [publishedRevision, setPublishedRevision] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<InvitationContentVersion[]>([]);
  const [activeTab, setActiveTab] = useState<EditorTab>("contacts");
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<InvitationContentVersion | null>(null);

  const serializedDraft = useMemo(() => JSON.stringify(draft), [draft]);
  const dirty = baseline === null || serializedDraft !== baseline;
  const publishIssues = useMemo(() => editableInvitationContentPublishIssues(draft), [draft]);
  const previewContent = useMemo(() => buildPreviewContent(draft), [draft]);
  const previewEvent = useMemo(() => ({
    ...invitationContent.event,
    familyContacts: draft.familyContacts,
    giftAccounts: draft.giftAccounts
  }), [draft.familyContacts, draft.giftAccounts]);
  const previewShareTitle = resolveInvitationShareText(draft.share.title, previewEvent);
  const previewShareDescription = resolveInvitationShareText(draft.share.description, previewEvent);

  function applyResult(result: InvitationContentAdminResult, announcement = "") {
    const nextDraft = structuredClone(result.draft ?? defaultDraft());
    setDraft(nextDraft);
    setBaseline(result.draft ? JSON.stringify(nextDraft) : null);
    setRevision(result.revision);
    setPublishedRevision(result.publishedRevision);
    setUpdatedAt(result.updatedAt);
    setPublishedAt(result.publishedAt);
    setHistory(result.history);
    setStatus(announcement);
  }

  function logout(message = "") {
    sessionRef.current = null;
    clearAdminSession(id);
    setSession(null);
    setPassword("");
    setDraft(defaultDraft());
    setBaseline(null);
    setRevision(0);
    setPublishedRevision(null);
    setUpdatedAt(null);
    setPublishedAt(null);
    setHistory([]);
    setBusy(null);
    setError(message);
    setStatus("");
    setRestoreTarget(null);
  }

  async function loadContent(token: string, announcement = "") {
    setBusy("load");
    setError("");
    try {
      const result = await fetchAdminInvitationContent(token);
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      applyResult(result, announcement);
    } catch (loadError) {
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      if (loadError instanceof WeddingApiError && loadError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(errorMessage(loadError, "편집 데이터를 불러오지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    const restored = loadAdminSession(id);
    if (restored) {
      sessionRef.current = restored;
      setSession(restored);
      void loadContent(restored.token);
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

  useEffect(() => {
    if (!dirty || !session) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, session]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy("load");
    setError("");
    try {
      const nextSession = await createAdminSession(password);
      if (!mountedRef.current) return;
      sessionRef.current = nextSession;
      setSession(nextSession);
      saveAdminSession(id, nextSession);
      setPassword("");
      await loadContent(nextSession.token);
    } catch (loginError) {
      if (!mountedRef.current) return;
      setPassword("");
      setError(errorMessage(loginError, "로그인하지 못했습니다. 비밀번호를 확인해 주세요."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function saveDraft() {
    const token = sessionRef.current?.token;
    if (!token || busy) return;
    const normalized = parseEditableInvitationContent(draft);
    if (!normalized) {
      setError("입력 형식이나 글자 수를 확인해 주세요. 송금 링크는 HTTPS 주소만 사용할 수 있습니다.");
      return;
    }
    setBusy("save");
    setError("");
    setStatus("");
    try {
      const result = await saveAdminInvitationContent(token, normalized, revision);
      if (mountedRef.current) applyResult(result, `초안 ${result.revision}번을 저장했습니다.`);
    } catch (saveError) {
      if (saveError instanceof WeddingApiError && saveError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(errorMessage(saveError, "초안을 저장하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function publishDraft() {
    const token = sessionRef.current?.token;
    if (!token || busy || dirty || revision < 1 || publishIssues.length > 0) return;
    setBusy("publish");
    setError("");
    setStatus("");
    try {
      const result = await publishAdminInvitationContent(token, revision);
      if (mountedRef.current) applyResult(result, `공개본 ${result.publishedRevision}번을 반영했습니다.`);
    } catch (publishError) {
      if (publishError instanceof WeddingApiError && publishError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(errorMessage(publishError, "공개본을 반영하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function restoreVersion() {
    const token = sessionRef.current?.token;
    const target = restoreTarget;
    if (!token || !target || busy) return;
    setBusy("restore");
    setError("");
    try {
      const result = await restoreAdminInvitationContent(token, target.id, revision);
      if (!mountedRef.current) return;
      setRestoreTarget(null);
      applyResult(result, `${target.revision}번 버전을 새 초안으로 복구했습니다.`);
      setActiveTab("preview");
    } catch (restoreError) {
      if (restoreError instanceof WeddingApiError && restoreError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(errorMessage(restoreError, "이전 버전을 복구하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  function updateContact(id: WeddingFamilyContact["id"], field: "name" | "phone", value: string) {
    setDraft((current) => ({
      ...current,
      familyContacts: {
        ...current.familyContacts,
        contacts: current.familyContacts.contacts.map((contact) => (
          contact.id === id ? { ...contact, [field]: value } : contact
        ))
      }
    }));
  }

  function updateAccount(id: WeddingGiftAccount["id"], field: keyof WeddingGiftAccount, value: string) {
    setDraft((current) => ({
      ...current,
      giftAccounts: {
        ...current.giftAccounts,
        accounts: current.giftAccounts.accounts.map((account) => (
          account.id === id ? { ...account, [field]: value } : account
        ))
      }
    }));
  }

  if (!session) {
    return (
      <main className="rsvp-admin-page">
        <section className="rsvp-admin-login" aria-labelledby="content-admin-login-title">
          <FilePenLine aria-hidden="true" />
          <p className="rsvp-admin-eyebrow">PRIVATE ACCESS</p>
          <h1 id="content-admin-login-title">실데이터 편집</h1>
          <form onSubmit={handleLogin}>
            <label htmlFor="content-admin-password">관리자 비밀번호</label>
            <input id="content-admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy !== null} required />
            <button type="submit" disabled={busy !== null || !password}>{busy ? "로그인 중" : "로그인"}</button>
          </form>
          {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="rsvp-admin-page content-admin-page">
      <div className="rsvp-admin-shell" aria-hidden={restoreTarget ? true : undefined}>
        <header className="rsvp-admin-header content-admin-header">
          <div>
            <p className="rsvp-admin-eyebrow">MJ CONVENTION · 2027.05.01</p>
            <h1>실데이터 편집</h1>
          </div>
          <div className="guestbook-admin-header-actions">
            <a className="rsvp-admin-nav-link" href="?admin=readiness">공개 준비</a>
            <a className="rsvp-admin-nav-link" href="?admin=rsvp">참석 답변</a>
            <a className="rsvp-admin-nav-link" href="?admin=guestbook">방명록</a>
            <button type="button" className="rsvp-admin-secondary" onClick={() => logout()}><LogOut aria-hidden="true" /> 로그아웃</button>
          </div>
        </header>

        <section className="content-admin-status" aria-label="편집 상태">
          <div>
            <span className={`content-admin-status__badge${dirty ? " content-admin-status__badge--dirty" : ""}`}>
              {dirty ? <Clock3 aria-hidden="true" /> : <Check aria-hidden="true" />}
              {dirty ? "저장하지 않은 변경" : `초안 ${revision}번 저장됨`}
            </span>
            <strong>{publishedRevision ? `공개본 ${publishedRevision}번` : "공개본 없음 · 기존 정적 콘텐츠 사용 중"}</strong>
            <small>최근 저장 {formatDate(updatedAt)} · 최근 공개 {formatDate(publishedAt)}</small>
          </div>
          <div className="content-admin-status__actions">
            <button type="button" className="rsvp-admin-secondary" onClick={() => setActiveTab("preview")}><Eye aria-hidden="true" /> 미리보기</button>
            <button type="button" onClick={() => void saveDraft()} disabled={busy !== null || !dirty}><Save aria-hidden="true" /> {busy === "save" ? "저장 중" : "초안 저장"}</button>
            <button type="button" className="content-admin-publish" onClick={() => void publishDraft()} disabled={busy !== null || dirty || revision < 1 || publishIssues.length > 0}><Send aria-hidden="true" /> {busy === "publish" ? "반영 중" : "공개 반영"}</button>
          </div>
        </section>

        {publishIssues.length > 0 && (
          <p className="content-admin-blockers" role="status">
            공개 전 필수 입력: {publishIssues.map((issue) => issueLabels[issue] ?? issue).join(" · ")}
          </p>
        )}
        {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        {status && <p className="rsvp-admin-message" role="status">{status}</p>}

        <nav className="content-admin-tabs" aria-label="실데이터 편집 구분">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
          ))}
        </nav>

        <div className="content-admin-workspace">
          {busy === "load" ? (
            <div className="content-admin-loading" role="status"><LoaderCircle aria-hidden="true" /> 편집 데이터를 불러오고 있습니다.</div>
          ) : null}

          {activeTab === "contacts" && (
            <section className="content-admin-section" aria-labelledby="content-contacts-title">
              <header><Phone aria-hidden="true" /><div><h2 id="content-contacts-title">신랑·신부와 혼주 연락처</h2><p>성함과 전화번호가 모두 입력된 연락처만 공개됩니다.</p></div></header>
              <label className="content-admin-wide-field"><span>연락처 안내 문구</span><input value={draft.familyContacts.notice} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, familyContacts: { ...current.familyContacts, notice: event.target.value } }))} /></label>
              <div className="content-admin-person-grid">
                {draft.familyContacts.contacts.map((contact) => (
                  <fieldset key={contact.id}><legend>{contact.relation}</legend><label><span>성함</span><input value={contact.name} maxLength={30} onChange={(event) => updateContact(contact.id, "name", event.target.value)} /></label><label><span>전화번호</span><input type="tel" inputMode="tel" value={contact.phone} maxLength={24} onChange={(event) => updateContact(contact.id, "phone", event.target.value)} /></label></fieldset>
                ))}
              </div>
            </section>
          )}

          {activeTab === "accounts" && (
            <section className="content-admin-section" aria-labelledby="content-accounts-title">
              <header><Landmark aria-hidden="true" /><div><h2 id="content-accounts-title">계좌와 간편송금</h2><p>은행·계좌번호·예금주가 모두 입력된 계좌만 공개됩니다.</p></div></header>
              <label className="content-admin-wide-field"><span>계좌 안내 문구</span><input value={draft.giftAccounts.notice} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, giftAccounts: { ...current.giftAccounts, notice: event.target.value } }))} /></label>
              <div className="content-admin-account-list">
                {draft.giftAccounts.accounts.map((account) => (
                  <fieldset key={account.id}><legend>{account.relation}</legend><div className="content-admin-account-grid"><label><span>성함</span><input value={account.name} maxLength={30} onChange={(event) => updateAccount(account.id, "name", event.target.value)} /></label><label><span>은행</span><input value={account.bank} maxLength={24} onChange={(event) => updateAccount(account.id, "bank", event.target.value)} /></label><label><span>계좌번호</span><input inputMode="numeric" value={account.accountNumber} maxLength={48} onChange={(event) => updateAccount(account.id, "accountNumber", event.target.value)} /></label><label><span>예금주</span><input value={account.holder} maxLength={30} onChange={(event) => updateAccount(account.id, "holder", event.target.value)} /></label><label className="content-admin-account-grid__wide"><span>카카오페이 URL</span><input type="url" placeholder="https://" value={account.kakaoPayUrl} maxLength={500} onChange={(event) => updateAccount(account.id, "kakaoPayUrl", event.target.value)} /></label><label className="content-admin-account-grid__wide"><span>토스 URL</span><input type="url" placeholder="https://" value={account.tossUrl} maxLength={500} onChange={(event) => updateAccount(account.id, "tossUrl", event.target.value)} /></label></div></fieldset>
                ))}
              </div>
            </section>
          )}

          {activeTab === "story" && (
            <section className="content-admin-section" aria-labelledby="content-story-title">
              <header><MessageSquareText aria-hidden="true" /><div><h2 id="content-story-title">소개와 네 단계 스토리</h2><p>두 사람의 인사말과 초대장에 표시할 실제 이야기를 입력합니다.</p></div></header>
              <div className="content-admin-copy-grid"><label><span>신부 소개</span><textarea value={draft.coupleIntroduction.bride} maxLength={400} rows={5} onChange={(event) => setDraft((current) => ({ ...current, coupleIntroduction: { ...current.coupleIntroduction, bride: event.target.value } }))} /></label><label><span>신랑 소개</span><textarea value={draft.coupleIntroduction.groom} maxLength={400} rows={5} onChange={(event) => setDraft((current) => ({ ...current, coupleIntroduction: { ...current.coupleIntroduction, groom: event.target.value } }))} /></label><label className="content-admin-copy-grid__wide"><span>함께 전하는 한 문장</span><textarea value={draft.coupleIntroduction.together} maxLength={400} rows={3} onChange={(event) => setDraft((current) => ({ ...current, coupleIntroduction: { ...current.coupleIntroduction, together: event.target.value } }))} /></label></div>
              <div className="content-admin-story-list">
                {draft.storyTimeline.map((step, index) => (
                  <fieldset key={step.id}><legend>{String(index + 1).padStart(2, "0")}</legend><label><span>제목</span><input value={step.title} maxLength={50} onChange={(event) => setDraft((current) => ({ ...current, storyTimeline: current.storyTimeline.map((candidate) => candidate.id === step.id ? { ...candidate, title: event.target.value } : candidate) }))} /></label><label><span>본문</span><textarea value={step.body} maxLength={400} rows={4} onChange={(event) => setDraft((current) => ({ ...current, storyTimeline: current.storyTimeline.map((candidate) => candidate.id === step.id ? { ...candidate, body: event.target.value } : candidate) }))} /></label></fieldset>
                ))}
              </div>
            </section>
          )}

          {activeTab === "share" && (
            <section className="content-admin-section" aria-labelledby="content-share-title">
              <header><Link2 aria-hidden="true" /><div><h2 id="content-share-title">공유 문구</h2><p><code>{"{names}"}</code>는 방문자에게 정해진 신랑·신부 순서의 이름으로 바뀝니다.</p></div></header>
              <div className="content-admin-copy-grid"><label className="content-admin-copy-grid__wide"><span>공유 제목</span><input value={draft.share.title} maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, share: { ...current.share, title: event.target.value } }))} /></label><label className="content-admin-copy-grid__wide"><span>공유 설명</span><textarea value={draft.share.description} maxLength={240} rows={4} onChange={(event) => setDraft((current) => ({ ...current, share: { ...current.share, description: event.target.value } }))} /></label></div>
            </section>
          )}

          {activeTab === "preview" && (
            <section className="content-admin-section content-admin-preview" aria-labelledby="content-preview-title">
              <header><Eye aria-hidden="true" /><div><h2 id="content-preview-title">초안 미리보기</h2><p>저장 전 변경도 이 화면에 즉시 반영됩니다.</p></div></header>
              <div className="content-admin-preview__phone"><div className="content-admin-preview__intro"><span>WEDDING INVITATION</span><h3>{invitationContent.event.couple.bride} &amp; {invitationContent.event.couple.groom}</h3><p>{draft.coupleIntroduction.together || "함께 전하는 문장을 입력해 주세요."}</p></div><CoupleProfilePanel content={previewContent} /><WeddingStoryTimeline timeline={previewContent.storyTimeline} /><section><h3>혼주 연락처</h3><FamilyContactContent familyContacts={previewEvent.familyContacts} /></section><section><h3>마음 전하실 곳</h3><GiftAccountContent giftAccounts={previewEvent.giftAccounts} /></section><div className="content-admin-preview__share"><span>공유 제목</span><strong>{previewShareTitle || "공유 제목을 입력해 주세요."}</strong><p>{previewShareDescription || "공유 설명을 입력해 주세요."}</p></div></div>
            </section>
          )}

          {activeTab === "history" && (
            <section className="content-admin-section" aria-labelledby="content-history-title">
              <header><History aria-hidden="true" /><div><h2 id="content-history-title">변경 이력</h2><p>최근 20개 버전을 보관하며, 선택한 버전은 새 초안으로 복구됩니다.</p></div></header>
              {history.length === 0 ? <p className="content-admin-empty">아직 저장된 변경 이력이 없습니다.</p> : <ol className="content-admin-history">{history.map((version) => <li key={version.id}><div><strong>{versionActionLabel(version.action)} · {version.revision}번</strong><time dateTime={version.createdAt}>{formatDate(version.createdAt)}</time></div><button type="button" className="rsvp-admin-secondary" onClick={() => setRestoreTarget(version)} disabled={busy !== null}><RotateCcw aria-hidden="true" /> 이 버전 복구</button></li>)}</ol>}
            </section>
          )}
        </div>
      </div>

      {restoreTarget && (
        <div className="rsvp-admin-dialog-backdrop">
          <section className="rsvp-admin-dialog content-admin-restore-dialog" role="dialog" aria-modal="true" aria-labelledby="content-restore-title">
            <div><div><p className="rsvp-admin-eyebrow">RESTORE DRAFT</p><h2 id="content-restore-title">{restoreTarget.revision}번 버전을 복구할까요?</h2></div><button type="button" className="rsvp-admin-secondary" aria-label="복구 취소" onClick={() => setRestoreTarget(null)} disabled={busy === "restore"}><X aria-hidden="true" /></button></div>
            <p>현재 초안은 변경 이력에 남아 있으며, 선택한 내용이 새 초안으로 저장됩니다. 공개본은 바뀌지 않습니다.</p>
            <div className="rsvp-admin-dialog-actions"><button type="button" className="rsvp-admin-secondary" onClick={() => setRestoreTarget(null)} disabled={busy === "restore"}>취소</button><button type="button" onClick={() => void restoreVersion()} disabled={busy === "restore"}><RotateCcw aria-hidden="true" /> {busy === "restore" ? "복구 중" : "초안으로 복구"}</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

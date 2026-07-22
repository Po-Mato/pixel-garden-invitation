import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  ExternalLink,
  FileCheck2,
  Image,
  Landmark,
  Link2,
  LoaderCircle,
  LogOut,
  MapPin,
  MessageSquareText,
  Phone,
  Save,
  ShieldCheck,
  TriangleAlert,
  UsersRound
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildDefaultEditableInvitationContent,
  buildDefaultEditableInvitationGallery,
  invitationContent,
  parseEditableInvitationContent,
  type EditableInvitationContent,
  type EditableInvitationGallery,
  type InvitationContentAdminResult,
  type InvitationGalleryAdminResult,
  type WeddingFamilyContact,
  type WeddingGiftAccount
} from "@wedding-game/shared";
import {
  fetchAdminInvitationContent,
  saveAdminInvitationContent
} from "../api/invitationContentApi";
import { fetchAdminInvitationGallery } from "../api/invitationGalleryApi";
import { createAdminSession, WeddingApiError, type AdminSession } from "../api/weddingApi";
import { formatEventDate, formatEventStartTime } from "../invitation/calendarEvent";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import { resolveInvitationShareText } from "../invitation/shareInvitation";
import {
  buildSetupWizardProgress,
  setupWizardBlockers,
  type SetupWizardStepId
} from "../invitation/setupWizard";
import "../setup-wizard-admin.css";

type BusyAction = "load" | "save" | null;

const stepIds: SetupWizardStepId[] = [
  "event",
  "contacts",
  "accounts",
  "introduction",
  "story",
  "share",
  "gallery",
  "review"
];

const stepHeadings: Record<SetupWizardStepId, { eyebrow: string; title: string }> = {
  event: { eyebrow: "STEP 1", title: "예식 정보 확인" },
  contacts: { eyebrow: "STEP 2", title: "연락처 입력" },
  accounts: { eyebrow: "STEP 3", title: "계좌와 간편송금" },
  introduction: { eyebrow: "STEP 4", title: "두 사람 소개" },
  story: { eyebrow: "STEP 5", title: "함께한 이야기" },
  share: { eyebrow: "STEP 6", title: "공유 문구" },
  gallery: { eyebrow: "STEP 7", title: "웨딩 사진 확인" },
  review: { eyebrow: "FINAL", title: "저장 전 최종 검토" }
};

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function defaultContent(): EditableInvitationContent {
  return structuredClone(buildDefaultEditableInvitationContent(
    invitationContent.event,
    invitationContent.content
  ));
}

function defaultGallery(): EditableInvitationGallery {
  return structuredClone(buildDefaultEditableInvitationGallery(invitationContent.content));
}

function initialStepId(): SetupWizardStepId {
  const candidate = new URLSearchParams(window.location.search).get("step") as SetupWizardStepId | null;
  return candidate && stepIds.includes(candidate) ? candidate : "event";
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof WeddingApiError)) return fallback;
  if (error.status === 401) return "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (error.status === 409 && error.code === "conflict") {
    return "다른 변경이 먼저 저장되었습니다. 새로고침 후 다시 입력해 주세요.";
  }
  if (error.status === 413) return "입력 내용이 너무 큽니다. 문구 길이를 줄여 주세요.";
  return fallback;
}

function relationName(value: { relation: string; name: string }): string {
  return value.name ? `${value.relation} ${value.name}` : value.relation;
}

export function SetupWizardAdminPage() {
  const id = invitationId();
  const mountedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState<EditableInvitationContent>(defaultContent);
  const [gallery, setGallery] = useState<EditableInvitationGallery>(defaultGallery);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [publishedRevision, setPublishedRevision] = useState<number | null>(null);
  const [galleryRevision, setGalleryRevision] = useState(0);
  const [galleryPublishedRevision, setGalleryPublishedRevision] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState<SetupWizardStepId>(initialStepId);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const serializedDraft = useMemo(() => JSON.stringify(draft), [draft]);
  const dirty = baseline === null || baseline !== serializedDraft;
  const progress = useMemo(() => buildSetupWizardProgress(draft, gallery), [draft, gallery]);
  const blockers = useMemo(() => setupWizardBlockers(draft, gallery), [draft, gallery]);
  const activeIndex = stepIds.indexOf(activeStep);
  const activeProgress = progress[activeIndex];
  const galleryProgress = progress.find(({ id: stepId }) => stepId === "gallery")!;
  const completedSteps = progress.filter(({ complete }) => complete).length;
  const contentReady = progress.slice(0, 6).every(({ complete }) => complete);
  const galleryReady = progress.find(({ id: stepId }) => stepId === "gallery")?.complete ?? false;
  const shareTitle = resolveInvitationShareText(draft.share.title, {
    ...invitationContent.event,
    familyContacts: draft.familyContacts,
    giftAccounts: draft.giftAccounts
  });
  const shareDescription = resolveInvitationShareText(draft.share.description, invitationContent.event);

  function applyContentResult(result: InvitationContentAdminResult, announcement = "") {
    const nextDraft = structuredClone(result.draft ?? defaultContent());
    setDraft(nextDraft);
    setBaseline(result.draft ? JSON.stringify(nextDraft) : null);
    setRevision(result.revision);
    setPublishedRevision(result.publishedRevision);
    setStatus(announcement);
  }

  function applyGalleryResult(result: InvitationGalleryAdminResult) {
    setGallery(structuredClone(result.draft ?? defaultGallery()));
    setGalleryRevision(result.revision);
    setGalleryPublishedRevision(result.publishedRevision);
  }

  function logout(message = "") {
    sessionRef.current = null;
    clearAdminSession(id);
    setSession(null);
    setPassword("");
    setDraft(defaultContent());
    setGallery(defaultGallery());
    setBaseline(null);
    setRevision(0);
    setPublishedRevision(null);
    setGalleryRevision(0);
    setGalleryPublishedRevision(null);
    setBusy(null);
    setError(message);
    setStatus("");
  }

  async function loadWizard(token: string) {
    setBusy("load");
    setError("");
    try {
      const [contentResult, galleryResult] = await Promise.all([
        fetchAdminInvitationContent(token),
        fetchAdminInvitationGallery(token)
      ]);
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      applyContentResult(contentResult);
      applyGalleryResult(galleryResult);
    } catch (loadError) {
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      if (loadError instanceof WeddingApiError && loadError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(errorMessage(loadError, "실데이터와 사진 상태를 불러오지 못했습니다."));
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
      void loadWizard(restored.token);
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
    const timer = window.setTimeout(
      () => logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요."),
      remaining
    );
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
      await loadWizard(nextSession.token);
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
    if (!token || busy || !dirty) return;
    const normalized = parseEditableInvitationContent(draft);
    if (!normalized) {
      setError("입력 형식과 글자 수를 확인해 주세요. 간편송금은 HTTPS 주소만 사용할 수 있습니다.");
      return;
    }
    setBusy("save");
    setError("");
    setStatus("");
    try {
      const result = await saveAdminInvitationContent(token, normalized, revision);
      if (mountedRef.current) applyContentResult(result, `실데이터 초안 ${result.revision}번을 저장했습니다.`);
    } catch (saveError) {
      if (saveError instanceof WeddingApiError && saveError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(errorMessage(saveError, "실데이터 초안을 저장하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  function selectStep(stepId: SetupWizardStepId) {
    setActiveStep(stepId);
    const url = new URL(window.location.href);
    url.searchParams.set("step", stepId);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }

  function updateContact(contactId: WeddingFamilyContact["id"], field: "name" | "phone", value: string) {
    setDraft((current) => ({
      ...current,
      familyContacts: {
        ...current.familyContacts,
        contacts: current.familyContacts.contacts.map((contact) => (
          contact.id === contactId ? { ...contact, [field]: value } : contact
        ))
      }
    }));
  }

  function updateAccount(accountId: WeddingGiftAccount["id"], field: keyof WeddingGiftAccount, value: string) {
    setDraft((current) => ({
      ...current,
      giftAccounts: {
        ...current.giftAccounts,
        accounts: current.giftAccounts.accounts.map((account) => (
          account.id === accountId ? { ...account, [field]: value } : account
        ))
      }
    }));
  }

  if (!session) {
    return (
      <main className="rsvp-admin-page">
        <section className="rsvp-admin-login" aria-labelledby="setup-wizard-login-title">
          <FileCheck2 aria-hidden="true" />
          <p className="rsvp-admin-eyebrow">PRIVATE SETUP</p>
          <h1 id="setup-wizard-login-title">실데이터 일괄 입력</h1>
          <form onSubmit={handleLogin}>
            <label htmlFor="setup-wizard-password">관리자 비밀번호</label>
            <input id="setup-wizard-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy !== null} required />
            <button type="submit" disabled={busy !== null || !password}>{busy ? "로그인 중…" : "로그인"}</button>
          </form>
          {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  const heading = stepHeadings[activeStep];

  return (
    <main className="rsvp-admin-page setup-wizard-page">
      <div className="rsvp-admin-shell">
        <header className="rsvp-admin-header setup-wizard-header">
          <div>
            <p className="rsvp-admin-eyebrow">MJ CONVENTION · 2027.05.01</p>
            <h1>실데이터 일괄 입력</h1>
          </div>
          <div className="guestbook-admin-header-actions">
            <a className="rsvp-admin-nav-link" href="?admin=content">상세 편집</a>
            <a className="rsvp-admin-nav-link" href="?admin=gallery">사진 관리</a>
            <a className="rsvp-admin-nav-link" href="?admin=release">통합 공개</a>
            <a className="rsvp-admin-nav-link" href="?admin=readiness">공개 준비</a>
            <button type="button" className="rsvp-admin-secondary" onClick={() => logout()}><LogOut aria-hidden="true" /> 로그아웃</button>
          </div>
        </header>

        <section className="setup-wizard-overview" aria-labelledby="setup-wizard-progress-title">
          <div>
            <span>{dirty ? <TriangleAlert aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}{dirty ? "저장하지 않은 변경" : `초안 ${revision}번 저장됨`}</span>
            <h2 id="setup-wizard-progress-title">{completedSteps} / {progress.length}단계 완료</h2>
            <p>실데이터 초안과 사진 준비 상태를 한 화면에서 확인합니다.</p>
          </div>
          <progress max={progress.length} value={completedSteps} aria-label="실데이터 입력 완료도" />
          <button type="button" onClick={() => void saveDraft()} disabled={busy !== null || !dirty}>
            <Save aria-hidden="true" /> {busy === "save" ? "저장 중…" : "초안 저장"}
          </button>
        </section>

        {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        {status && <p className="rsvp-admin-message" role="status">{status}</p>}

        <div className="setup-wizard-layout">
          <nav className="setup-wizard-steps" aria-label="실데이터 입력 단계">
            <ol>
              {progress.map((step, index) => (
                <li key={step.id}>
                  <button
                    type="button"
                    aria-current={activeStep === step.id ? "step" : undefined}
                    onClick={() => selectStep(step.id)}
                  >
                    <span>{step.complete ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}</span>
                    <span><strong>{index + 1}. {step.label}</strong><small>{step.completed} / {step.total}</small></span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <section className="setup-wizard-workspace" aria-labelledby="setup-wizard-step-title">
            {busy === "load" ? (
              <div className="setup-wizard-loading" role="status"><LoaderCircle aria-hidden="true" /> 실데이터를 불러오고 있습니다…</div>
            ) : (
              <>
                <header className="setup-wizard-step-heading">
                  <div><span>{heading.eyebrow}</span><h2 id="setup-wizard-step-title" ref={headingRef} tabIndex={-1}>{heading.title}</h2></div>
                  <span className={activeProgress.complete ? "is-complete" : "is-incomplete"}>{activeProgress.complete ? "완료" : `${activeProgress.completed} / ${activeProgress.total}`}</span>
                </header>

                {activeStep === "event" && (
                  <div className="setup-wizard-event">
                    <dl>
                      <div><dt><UsersRound aria-hidden="true" /> 신랑·신부</dt><dd>{invitationContent.event.couple.bride} · {invitationContent.event.couple.groom}</dd></div>
                      <div><dt><CalendarDays aria-hidden="true" /> 예식 일정</dt><dd>{formatEventDate(invitationContent.event)} {formatEventStartTime(invitationContent.event)} · 90분</dd></div>
                      <div><dt><MapPin aria-hidden="true" /> 예식 장소</dt><dd>{invitationContent.event.venue.name} {invitationContent.event.venue.hall}<span>{invitationContent.event.venue.address}</span></dd></div>
                    </dl>
                    <p>기본 예식 정보는 공통 데이터에 반영되어 있습니다. 변경이 필요하면 공개 전 별도 수정이 필요합니다.</p>
                  </div>
                )}

                {activeStep === "contacts" && (
                  <div className="setup-wizard-fields">
                    <label className="setup-wizard-wide"><span>연락처 안내 문구</span><input name="contact_notice" value={draft.familyContacts.notice} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, familyContacts: { ...current.familyContacts, notice: event.target.value } }))} /></label>
                    <div className="setup-wizard-person-grid">
                      {draft.familyContacts.contacts.map((contact) => (
                        <fieldset key={contact.id}><legend>{contact.relation}</legend><label><span>성함</span><input name={`${contact.id}_name`} autoComplete="off" value={contact.name} maxLength={30} onChange={(event) => updateContact(contact.id, "name", event.target.value)} /></label><label><span>전화번호</span><input name={`${contact.id}_phone`} type="tel" inputMode="tel" autoComplete="off" value={contact.phone} maxLength={24} placeholder="예: 010-1234-5678…" onChange={(event) => updateContact(contact.id, "phone", event.target.value)} /></label></fieldset>
                      ))}
                    </div>
                  </div>
                )}

                {activeStep === "accounts" && (
                  <div className="setup-wizard-fields">
                    <label className="setup-wizard-wide"><span>계좌 안내 문구</span><input name="account_notice" value={draft.giftAccounts.notice} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, giftAccounts: { ...current.giftAccounts, notice: event.target.value } }))} /></label>
                    <div className="setup-wizard-account-list">
                      {draft.giftAccounts.accounts.map((account) => (
                        <fieldset key={account.id}><legend>{account.relation}</legend><div className="setup-wizard-account-grid"><label><span>성함</span><input name={`${account.id}_account_name`} autoComplete="off" value={account.name} maxLength={30} onChange={(event) => updateAccount(account.id, "name", event.target.value)} /></label><label><span>은행</span><input name={`${account.id}_bank`} autoComplete="off" value={account.bank} maxLength={24} onChange={(event) => updateAccount(account.id, "bank", event.target.value)} /></label><label><span>계좌번호</span><input name={`${account.id}_number`} inputMode="numeric" autoComplete="off" value={account.accountNumber} maxLength={48} onChange={(event) => updateAccount(account.id, "accountNumber", event.target.value)} /></label><label><span>예금주</span><input name={`${account.id}_holder`} autoComplete="off" value={account.holder} maxLength={30} onChange={(event) => updateAccount(account.id, "holder", event.target.value)} /></label><label className="setup-wizard-account-grid__wide"><span>카카오페이 링크</span><input name={`${account.id}_kakao`} type="url" inputMode="url" autoComplete="off" value={account.kakaoPayUrl} maxLength={500} placeholder="https://…" onChange={(event) => updateAccount(account.id, "kakaoPayUrl", event.target.value)} /></label><label className="setup-wizard-account-grid__wide"><span>토스 링크</span><input name={`${account.id}_toss`} type="url" inputMode="url" autoComplete="off" value={account.tossUrl} maxLength={500} placeholder="https://…" onChange={(event) => updateAccount(account.id, "tossUrl", event.target.value)} /></label></div></fieldset>
                      ))}
                    </div>
                  </div>
                )}

                {activeStep === "introduction" && (
                  <div className="setup-wizard-fields setup-wizard-copy-grid">
                    <label><span>신부 소개</span><textarea name="bride_introduction" value={draft.coupleIntroduction.bride} maxLength={400} rows={5} onChange={(event) => setDraft((current) => ({ ...current, coupleIntroduction: { ...current.coupleIntroduction, bride: event.target.value } }))} /></label>
                    <label><span>신랑 소개</span><textarea name="groom_introduction" value={draft.coupleIntroduction.groom} maxLength={400} rows={5} onChange={(event) => setDraft((current) => ({ ...current, coupleIntroduction: { ...current.coupleIntroduction, groom: event.target.value } }))} /></label>
                    <label className="setup-wizard-wide"><span>함께하는 한 문장</span><textarea name="couple_message" value={draft.coupleIntroduction.together} maxLength={400} rows={4} onChange={(event) => setDraft((current) => ({ ...current, coupleIntroduction: { ...current.coupleIntroduction, together: event.target.value } }))} /></label>
                  </div>
                )}

                {activeStep === "story" && (
                  <div className="setup-wizard-story-list">
                    {draft.storyTimeline.map((story, index) => (
                      <fieldset key={story.id}><legend>{index + 1}단계</legend><label><span>제목</span><input name={`${story.id}_title`} value={story.title} maxLength={50} onChange={(event) => setDraft((current) => ({ ...current, storyTimeline: current.storyTimeline.map((item) => item.id === story.id ? { ...item, title: event.target.value } : item) }))} /></label><label><span>내용</span><textarea name={`${story.id}_body`} value={story.body} maxLength={400} rows={5} onChange={(event) => setDraft((current) => ({ ...current, storyTimeline: current.storyTimeline.map((item) => item.id === story.id ? { ...item, body: event.target.value } : item) }))} /></label></fieldset>
                    ))}
                  </div>
                )}

                {activeStep === "share" && (
                  <div className="setup-wizard-fields setup-wizard-share">
                    <label><span>링크 미리보기 제목</span><input name="share_title" value={draft.share.title} maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, share: { ...current.share, title: event.target.value } }))} /></label>
                    <label><span>링크 미리보기 설명</span><textarea name="share_description" value={draft.share.description} maxLength={240} rows={4} onChange={(event) => setDraft((current) => ({ ...current, share: { ...current.share, description: event.target.value } }))} /></label>
                    <div className="setup-wizard-share-preview" aria-label="링크 미리보기 문구"><Link2 aria-hidden="true" /><div><strong>{shareTitle || "제목을 입력해 주세요."}</strong><p>{shareDescription || "설명을 입력해 주세요."}</p><span>po-mato.github.io</span></div></div>
                  </div>
                )}

                {activeStep === "gallery" && (
                  <div className="setup-wizard-gallery">
                    <div className="setup-wizard-gallery__summary"><Image aria-hidden="true" /><div><span>사진 준비 상태</span><strong>{activeProgress.completed} / {activeProgress.total}장 완료</strong><p>사진 파일과 대체 문구가 모두 준비된 슬롯만 완료로 계산합니다.</p></div><a href="?admin=gallery"><ExternalLink aria-hidden="true" /> 사진 관리 열기</a></div>
                    <ol>{gallery.photos.map((photo, index) => (
                      <li key={photo.id} className={photo.assetId && photo.alt ? "is-ready" : "is-missing"}><span>{index + 1}</span><div><strong>{photo.caption || `웨딩 사진 ${index + 1}`}</strong><small>{photo.assetId ? "이미지 등록됨" : "이미지 필요"} · {photo.alt ? "대체 문구 등록됨" : "대체 문구 필요"}</small></div>{photo.assetId && photo.alt ? <Check aria-label="완료" /> : <TriangleAlert aria-label="보완 필요" />}</li>
                    ))}</ol>
                  </div>
                )}

                {activeStep === "review" && (
                  <div className="setup-wizard-review">
                    <div className={`setup-wizard-review__result${blockers.length === 0 ? " is-ready" : " is-blocked"}`}><span>{blockers.length === 0 ? <ShieldCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}{blockers.length === 0 ? "공개 준비 완료" : "필수 데이터 보완 필요"}</span><h3>{blockers.length === 0 ? "문구와 사진을 통합 공개할 수 있습니다." : `${blockers.length}개 영역을 확인해 주세요.`}</h3>{blockers.length > 0 ? <p>{blockers.join(" · ")}</p> : <p>초안을 저장한 뒤 통합 공개 센터에서 최종 미리보기와 공개를 진행하세요.</p>}</div>
                    <div className="setup-wizard-review__grid">
                      <article className={contentReady ? "is-ready" : "is-blocked"}><MessageSquareText aria-hidden="true" /><div><span>실데이터</span><strong>{contentReady ? "필수 입력 완료" : "보완 필요"}</strong><small>초안 {revision}번 · 공개본 {publishedRevision ?? "없음"}</small></div></article>
                      <article className={galleryReady ? "is-ready" : "is-blocked"}><Image aria-hidden="true" /><div><span>웨딩 사진</span><strong>{galleryReady ? `${galleryProgress.total}장 준비 완료` : `${galleryProgress.completed}장 준비`}</strong><small>초안 {galleryRevision}번 · 공개본 {galleryPublishedRevision ?? "없음"}</small></div></article>
                    </div>
                    <div className="setup-wizard-review__actions"><button type="button" onClick={() => void saveDraft()} disabled={busy !== null || !dirty}><Save aria-hidden="true" /> {dirty ? "실데이터 초안 저장" : "초안 저장 완료"}</button><a href="?admin=gallery"><Image aria-hidden="true" /> 사진 관리</a>{blockers.length === 0 && !dirty ? <a className="setup-wizard-review__release" href="?admin=release"><ShieldCheck aria-hidden="true" /> 통합 공개로 이동</a> : <span aria-disabled="true"><TriangleAlert aria-hidden="true" /> 저장·보완 후 공개</span>}</div>
                  </div>
                )}

                <footer className="setup-wizard-navigation">
                  <button type="button" className="rsvp-admin-secondary" onClick={() => selectStep(stepIds[activeIndex - 1])} disabled={activeIndex === 0}><ArrowLeft aria-hidden="true" /> 이전</button>
                  <span>{activeIndex + 1} / {stepIds.length}</span>
                  {activeIndex < stepIds.length - 1 ? <button type="button" onClick={() => selectStep(stepIds[activeIndex + 1])}>다음 <ArrowRight aria-hidden="true" /></button> : <a href="?admin=readiness">공개 준비 점검 <ExternalLink aria-hidden="true" /></a>}
                </footer>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

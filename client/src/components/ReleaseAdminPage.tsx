import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  History,
  Image,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Rocket,
  Send,
  ShieldCheck,
  TriangleAlert,
  X
} from "lucide-react";
import {
  buildDefaultEditableInvitationContent,
  invitationContent,
  type EditableInvitationContent,
  type EditableInvitationGallery,
  type InvitationContentAdminResult,
  type InvitationGalleryAdminResult,
  type InvitationReleaseAdminResult,
  type InvitationReleaseVersion
} from "@wedding-game/shared";

import {
  cancelAdminInvitationReleaseSchedule,
  fetchAdminInvitationRelease,
  publishAdminInvitationRelease,
  restoreAdminInvitationRelease,
  scheduleAdminInvitationRelease
} from "../api/invitationReleaseApi";
import { fetchAdminInvitationContent } from "../api/invitationContentApi";
import {
  fetchAdminGalleryAsset,
  fetchAdminInvitationGallery,
  invitationGalleryMediaUrl
} from "../api/invitationGalleryApi";
import { createAdminSession, WeddingApiError, type AdminSession } from "../api/weddingApi";
import {
  InvitationContentPreviewProvider
} from "../invitation/PublishedInvitationContentContext";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import { QuickInvitation } from "./QuickInvitation";
import "../release-admin.css";

type BusyAction = "load" | "publish" | "schedule" | "cancel" | "restore" | "preview" | null;

const contentIssueLabels: Record<string, string> = {
  draft_missing: "저장된 실데이터 초안 없음",
  family_contacts: "연락처 6건",
  gift_accounts: "계좌 6건",
  couple_introduction: "신랑·신부 소개",
  story_timeline: "네 단계 스토리",
  share: "공유 문구"
};

const galleryIssueLabels: Record<string, string> = {
  draft_missing: "저장된 사진 초안 없음",
  images: "사진 10장",
  alt_text: "사진 대체 텍스트"
};

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function defaultEditable(): EditableInvitationContent {
  return structuredClone(buildDefaultEditableInvitationContent(
    invitationContent.event,
    invitationContent.content
  ));
}

function formatDate(value: string | null): string {
  if (!value) return "없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

function actionLabel(action: InvitationReleaseVersion["action"]): string {
  if (action === "scheduled") return "예약 공개";
  if (action === "restore") return "공개본 복원";
  return "즉시 공개";
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof WeddingApiError)) return fallback;
  if (error.status === 401) return "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (error.status === 409 && error.code === "conflict") return "초안이 변경되었습니다. 최신 상태를 다시 불러와 주세요.";
  if (error.code === "content_incomplete") return "실데이터 필수 항목을 모두 입력해 주세요.";
  if (error.code === "gallery_incomplete") return "사진 10장과 대체 텍스트를 모두 준비해 주세요.";
  if (error.code === "invalid_schedule") return "현재부터 1분 이후, 1년 이내의 공개 시간을 선택해 주세요.";
  return fallback;
}

export function ReleaseAdminPage() {
  const id = invitationId();
  const mountedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const previewObjectUrlsRef = useRef<string[]>([]);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [password, setPassword] = useState("");
  const [release, setRelease] = useState<InvitationReleaseAdminResult | null>(null);
  const [contentDraft, setContentDraft] = useState<EditableInvitationContent | null>(null);
  const [galleryDraft, setGalleryDraft] = useState<EditableInvitationGallery | null>(null);
  const [previewAssets, setPreviewAssets] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<InvitationReleaseVersion | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const ready = Boolean(release?.content.ready && release.gallery.ready);
  const changed = Boolean(release?.content.changed || release?.gallery.changed);
  const candidateLabel = release
    ? `문구 ${release.content.draftRevision}번 · 사진 ${release.gallery.draftRevision}번`
    : "초안 확인 중";
  const previewEditable = contentDraft ?? defaultEditable();
  const previewMediaUrl = useCallback((assetId: string, width: 640 | 1024) => (
    previewAssets[assetId] ?? invitationGalleryMediaUrl(assetId, width)
  ), [previewAssets]);
  const blockers = useMemo(() => {
    if (!release) return [];
    return [
      ...release.content.issues.map((issue) => contentIssueLabels[issue] ?? issue),
      ...release.gallery.issues.map((issue) => galleryIssueLabels[issue] ?? issue)
    ];
  }, [release]);

  function clearPreviewUrls() {
    for (const url of previewObjectUrlsRef.current) URL.revokeObjectURL(url);
    previewObjectUrlsRef.current = [];
    setPreviewAssets({});
  }

  function logout(message = "") {
    sessionRef.current = null;
    clearAdminSession(id);
    clearPreviewUrls();
    setSession(null);
    setPassword("");
    setRelease(null);
    setContentDraft(null);
    setGalleryDraft(null);
    setPreviewOpen(false);
    setBusy(null);
    setError(message);
    setStatus("");
  }

  function applyData(
    releaseResult: InvitationReleaseAdminResult,
    contentResult: InvitationContentAdminResult,
    galleryResult: InvitationGalleryAdminResult,
    announcement = ""
  ) {
    setRelease(releaseResult);
    setContentDraft(contentResult.draft);
    setGalleryDraft(galleryResult.draft);
    setStatus(announcement);
  }

  async function loadCenter(token: string, announcement = "") {
    setBusy("load");
    setError("");
    try {
      const [releaseResult, contentResult, galleryResult] = await Promise.all([
        fetchAdminInvitationRelease(token),
        fetchAdminInvitationContent(token),
        fetchAdminInvitationGallery(token)
      ]);
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      applyData(releaseResult, contentResult, galleryResult, announcement);
    } catch (loadError) {
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      if (loadError instanceof WeddingApiError && loadError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      setError(apiErrorMessage(loadError, "통합 공개 상태를 불러오지 못했습니다."));
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
      void loadCenter(restored.token);
    }
    return () => {
      mountedRef.current = false;
      for (const url of previewObjectUrlsRef.current) URL.revokeObjectURL(url);
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
      await loadCenter(nextSession.token);
    } catch (loginError) {
      if (!mountedRef.current) return;
      setPassword("");
      setError(apiErrorMessage(loginError, "로그인하지 못했습니다. 비밀번호를 확인해 주세요."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function openPreview() {
    const token = sessionRef.current?.token;
    if (!token || busy) return;
    setBusy("preview");
    setError("");
    clearPreviewUrls();
    try {
      const assets = galleryDraft?.photos.every((photo) => photo.assetId)
        ? await Promise.all(galleryDraft.photos.map(async (photo) => {
            const blob = await fetchAdminGalleryAsset(token, photo.assetId!, 640);
            return [photo.assetId!, URL.createObjectURL(blob)] as const;
          }))
        : [];
      if (!mountedRef.current) {
        for (const [, url] of assets) URL.revokeObjectURL(url);
        return;
      }
      previewObjectUrlsRef.current = assets.map(([, url]) => url);
      setPreviewAssets(Object.fromEntries(assets));
      setPreviewOpen(true);
    } catch (previewError) {
      clearPreviewUrls();
      setError(apiErrorMessage(previewError, "비공개 사진을 불러오지 못해 미리보기를 열 수 없습니다."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function publishNow() {
    const token = sessionRef.current?.token;
    if (!token || !release || !ready || busy) return;
    setBusy("publish");
    setError("");
    setStatus("");
    try {
      const result = await publishAdminInvitationRelease(
        token,
        release.content.draftRevision,
        release.gallery.draftRevision
      );
      if (!mountedRef.current) return;
      setRelease(result);
      setPublishConfirmOpen(false);
      setStatus(`통합 공개본 ${result.latestRelease?.releaseNumber ?? ""}번을 반영했습니다.`);
    } catch (publishError) {
      setError(apiErrorMessage(publishError, "통합 공개본을 반영하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function scheduleRelease() {
    const token = sessionRef.current?.token;
    if (!token || !release || !ready || busy || !scheduleAt) return;
    setBusy("schedule");
    setError("");
    setStatus("");
    try {
      const scheduledFor = new Date(scheduleAt);
      if (Number.isNaN(scheduledFor.getTime())) throw new Error("invalid schedule");
      const result = await scheduleAdminInvitationRelease(
        token,
        release.content.draftRevision,
        release.gallery.draftRevision,
        scheduledFor.toISOString()
      );
      if (!mountedRef.current) return;
      setRelease(result);
      setScheduleAt("");
      setStatus(`${formatDate(result.schedule?.scheduledFor ?? null)} 공개 예약을 저장했습니다.`);
    } catch (scheduleError) {
      setError(apiErrorMessage(scheduleError, "공개 예약을 저장하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function cancelSchedule() {
    const token = sessionRef.current?.token;
    if (!token || busy) return;
    setBusy("cancel");
    setError("");
    try {
      const result = await cancelAdminInvitationReleaseSchedule(token);
      if (!mountedRef.current) return;
      setRelease(result);
      setStatus("공개 예약을 취소했습니다.");
    } catch (cancelError) {
      setError(apiErrorMessage(cancelError, "공개 예약을 취소하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function restoreRelease() {
    const token = sessionRef.current?.token;
    const target = restoreTarget;
    if (!token || !target || busy) return;
    setBusy("restore");
    setError("");
    try {
      const result = await restoreAdminInvitationRelease(token, target.id);
      if (!mountedRef.current) return;
      setRelease(result);
      setRestoreTarget(null);
      setStatus(`${target.releaseNumber}번 공개본을 새 통합 공개본으로 복원했습니다.`);
    } catch (restoreError) {
      setError(apiErrorMessage(restoreError, "통합 공개본을 복원하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  if (!session) {
    return (
      <main className="rsvp-admin-page">
        <section className="rsvp-admin-login" aria-labelledby="release-admin-login-title">
          <Rocket aria-hidden="true" />
          <p className="rsvp-admin-eyebrow">PRIVATE RELEASE</p>
          <h1 id="release-admin-login-title">통합 공개 관리</h1>
          <form onSubmit={handleLogin}>
            <label htmlFor="release-admin-password">관리자 비밀번호</label>
            <input id="release-admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy !== null} required />
            <button type="submit" disabled={busy !== null || !password}>{busy ? "로그인 중" : "로그인"}</button>
          </form>
          {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="rsvp-admin-page release-admin-page">
      <div className="rsvp-admin-shell" aria-hidden={previewOpen || publishConfirmOpen || restoreTarget ? true : undefined}>
        <header className="rsvp-admin-header release-admin-header">
          <div>
            <p className="rsvp-admin-eyebrow">MJ CONVENTION · 2027.05.01</p>
            <h1>통합 공개 관리</h1>
          </div>
          <div className="guestbook-admin-header-actions">
            <a className="rsvp-admin-nav-link" href="?admin=setup">일괄 입력</a>
            <a className="rsvp-admin-nav-link" href="?admin=analytics">방문 통계</a>
            <a className="rsvp-admin-nav-link" href="?admin=content">실데이터</a>
            <a className="rsvp-admin-nav-link" href="?admin=gallery">사진 관리</a>
            <a className="rsvp-admin-nav-link" href="?admin=readiness">공개 준비</a>
            <a className="rsvp-admin-nav-link" href="?admin=rsvp">참석 답변</a>
            <a className="rsvp-admin-nav-link" href="?admin=guestbook">방명록</a>
            <button type="button" className="rsvp-admin-secondary" onClick={() => logout()}><LogOut aria-hidden="true" /> 로그아웃</button>
          </div>
        </header>

        {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        {status && <p className="rsvp-admin-message" role="status">{status}</p>}

        <section className={`release-overview release-overview--${ready ? "ready" : "blocked"}`} aria-labelledby="release-overview-title">
          <div className="release-overview__copy">
            <span>{ready ? <ShieldCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}{ready ? "공개 가능" : "필수 항목 확인"}</span>
            <h2 id="release-overview-title">{candidateLabel}</h2>
            <p>{release?.latestRelease ? `현재 통합 공개본 ${release.latestRelease.releaseNumber}번 · ${formatDate(release.latestRelease.createdAt)}` : "아직 통합 공개 이력이 없습니다."}</p>
          </div>
          <div className="release-overview__actions">
            <button type="button" className="rsvp-admin-secondary" onClick={() => void loadCenter(session.token)} disabled={busy !== null}><RefreshCw aria-hidden="true" /> 새로고침</button>
            <button type="button" className="rsvp-admin-secondary" onClick={() => void openPreview()} disabled={busy !== null}><Eye aria-hidden="true" /> {busy === "preview" ? "준비 중" : "최종 미리보기"}</button>
            <button type="button" onClick={() => setPublishConfirmOpen(true)} disabled={busy !== null || !ready}><Send aria-hidden="true" /> 지금 공개</button>
          </div>
        </section>

        {blockers.length > 0 && <p className="release-blockers" role="status">공개 전 필수 입력: {blockers.join(" · ")}</p>}

        <section className="release-candidate" aria-labelledby="release-candidate-title">
          <header className="release-section-heading"><div><p>RELEASE CANDIDATE</p><h2 id="release-candidate-title">공개 후보</h2></div><span>{changed ? "공개본과 다른 초안" : "현재 공개본과 동일"}</span></header>
          <div className="release-candidate__grid">
            <article className={release?.content.ready ? "is-ready" : "is-blocked"}>
              <FileText aria-hidden="true" />
              <div><span>실데이터</span><strong>초안 {release?.content.draftRevision ?? 0}번</strong><small>최근 저장 {formatDate(release?.content.updatedAt ?? null)}</small></div>
              <span>{release?.content.ready ? <CheckCircle2 aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}{release?.content.ready ? "완료" : "보완 필요"}</span>
            </article>
            <article className={release?.gallery.ready ? "is-ready" : "is-blocked"}>
              <Image aria-hidden="true" />
              <div><span>사진 갤러리</span><strong>초안 {release?.gallery.draftRevision ?? 0}번</strong><small>최근 저장 {formatDate(release?.gallery.updatedAt ?? null)}</small></div>
              <span>{release?.gallery.ready ? <CheckCircle2 aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}{release?.gallery.ready ? "완료" : "보완 필요"}</span>
            </article>
          </div>
        </section>

        <section className="release-schedule" aria-labelledby="release-schedule-title">
          <header className="release-section-heading"><div><p>SCHEDULE</p><h2 id="release-schedule-title">공개 예약</h2></div><CalendarClock aria-hidden="true" /></header>
          {release?.schedule ? (
            <div className="release-schedule__active">
              <div><span>예약 시간</span><strong>{formatDate(release.schedule.scheduledFor)}</strong><small>문구 {release.schedule.contentRevision}번 · 사진 {release.schedule.galleryRevision}번 스냅샷</small></div>
              <button type="button" className="rsvp-admin-secondary" onClick={() => void cancelSchedule()} disabled={busy !== null}><X aria-hidden="true" /> {busy === "cancel" ? "취소 중" : "예약 취소"}</button>
            </div>
          ) : (
            <div className="release-schedule__form">
              <label htmlFor="release-schedule-at"><span>공개 일시</span><input id="release-schedule-at" type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} disabled={busy !== null || !ready} /></label>
              <button type="button" onClick={() => void scheduleRelease()} disabled={busy !== null || !ready || !scheduleAt}><CalendarClock aria-hidden="true" /> {busy === "schedule" ? "예약 중" : "예약 저장"}</button>
            </div>
          )}
        </section>

        <section className="release-history" aria-labelledby="release-history-title">
          <header className="release-section-heading"><div><p>VERSIONS</p><h2 id="release-history-title">통합 공개 이력</h2></div><History aria-hidden="true" /></header>
          {!release || release.history.length === 0 ? <p className="release-empty">아직 통합 공개 이력이 없습니다.</p> : (
            <ol>{release.history.map((version, index) => (
              <li key={version.id}>
                <span className="release-history__number">{String(version.releaseNumber).padStart(2, "0")}</span>
                <div><strong>{actionLabel(version.action)}</strong><span>문구 {version.contentRevision}번 · 사진 {version.galleryRevision}번</span><time dateTime={version.createdAt}>{formatDate(version.createdAt)}</time></div>
                {index === 0 ? <span className="release-history__current">현재</span> : <button type="button" className="rsvp-admin-secondary" onClick={() => setRestoreTarget(version)} disabled={busy !== null}><ArchiveRestore aria-hidden="true" /> 복원</button>}
              </li>
            ))}</ol>
          )}
        </section>
      </div>

      {previewOpen && (
        <div className="release-preview" role="dialog" aria-modal="true" aria-labelledby="release-preview-title">
          <header><div><p className="rsvp-admin-eyebrow">MOBILE PREVIEW</p><h2 id="release-preview-title">{candidateLabel}</h2></div><button type="button" className="rsvp-admin-secondary" onClick={() => { setPreviewOpen(false); clearPreviewUrls(); }}><X aria-hidden="true" /> 닫기</button></header>
          <div className="release-preview__viewport" aria-hidden="true">
            <InvitationContentPreviewProvider editable={previewEditable} gallery={galleryDraft} galleryAssetUrl={previewMediaUrl}>
              <QuickInvitation onOpenGarden={() => undefined} />
            </InvitationContentPreviewProvider>
          </div>
        </div>
      )}

      {publishConfirmOpen && (
        <div className="rsvp-admin-dialog-backdrop">
          <section className="rsvp-admin-dialog release-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="release-publish-title">
            <div><div><p className="rsvp-admin-eyebrow">PUBLISH RELEASE</p><h2 id="release-publish-title">통합 공개본을 반영할까요?</h2></div><button type="button" className="rsvp-admin-secondary" aria-label="공개 취소" onClick={() => setPublishConfirmOpen(false)} disabled={busy === "publish"}><X aria-hidden="true" /></button></div>
            <p>{candidateLabel}이 같은 시각에 공개됩니다. 기존 공개본은 통합 공개 이력에서 복원할 수 있습니다.</p>
            <div className="rsvp-admin-dialog-actions"><button type="button" className="rsvp-admin-secondary" onClick={() => setPublishConfirmOpen(false)} disabled={busy === "publish"}>취소</button><button type="button" onClick={() => void publishNow()} disabled={busy === "publish"}><Rocket aria-hidden="true" /> {busy === "publish" ? "공개 중" : "통합 공개"}</button></div>
          </section>
        </div>
      )}

      {restoreTarget && (
        <div className="rsvp-admin-dialog-backdrop">
          <section className="rsvp-admin-dialog release-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="release-restore-title">
            <div><div><p className="rsvp-admin-eyebrow">RESTORE RELEASE</p><h2 id="release-restore-title">{restoreTarget.releaseNumber}번 공개본을 복원할까요?</h2></div><button type="button" className="rsvp-admin-secondary" aria-label="복원 취소" onClick={() => setRestoreTarget(null)} disabled={busy === "restore"}><X aria-hidden="true" /></button></div>
            <p>문구와 사진 공개본만 함께 복원되며 현재 초안은 유지됩니다. 진행 중인 공개 예약은 취소됩니다.</p>
            <div className="rsvp-admin-dialog-actions"><button type="button" className="rsvp-admin-secondary" onClick={() => setRestoreTarget(null)} disabled={busy === "restore"}>취소</button><button type="button" onClick={() => void restoreRelease()} disabled={busy === "restore"}><ArchiveRestore aria-hidden="true" /> {busy === "restore" ? "복원 중" : "공개본 복원"}</button></div>
          </section>
        </div>
      )}

      {busy === "load" && session && <div className="release-loading" role="status"><LoaderCircle aria-hidden="true" /> 통합 공개 상태 확인 중</div>}
    </main>
  );
}

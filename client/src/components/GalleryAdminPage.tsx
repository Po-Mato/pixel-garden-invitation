import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from "react";
import {
  Check,
  Clock3,
  Eye,
  History,
  ImageIcon,
  ImagePlus,
  LoaderCircle,
  LogOut,
  RotateCcw,
  Save,
  Send,
  X
} from "lucide-react";
import {
  buildDefaultEditableInvitationGallery,
  editableInvitationGalleryPublishIssues,
  invitationContent,
  parseEditableInvitationGallery,
  type EditableGalleryPhoto,
  type EditableInvitationGallery,
  type InvitationGalleryAdminResult,
  type InvitationGalleryVersion
} from "@wedding-game/shared";
import {
  fetchAdminGalleryAsset,
  fetchAdminInvitationGallery,
  publishAdminInvitationGallery,
  restoreAdminInvitationGallery,
  saveAdminInvitationGallery,
  uploadAdminGalleryAsset
} from "../api/invitationGalleryApi";
import { createAdminSession, WeddingApiError, type AdminSession } from "../api/weddingApi";
import {
  calculateGalleryCropRect,
  createGalleryDerivatives,
  loadGallerySourceImage,
  validateGallerySourceFile,
  type GalleryCropSettings,
  type GallerySourceImage
} from "../invitation/galleryImageProcessor";
import { resolveGalleryAssetPath } from "../invitation/galleryAssets";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import "../gallery-admin.css";

type GalleryTab = "photos" | "preview" | "history";
type BusyAction = "load" | "save" | "upload" | "publish" | "restore" | null;
type CropTarget = { index: number; source: GallerySourceImage };

const tabs: Array<{ id: GalleryTab; label: string }> = [
  { id: "photos", label: "사진 편집" },
  { id: "preview", label: "전체 미리보기" },
  { id: "history", label: "변경 이력" }
];

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function defaultDraft(): EditableInvitationGallery {
  return structuredClone(buildDefaultEditableInvitationGallery(invitationContent.content));
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

function versionActionLabel(action: InvitationGalleryVersion["action"]): string {
  if (action === "publish") return "공개 반영";
  if (action === "restore") return "이전 버전 복구";
  return "초안 저장";
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof WeddingApiError)) return fallback;
  if (error.status === 401) return "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (error.status === 409 && error.code === "conflict") return "다른 변경이 먼저 저장되었습니다. 다시 불러와 주세요.";
  if (error.code === "gallery_assets_missing") return "일부 사진 파일을 확인할 수 없습니다. 해당 사진을 다시 올려 주세요.";
  return fallback;
}

function AdminGalleryImage({
  token,
  photo,
  className = ""
}: {
  token: string;
  photo: EditableGalleryPhoto;
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const fallback = invitationContent.content.gallery.find((item) => item.id === photo.id);

  useEffect(() => {
    if (!photo.assetId) {
      setObjectUrl(null);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    let nextUrl: string | null = null;
    setObjectUrl(null);
    setFailed(false);
    void fetchAdminGalleryAsset(token, photo.assetId, 640, controller.signal)
      .then((blob) => {
        nextUrl = URL.createObjectURL(blob);
        setObjectUrl(nextUrl);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setFailed(true);
      });
    return () => {
      controller.abort();
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [photo.assetId, token]);

  if (!photo.assetId && fallback) {
    return <img className={className} src={resolveGalleryAssetPath(fallback.assetPath)} alt={photo.alt} />;
  }
  if (failed) {
    return <div className={`gallery-admin-image-fallback ${className}`} role="img" aria-label={photo.alt}>사진을 불러오지 못했습니다.</div>;
  }
  if (!objectUrl) {
    return <div className={`gallery-admin-image-loading ${className}`} role="status"><LoaderCircle aria-hidden="true" /> 사진 불러오는 중</div>;
  }
  return <img className={className} src={objectUrl} alt={photo.alt} />;
}

function GalleryCropDialog({
  target,
  photo,
  busy,
  onClose,
  onApply
}: {
  target: CropTarget;
  photo: EditableGalleryPhoto;
  busy: boolean;
  onClose: () => void;
  onApply: (settings: GalleryCropSettings) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<GalleryCropSettings>({ focusX: 0, focusY: 0, zoom: 1 });
  const aspect = photo.width / photo.height;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const displayWidth = 720;
    canvas.width = displayWidth;
    canvas.height = Math.round(displayWidth / aspect);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    const crop = calculateGalleryCropRect(target.source.width, target.source.height, aspect, settings);
    context.drawImage(
      target.source.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, [aspect, settings, target.source]);

  return (
    <div className="gallery-crop-backdrop" role="presentation">
      <section className="gallery-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="gallery-crop-title">
        <header>
          <div><span>사진 {target.index + 1}</span><h2 id="gallery-crop-title">초점과 자르기</h2></div>
          <button type="button" className="gallery-icon-button" aria-label="자르기 닫기" onClick={onClose} disabled={busy}><X aria-hidden="true" /></button>
        </header>
        <div className="gallery-crop-stage" style={{ aspectRatio: String(aspect) }}>
          <canvas ref={canvasRef} aria-label="사진 자르기 미리보기" />
          <span aria-hidden="true" />
        </div>
        <div className="gallery-crop-controls">
          <label><span>확대</span><input type="range" min="1" max="2.5" step="0.05" value={settings.zoom} onChange={(event) => setSettings((current) => ({ ...current, zoom: Number(event.target.value) }))} /></label>
          <label><span>좌우 초점</span><input type="range" min="-1" max="1" step="0.02" value={settings.focusX} onChange={(event) => setSettings((current) => ({ ...current, focusX: Number(event.target.value) }))} /></label>
          <label><span>상하 초점</span><input type="range" min="-1" max="1" step="0.02" value={settings.focusY} onChange={(event) => setSettings((current) => ({ ...current, focusY: Number(event.target.value) }))} /></label>
        </div>
        <footer>
          <button type="button" className="rsvp-admin-secondary" onClick={onClose} disabled={busy}>취소</button>
          <button type="button" onClick={() => onApply(settings)} disabled={busy}>{busy ? <LoaderCircle aria-hidden="true" /> : <Check aria-hidden="true" />} {busy ? "처리 중" : "이대로 적용"}</button>
        </footer>
      </section>
    </div>
  );
}

export function GalleryAdminPage() {
  const id = invitationId();
  const mountedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const fileInputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState<EditableInvitationGallery>(defaultDraft);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [publishedRevision, setPublishedRevision] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<InvitationGalleryVersion[]>([]);
  const [activeTab, setActiveTab] = useState<GalleryTab>("photos");
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<InvitationGalleryVersion | null>(null);

  const serializedDraft = useMemo(() => JSON.stringify(draft), [draft]);
  const dirty = baseline === null || serializedDraft !== baseline;
  const publishIssues = useMemo(() => editableInvitationGalleryPublishIssues(draft), [draft]);
  const missingImageCount = draft.photos.filter((photo) => !photo.assetId).length;
  const missingAltCount = draft.photos.filter((photo) => !photo.alt.trim()).length;

  function applyResult(result: InvitationGalleryAdminResult, announcement = "") {
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
    cropTarget?.source.dispose();
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
    setCropTarget(null);
    setRestoreTarget(null);
  }

  async function loadGallery(token: string) {
    setBusy("load");
    setError("");
    try {
      const result = await fetchAdminInvitationGallery(token);
      if (mountedRef.current && sessionRef.current?.token === token) applyResult(result);
    } catch (loadError) {
      if (!mountedRef.current || sessionRef.current?.token !== token) return;
      if (loadError instanceof WeddingApiError && loadError.status === 401) {
        logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      } else {
        setError(errorMessage(loadError, "사진 초안을 불러오지 못했습니다."));
      }
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
      void loadGallery(restored.token);
    }
    return () => {
      mountedRef.current = false;
    };
    // The invitation id is fixed for this administration page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!dirty || !session) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, session]);

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
    // logout is intentionally scoped to the current session state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.expiresAt, session?.token]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
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
      await loadGallery(nextSession.token);
    } catch (loginError) {
      if (mountedRef.current) setError(errorMessage(loginError, "로그인하지 못했습니다. 비밀번호를 확인해 주세요."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function saveDraft(nextDraft = draft, announcement = "") {
    const token = sessionRef.current?.token;
    if (!token || busy) return null;
    const normalized = parseEditableInvitationGallery(nextDraft, invitationContent.content.gallery);
    if (!normalized) {
      setError("사진 정보 형식을 확인해 주세요.");
      return null;
    }
    setBusy("save");
    setError("");
    setStatus("");
    try {
      const result = await saveAdminInvitationGallery(token, normalized, revision);
      if (mountedRef.current) applyResult(result, announcement || `사진 초안 ${result.revision}번을 저장했습니다.`);
      return result;
    } catch (saveError) {
      if (saveError instanceof WeddingApiError && saveError.status === 401) logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      else setError(errorMessage(saveError, "사진 초안을 저장하지 못했습니다."));
      return null;
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function selectPhoto(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validationError = validateGallerySourceFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      const source = await loadGallerySourceImage(file);
      setError("");
      setCropTarget({ index, source });
    } catch {
      setError("사진 파일을 읽지 못했습니다. 다른 사진을 선택해 주세요.");
    }
  }

  function closeCrop() {
    if (busy === "upload") return;
    cropTarget?.source.dispose();
    setCropTarget(null);
  }

  async function applyCrop(settings: GalleryCropSettings) {
    const token = sessionRef.current?.token;
    const target = cropTarget;
    if (!token || !target || busy) return;
    setBusy("upload");
    setError("");
    setStatus("");
    try {
      const currentPhoto = draft.photos[target.index];
      const aspect = currentPhoto.width / currentPhoto.height;
      const derivatives = await createGalleryDerivatives(target.source, aspect, settings);
      const assetId = crypto.randomUUID();
      await Promise.all(derivatives.map((item) => uploadAdminGalleryAsset(
        token,
        currentPhoto.id,
        assetId,
        item.width,
        item.blob
      )));
      const large = derivatives.find((item) => item.width === 1024)!;
      const nextDraft = {
        photos: draft.photos.map((photo, index) => index === target.index
          ? { ...photo, assetId, width: large.width, height: large.height }
          : photo)
      };
      const normalized = parseEditableInvitationGallery(nextDraft, invitationContent.content.gallery);
      if (!normalized) throw new Error("invalid_gallery");
      const result = await saveAdminInvitationGallery(token, normalized, revision);
      if (!mountedRef.current) return;
      target.source.dispose();
      setCropTarget(null);
      applyResult(result, `사진 ${target.index + 1}을 교체하고 초안 ${result.revision}번으로 저장했습니다.`);
    } catch (uploadError) {
      if (uploadError instanceof WeddingApiError && uploadError.status === 401) logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      else setError(errorMessage(uploadError, "사진을 처리하거나 업로드하지 못했습니다."));
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
      const result = await publishAdminInvitationGallery(token, revision);
      if (mountedRef.current) applyResult(result, `사진 공개본 ${result.publishedRevision}번을 반영했습니다.`);
    } catch (publishError) {
      if (publishError instanceof WeddingApiError && publishError.status === 401) logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      else setError(errorMessage(publishError, "사진 공개본을 반영하지 못했습니다."));
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
      const result = await restoreAdminInvitationGallery(token, target.id, revision);
      if (!mountedRef.current) return;
      setRestoreTarget(null);
      applyResult(result, `${target.revision}번 사진 버전을 새 초안으로 복구했습니다.`);
      setActiveTab("preview");
    } catch (restoreError) {
      if (restoreError instanceof WeddingApiError && restoreError.status === 401) logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      else setError(errorMessage(restoreError, "이전 사진 버전을 복구하지 못했습니다."));
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  if (!session) {
    return (
      <main className="rsvp-admin-page">
        <section className="rsvp-admin-login" aria-labelledby="gallery-admin-login-title">
          <ImageIcon aria-hidden="true" />
          <p className="rsvp-admin-eyebrow">PRIVATE GALLERY</p>
          <h1 id="gallery-admin-login-title">사진·갤러리 관리</h1>
          <form onSubmit={handleLogin}>
            <label htmlFor="gallery-admin-password">관리자 비밀번호</label>
            <input id="gallery-admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy !== null} required />
            <button type="submit" disabled={busy !== null || !password}>{busy ? "로그인 중" : "로그인"}</button>
          </form>
          {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="rsvp-admin-page gallery-admin-page">
      <div className="rsvp-admin-shell" aria-hidden={cropTarget || restoreTarget ? true : undefined}>
        <header className="rsvp-admin-header gallery-admin-header">
          <div><p className="rsvp-admin-eyebrow">MJ CONVENTION · 2027.05.01</p><h1>사진·갤러리 관리</h1></div>
          <div className="guestbook-admin-header-actions">
            <a className="rsvp-admin-nav-link" href="?admin=setup">일괄 입력</a>
            <a className="rsvp-admin-nav-link" href="?admin=analytics">방문 통계</a>
            <a className="rsvp-admin-nav-link" href="?admin=release">통합 공개</a>
            <a className="rsvp-admin-nav-link" href="?admin=content">실데이터</a>
            <a className="rsvp-admin-nav-link" href="?admin=readiness">공개 준비</a>
            <a className="rsvp-admin-nav-link" href="?admin=rsvp">참석 답변</a>
            <a className="rsvp-admin-nav-link" href="?admin=guestbook">방명록</a>
            <button type="button" className="rsvp-admin-secondary" onClick={() => logout()}><LogOut aria-hidden="true" /> 로그아웃</button>
          </div>
        </header>

        <section className="gallery-admin-status" aria-label="사진 편집 상태">
          <div>
            <span className={`gallery-admin-status__badge${dirty ? " gallery-admin-status__badge--dirty" : ""}`}>{dirty ? <Clock3 aria-hidden="true" /> : <Check aria-hidden="true" />}{dirty ? "저장하지 않은 변경" : `초안 ${revision}번 저장됨`}</span>
            <strong>{publishedRevision ? `사진 공개본 ${publishedRevision}번` : "공개 사진 없음 · 임시 사진 사용 중"}</strong>
            <small>최근 저장 {formatDate(updatedAt)} · 최근 공개 {formatDate(publishedAt)}</small>
          </div>
          <div className="gallery-admin-status__actions">
            <button type="button" className="rsvp-admin-secondary" onClick={() => setActiveTab("preview")}><Eye aria-hidden="true" /> 미리보기</button>
            <button type="button" onClick={() => void saveDraft()} disabled={busy !== null || !dirty}><Save aria-hidden="true" /> {busy === "save" ? "저장 중" : "초안 저장"}</button>
            <button type="button" className="gallery-admin-publish" onClick={() => void publishDraft()} disabled={busy !== null || dirty || revision < 1 || publishIssues.length > 0}><Send aria-hidden="true" /> {busy === "publish" ? "반영 중" : "공개 반영"}</button>
          </div>
        </section>

        {(missingImageCount > 0 || missingAltCount > 0) && <p className="gallery-admin-blockers" role="status">공개 전 필수 확인: 사진 {missingImageCount}장 교체{missingAltCount ? ` · 대체 텍스트 ${missingAltCount}건` : ""}</p>}
        {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        {status && <p className="rsvp-admin-message" role="status">{status}</p>}

        <nav className="gallery-admin-tabs" aria-label="사진 관리 구분">
          {tabs.map((tab) => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
        </nav>

        {busy === "load" ? <div className="gallery-admin-loading" role="status"><LoaderCircle aria-hidden="true" /> 사진 초안을 불러오고 있습니다.</div> : null}

        {activeTab === "photos" && (
          <section className="gallery-admin-photo-grid" aria-label="웨딩 사진 슬롯">
            {draft.photos.map((photo, index) => (
              <article className="gallery-admin-photo-item" key={photo.id}>
                <header><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{photo.layout === "hero" ? "대표 사진" : photo.layout === "wide" ? "가로 사진" : "세로 사진"}</strong><small>{photo.id}</small></div><em className={photo.assetId ? "is-ready" : ""}>{photo.assetId ? "교체됨" : "임시"}</em></header>
                <div className={`gallery-admin-photo-frame gallery-admin-photo-frame--${photo.orientation}`}><AdminGalleryImage token={session.token} photo={photo} /></div>
                <input ref={(element) => { fileInputsRef.current[index] = element; }} className="gallery-admin-file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label={`사진 ${index + 1} 파일 선택`} onChange={(event) => void selectPhoto(index, event)} />
                <button type="button" className="gallery-admin-replace" onClick={() => fileInputsRef.current[index]?.click()} disabled={busy !== null}><ImagePlus aria-hidden="true" /> 사진 선택·자르기</button>
                <label><span>대체 텍스트 <b>필수</b></span><textarea rows={3} maxLength={240} value={photo.alt} onChange={(event) => setDraft((current) => ({ photos: current.photos.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item) }))} /></label>
                <label><span>캡션 <small>선택</small></span><input maxLength={160} value={photo.caption} onChange={(event) => setDraft((current) => ({ photos: current.photos.map((item, itemIndex) => itemIndex === index ? { ...item, caption: event.target.value } : item) }))} /></label>
              </article>
            ))}
          </section>
        )}

        {activeTab === "preview" && (
          <section className="gallery-admin-preview" aria-labelledby="gallery-preview-title">
            <header><Eye aria-hidden="true" /><div><h2 id="gallery-preview-title">에디토리얼 갤러리 미리보기</h2><p>저장 전 문구 변경도 즉시 반영됩니다.</p></div></header>
            <div className="gallery-admin-preview-grid">
              {draft.photos.map((photo, index) => <figure key={photo.id} className={`gallery-admin-preview-item gallery-admin-preview-item--${photo.layout}`}><div style={{ aspectRatio: `${photo.width} / ${photo.height}` }}><AdminGalleryImage token={session.token} photo={photo} /></div>{photo.caption ? <figcaption>{photo.caption}</figcaption> : null}<span>{index + 1}</span></figure>)}
            </div>
          </section>
        )}

        {activeTab === "history" && (
          <section className="gallery-admin-history" aria-labelledby="gallery-history-title">
            <header><History aria-hidden="true" /><div><h2 id="gallery-history-title">변경 이력</h2><p>최근 20개 사진 버전에서 초안을 복구할 수 있습니다.</p></div></header>
            {history.length === 0 ? <p className="gallery-admin-empty">저장된 사진 버전이 없습니다.</p> : <ol>{history.map((version) => <li key={version.id}><div><strong>{versionActionLabel(version.action)} · {version.revision}번</strong><span>{formatDate(version.createdAt)}</span></div><button type="button" className="rsvp-admin-secondary" onClick={() => setRestoreTarget(version)}><RotateCcw aria-hidden="true" /> 이 버전 복구</button></li>)}</ol>}
          </section>
        )}
      </div>

      {cropTarget ? <GalleryCropDialog target={cropTarget} photo={draft.photos[cropTarget.index]} busy={busy === "upload"} onClose={closeCrop} onApply={(settings) => void applyCrop(settings)} /> : null}
      {restoreTarget ? <div className="gallery-crop-backdrop" role="presentation"><section className="gallery-restore-dialog" role="alertdialog" aria-modal="true" aria-labelledby="gallery-restore-title"><header><div><span>VERSION {restoreTarget.revision}</span><h2 id="gallery-restore-title">사진 초안으로 복구할까요?</h2></div><button type="button" className="gallery-icon-button" aria-label="복구 취소" onClick={() => setRestoreTarget(null)}><X aria-hidden="true" /></button></header><p>현재 공개 사진은 유지되고, 선택한 버전이 새 초안으로 저장됩니다.</p><footer><button type="button" className="rsvp-admin-secondary" onClick={() => setRestoreTarget(null)}>취소</button><button type="button" onClick={() => void restoreVersion()} disabled={busy !== null}><RotateCcw aria-hidden="true" /> 초안으로 복구</button></footer></section></div> : null}
    </main>
  );
}

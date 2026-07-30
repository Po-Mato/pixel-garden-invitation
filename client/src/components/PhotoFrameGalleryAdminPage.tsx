import { useEffect, useRef, useState } from "react";
import { Check, Clock3, ImagePlus, LoaderCircle, LogOut, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import type { PhotoFrameGalleryAdminResult, PhotoFrameGalleryItem, PhotoFrameGalleryStatus } from "@wedding-game/shared";
import {
  fetchAdminPhotoFrameGallery,
  moderateAdminPhotoFrameGallery
} from "../api/photoFrameGalleryApi";
import { createAdminSession, WeddingApiError, type AdminSession } from "../api/weddingApi";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import "../photo-frame-gallery-admin.css";

function invitationId() {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

const statusLabels: Record<PhotoFrameGalleryStatus, string> = {
  pending: "승인 대기",
  approved: "공개 중",
  rejected: "반려"
};

export function PhotoFrameGalleryAdminPage() {
  const id = invitationId();
  const mountedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<PhotoFrameGalleryAdminResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const logout = (message = "") => {
    sessionRef.current = null;
    clearAdminSession(id);
    setSession(null);
    setResult(null);
    setPassword("");
    setError(message);
  };

  const load = async (token: string) => {
    setBusyId("load");
    setError("");
    try {
      const next = await fetchAdminPhotoFrameGallery(token);
      if (mountedRef.current && sessionRef.current?.token === token) setResult(next);
    } catch (loadError) {
      if (loadError instanceof WeddingApiError && loadError.status === 401) logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      else if (mountedRef.current) setError("공동 프레임 승인 목록을 불러오지 못했습니다.");
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const restored = loadAdminSession(id);
    if (restored) {
      sessionRef.current = restored;
      setSession(restored);
      void load(restored.token);
    }
    return () => { mountedRef.current = false; };
  }, []);

  const login = async () => {
    if (!password || busyId) return;
    setBusyId("login");
    setError("");
    try {
      const next = await createAdminSession(password);
      sessionRef.current = next;
      saveAdminSession(id, next);
      setSession(next);
      setPassword("");
      await load(next.token);
    } catch {
      if (mountedRef.current) setError("로그인하지 못했습니다. 비밀번호를 확인해 주세요.");
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  };

  const moderate = async (item: PhotoFrameGalleryItem, nextStatus: "approved" | "rejected") => {
    if (!session || busyId) return;
    setBusyId(item.id);
    setError("");
    try {
      const updated = await moderateAdminPhotoFrameGallery(session.token, item.id, nextStatus);
      setResult((current) => current ? {
        ...current,
        generatedAt: new Date().toISOString(),
        items: current.items.map((candidate) => candidate.id === updated.id ? updated : candidate),
        counts: {
          pending: current.items.filter((candidate) => (candidate.id === updated.id ? updated.status : candidate.status) === "pending").length,
          approved: current.items.filter((candidate) => (candidate.id === updated.id ? updated.status : candidate.status) === "approved").length,
          rejected: current.items.filter((candidate) => (candidate.id === updated.id ? updated.status : candidate.status) === "rejected").length
        }
      } : current);
      setStatus(nextStatus === "approved" ? `${item.design.label}을 공동 갤러리에 공개했습니다.` : `${item.design.label}을 반려했습니다.`);
    } catch (moderationError) {
      if (moderationError instanceof WeddingApiError && moderationError.status === 401) logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      else setError("승인 상태를 변경하지 못했습니다.");
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  };

  if (!session) {
    return (
      <main className="photo-frame-gallery-admin photo-frame-gallery-admin--login">
        <section className="rsvp-admin-login" aria-labelledby="photo-frame-admin-login-title">
          <ImagePlus aria-hidden="true" />
          <p>COMMUNITY FRAME CURATION</p>
          <h1 id="photo-frame-admin-login-title">공동 포토프레임 승인</h1>
          <form onSubmit={(event) => { event.preventDefault(); void login(); }}>
            <label><span>관리자 비밀번호</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
            <button type="submit" disabled={!password || Boolean(busyId)}>{busyId ? <LoaderCircle aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}로그인</button>
          </form>
          {error ? <p role="alert">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="photo-frame-gallery-admin">
      <header className="photo-frame-gallery-admin__header">
        <div><p>COMMUNITY FRAME CURATION</p><h1>공동 포토프레임 승인</h1><span>하객의 구도를 확인한 뒤 공개 여부를 결정합니다.</span></div>
        <div><a href="?admin=gallery">사진 관리</a><button type="button" aria-label="승인 목록 새로고침" disabled={Boolean(busyId)} onClick={() => void load(session.token)}><RefreshCw aria-hidden="true" /></button><button type="button" onClick={() => logout()}><LogOut aria-hidden="true" />로그아웃</button></div>
      </header>
      {result ? (
        <section className="photo-frame-gallery-admin__summary" aria-label="공동 프레임 승인 현황">
          <span data-status="pending"><Clock3 aria-hidden="true" /><strong>{result.counts.pending}</strong><small>승인 대기</small></span>
          <span data-status="approved"><Check aria-hidden="true" /><strong>{result.counts.approved}</strong><small>공개 중</small></span>
          <span data-status="rejected"><X aria-hidden="true" /><strong>{result.counts.rejected}</strong><small>반려</small></span>
        </section>
      ) : null}
      {error ? <p className="photo-frame-gallery-admin__notice" role="alert">{error}</p> : null}
      {status ? <p className="photo-frame-gallery-admin__notice" role="status">{status}</p> : null}
      {busyId === "load" && !result ? <p className="photo-frame-gallery-admin__loading"><LoaderCircle aria-hidden="true" />승인 목록을 불러오고 있습니다.</p> : null}
      {result && result.items.length > 0 ? (
        <section className="photo-frame-gallery-admin__grid" aria-label="하객 포토프레임 제출 목록">
          {result.items.map((item) => (
            <article key={item.id} data-status={item.status} data-tone={item.design.stickerStyle.tone}>
              <div className="photo-frame-gallery-admin__preview" aria-label={`${item.design.label} 구도 미리보기`}>
                <span style={{ transform: `translate(${item.design.photoTransform.offsetX * 12}px, ${item.design.photoTransform.offsetY * 12}px) rotate(${item.design.photoTransform.rotation}deg) scale(${item.design.photoTransform.zoom})` }} />
                <em style={{ left: `${item.design.stickerTransform.x * 100}%`, top: `${item.design.stickerTransform.y * 100}%`, transform: `translate(-50%, -50%) rotate(${item.design.stickerTransform.rotation}deg) scale(${item.design.stickerTransform.scale})` }}>{item.design.stickerText || "WEDDING DAY"}</em>
              </div>
              <header><span data-status={item.status}>{statusLabels[item.status]}</span><small>{new Date(item.createdAt).toLocaleString("ko-KR")}</small></header>
              <div className="photo-frame-gallery-admin__copy"><strong>{item.design.label}</strong><span>제안 · {item.contributorName}</span><small>사진 {Math.round(item.design.photoTransform.zoom * 100)}% · 문구 {item.design.stickerStyle.tone}/{item.design.stickerStyle.font}</small></div>
              <footer>
                <button type="button" disabled={busyId === item.id || item.status === "rejected"} onClick={() => void moderate(item, "rejected")}><X aria-hidden="true" />반려</button>
                <button type="button" disabled={busyId === item.id || item.status === "approved"} onClick={() => void moderate(item, "approved")}>{busyId === item.id ? <LoaderCircle aria-hidden="true" /> : <Sparkles aria-hidden="true" />}{item.status === "approved" ? "공개 중" : "승인 후 공개"}</button>
              </footer>
            </article>
          ))}
        </section>
      ) : result ? <p className="photo-frame-gallery-admin__empty">아직 제출된 공동 프레임이 없습니다.</p> : null}
    </main>
  );
}

import {
  Check,
  ClipboardCopy,
  Download,
  Eye,
  Link2,
  LoaderCircle,
  LogOut,
  MessageSquareCheck,
  Pencil,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  InvitationInviteLinkAdminResult,
  InvitationInviteLinkInput,
  InvitationInviteLinkRecord,
  InvitationInviteLinkSide,
  InvitationInviteLinkUpdate
} from "@wedding-game/shared";
import {
  createAdminInvitationInviteLinks,
  deleteAdminInvitationInviteLink,
  fetchAdminInvitationInviteLinks,
  rotateAdminInvitationInviteLink,
  updateAdminInvitationInviteLink
} from "../api/invitationInviteLinksApi";
import { createAdminSession, WeddingApiError, type AdminSession } from "../api/weddingApi";
import { copyText, isShareAbortError, NativeShareUnavailableError, shareContent } from "../invitation/browserActions";
import { parseInviteLinkBulkInput } from "../invitation/inviteLinkBulkInput";
import {
  clearAdminInviteLinkTokens,
  loadAdminInviteLinkTokens,
  removeAdminInviteLinkToken,
  saveAdminInviteLinkTokens
} from "../invitation/inviteLinkAdminTokens";
import {
  buildInvitationInviteUrl,
  downloadInvitationInviteQr,
  invitationInviteQrDataUrl
} from "../invitation/inviteLinkQr";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import "../invite-links-admin.css";

type Filter = "all" | "active" | "unopened" | "opened" | "responded" | "inactive";
type CreateMode = "single" | "bulk";

const emptyResult: InvitationInviteLinkAdminResult = {
  summary: { total: 0, active: 0, opened: 0, responded: 0 },
  links: []
};

const filterOptions: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "active", label: "활성" },
  { value: "unopened", label: "미열람" },
  { value: "opened", label: "열람" },
  { value: "responded", label: "응답" },
  { value: "inactive", label: "중지" }
];

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function sideLabel(side: InvitationInviteLinkSide): string {
  return side === "bride" ? "신부측" : "신랑측";
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function summarize(links: InvitationInviteLinkRecord[]): InvitationInviteLinkAdminResult {
  return {
    links,
    summary: {
      total: links.length,
      active: links.filter(({ active }) => active).length,
      opened: links.filter(({ openCount }) => openCount > 0).length,
      responded: links.filter(({ respondedAt }) => respondedAt !== null).length
    }
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof WeddingApiError && error.status === 401) return "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (error instanceof WeddingApiError && error.code === "invalid_request") return "입력 형식을 확인해 주세요.";
  return fallback;
}

function LinkEditor({
  link,
  busy,
  onSave
}: {
  link: InvitationInviteLinkRecord;
  busy: boolean;
  onSave: (update: InvitationInviteLinkUpdate) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [guestName, setGuestName] = useState(link.guestName);
  const [side, setSide] = useState(link.side);
  const [groupLabel, setGroupLabel] = useState(link.groupLabel);

  function cancel() {
    setGuestName(link.guestName);
    setSide(link.side);
    setGroupLabel(link.groupLabel);
    setEditing(false);
  }

  if (!editing) {
    return <button type="button" className="invite-links-icon-action" onClick={() => setEditing(true)} aria-label={`${link.guestName} 정보 수정`}><Pencil aria-hidden="true" /></button>;
  }

  return (
    <form className="invite-links-row-editor" onSubmit={(event) => {
      event.preventDefault();
      void onSave({ guestName, side, groupLabel }).then((saved) => {
        if (saved) setEditing(false);
      });
    }}>
      <label><span>이름</span><input value={guestName} maxLength={40} required onChange={(event) => setGuestName(event.target.value)} /></label>
      <label><span>측</span><select value={side} onChange={(event) => setSide(event.target.value as InvitationInviteLinkSide)}><option value="bride">신부측</option><option value="groom">신랑측</option></select></label>
      <label><span>그룹</span><input value={groupLabel} maxLength={40} onChange={(event) => setGroupLabel(event.target.value)} /></label>
      <button type="submit" disabled={busy || !guestName.trim()} aria-label={`${link.guestName} 수정 저장`}><Check aria-hidden="true" /></button>
      <button type="button" className="rsvp-admin-secondary" onClick={cancel} aria-label="수정 취소"><X aria-hidden="true" /></button>
    </form>
  );
}

export function InviteLinksAdminPage() {
  const id = invitationId();
  const mountedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<InvitationInviteLinkAdminResult>(emptyResult);
  const [tokens, setTokens] = useState<Record<string, string>>(() => loadAdminInviteLinkTokens(id));
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [createMode, setCreateMode] = useState<CreateMode>("single");
  const [guestName, setGuestName] = useState("");
  const [side, setSide] = useState<InvitationInviteLinkSide>("bride");
  const [groupLabel, setGroupLabel] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [qrPreview, setQrPreview] = useState<{ guestName: string; url: string; dataUrl: string } | null>(null);

  const logout = useCallback((message = "") => {
    sessionRef.current = null;
    clearAdminSession(id);
    clearAdminInviteLinkTokens(id);
    setSession(null);
    setResult(emptyResult);
    setTokens({});
    setPassword("");
    setLoading(false);
    setBusyId(null);
    setError(message);
    setStatus("");
  }, [id]);

  const loadLinks = useCallback(async (token: string) => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchAdminInvitationInviteLinks(token);
      if (sessionRef.current?.token === token) setResult(next);
    } catch (loadError) {
      if (loadError instanceof WeddingApiError && loadError.status === 401) logout(errorMessage(loadError, ""));
      else setError(errorMessage(loadError, "초대 링크 목록을 불러오지 못했습니다."));
    } finally {
      if (sessionRef.current?.token === token) setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    mountedRef.current = true;
    const restored = loadAdminSession(id);
    if (restored) {
      sessionRef.current = restored;
      setSession(restored);
      void loadLinks(restored.token);
    }
    return () => { mountedRef.current = false; };
  }, [id, loadLinks]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError("");
    try {
      const nextSession = await createAdminSession(password);
      if (!mountedRef.current) return;
      sessionRef.current = nextSession;
      setSession(nextSession);
      saveAdminSession(id, nextSession);
      setPassword("");
      await loadLinks(nextSession.token);
    } catch (loginError) {
      setPassword("");
      setError(errorMessage(loginError, "로그인하지 못했습니다. 비밀번호를 확인해 주세요."));
      setLoading(false);
    }
  }

  function rememberCreated(nextResult: Awaited<ReturnType<typeof createAdminInvitationInviteLinks>>) {
    setResult({ summary: nextResult.summary, links: nextResult.links });
    setTokens((current) => saveAdminInviteLinkTokens(id, current, nextResult.created));
    setRecentIds(nextResult.created.map(({ link }) => link.id));
  }

  async function createLinks(links: InvitationInviteLinkInput[]) {
    const token = sessionRef.current?.token;
    if (!token || loading) return;
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const next = await createAdminInvitationInviteLinks(token, links);
      rememberCreated(next);
      setStatus(`${next.created.length}명의 개인 초대 링크를 생성했습니다.`);
      setGuestName("");
      setGroupLabel("");
      setBulkText("");
    } catch (createError) {
      setError(errorMessage(createError, "초대 링크를 생성하지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  async function updateLink(linkId: string, update: InvitationInviteLinkUpdate): Promise<boolean> {
    const token = sessionRef.current?.token;
    if (!token || busyId) return false;
    setBusyId(linkId);
    setError("");
    try {
      const updated = await updateAdminInvitationInviteLink(token, linkId, update);
      setResult((current) => summarize(current.links.map((link) => link.id === linkId ? updated : link)));
      setStatus(`${updated.guestName}님의 초대 정보를 수정했습니다.`);
      return true;
    } catch (updateError) {
      setError(errorMessage(updateError, "초대 정보를 수정하지 못했습니다."));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function rotateLink(link: InvitationInviteLinkRecord) {
    const token = sessionRef.current?.token;
    if (!token || busyId || !window.confirm(`${link.guestName}님의 기존 링크를 폐기하고 재발급할까요?`)) return;
    setBusyId(link.id);
    setError("");
    try {
      const next = await rotateAdminInvitationInviteLink(token, link.id);
      rememberCreated(next);
      setStatus(`${link.guestName}님의 링크를 재발급했습니다. 기존 링크는 더 이상 사용할 수 없습니다.`);
    } catch (rotateError) {
      setError(errorMessage(rotateError, "초대 링크를 재발급하지 못했습니다."));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteLink(link: InvitationInviteLinkRecord) {
    const token = sessionRef.current?.token;
    if (!token || busyId || !window.confirm(`${link.guestName}님의 초대 링크를 삭제할까요?`)) return;
    setBusyId(link.id);
    setError("");
    try {
      await deleteAdminInvitationInviteLink(token, link.id);
      setResult((current) => summarize(current.links.filter(({ id: currentId }) => currentId !== link.id)));
      setTokens((current) => removeAdminInviteLinkToken(id, current, link.id));
      setRecentIds((current) => current.filter((currentId) => currentId !== link.id));
      setStatus(`${link.guestName}님의 초대 링크를 삭제했습니다.`);
    } catch (deleteError) {
      setError(errorMessage(deleteError, "초대 링크를 삭제하지 못했습니다."));
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink(link: InvitationInviteLinkRecord) {
    const token = tokens[link.id];
    if (!token) return;
    try {
      await copyText(buildInvitationInviteUrl(token));
      setStatus(`${link.guestName}님의 초대 링크를 복사했습니다.`);
    } catch {
      setError("클립보드를 사용할 수 없습니다. QR 다운로드를 이용해 주세요.");
    }
  }

  async function shareLink(link: InvitationInviteLinkRecord) {
    const token = tokens[link.id];
    if (!token) return;
    const url = buildInvitationInviteUrl(token);
    try {
      await shareContent({ title: `${link.guestName}님께 드리는 결혼식 초대`, text: "이건희 · 이승재의 결혼식에 초대합니다.", url });
      setStatus(`${link.guestName}님의 초대 링크 공유창을 열었습니다.`);
    } catch (shareError) {
      if (isShareAbortError(shareError)) return;
      if (shareError instanceof NativeShareUnavailableError) {
        await copyLink(link);
        return;
      }
      setError("공유창을 열지 못했습니다.");
    }
  }

  async function showQr(link: InvitationInviteLinkRecord) {
    const token = tokens[link.id];
    if (!token) return;
    const url = buildInvitationInviteUrl(token);
    setBusyId(link.id);
    try {
      setQrPreview({ guestName: link.guestName, url, dataUrl: await invitationInviteQrDataUrl(url) });
    } catch {
      setError("QR 이미지를 만들지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function copyRecentLinks() {
    const lines = result.links.filter(({ id: linkId }) => recentIds.includes(linkId) && tokens[linkId]).map((link) => (
      `${link.guestName}\t${sideLabel(link.side)}\t${link.groupLabel}\t${buildInvitationInviteUrl(tokens[link.id])}`
    ));
    try {
      await copyText(lines.join("\n"));
      setStatus(`최근 생성한 ${lines.length}개 링크를 한 번에 복사했습니다.`);
    } catch {
      setError("링크 묶음을 복사하지 못했습니다.");
    }
  }

  const visibleLinks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    return result.links.filter((link) => {
      const matchesQuery = !normalizedQuery || `${link.guestName} ${link.groupLabel} ${sideLabel(link.side)}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery);
      const matchesFilter = filter === "all"
        || (filter === "active" && link.active)
        || (filter === "unopened" && link.openCount === 0)
        || (filter === "opened" && link.openCount > 0)
        || (filter === "responded" && link.respondedAt !== null)
        || (filter === "inactive" && !link.active);
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, result.links]);

  if (!session) {
    return (
      <main className="rsvp-admin-page">
        <section className="rsvp-admin-login" aria-labelledby="invite-links-login-title">
          <Link2 aria-hidden="true" />
          <p className="rsvp-admin-eyebrow">PRIVATE DELIVERY</p>
          <h1 id="invite-links-login-title">초대 링크·QR 발송</h1>
          <form onSubmit={handleLogin}>
            <label htmlFor="invite-links-password">관리자 비밀번호</label>
            <input id="invite-links-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} required />
            <button type="submit" disabled={loading || !password}>{loading ? "로그인 중…" : "로그인"}</button>
          </form>
          {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="rsvp-admin-page invite-links-admin-page">
      <div className="rsvp-admin-shell">
        <header className="rsvp-admin-header invite-links-admin-header">
          <div><p className="rsvp-admin-eyebrow">MJ CONVENTION · DELIVERY</p><h1>하객별 초대 링크·QR</h1><span>개인정보를 URL에 표시하지 않는 무작위 초대 토큰</span></div>
          <div className="guestbook-admin-header-actions">
            <a className="rsvp-admin-nav-link" href="?admin=setup">일괄 입력</a>
            <a className="rsvp-admin-nav-link" href="?admin=rsvp">참석 답변</a>
            <a className="rsvp-admin-nav-link" href="?admin=analytics">방문 통계</a>
            <button type="button" className="rsvp-admin-secondary" onClick={() => logout()}><LogOut aria-hidden="true" /> 로그아웃</button>
          </div>
        </header>

        <section className="invite-links-summary" aria-label="초대 링크 현황">
          <article><Users aria-hidden="true" /><div><span>전체 하객</span><strong>{result.summary.total}</strong></div></article>
          <article><ShieldCheck aria-hidden="true" /><div><span>활성 링크</span><strong>{result.summary.active}</strong></div></article>
          <article><Eye aria-hidden="true" /><div><span>열람 완료</span><strong>{result.summary.opened}</strong></div></article>
          <article><MessageSquareCheck aria-hidden="true" /><div><span>RSVP 완료</span><strong>{result.summary.responded}</strong></div></article>
        </section>

        {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        {status && <p className="rsvp-admin-message" role="status">{status}</p>}
        {recentIds.length > 0 && (
          <section className="invite-links-recent" aria-label="방금 생성한 링크">
            <div><Check aria-hidden="true" /><p><strong>방금 만든 링크는 현재 관리자 탭에서만 다시 확인할 수 있습니다.</strong><span>D1에는 링크 원문을 저장하지 않습니다. 지금 복사하거나 QR을 내려받아 주세요.</span></p></div>
            <button type="button" onClick={() => void copyRecentLinks()}><ClipboardCopy aria-hidden="true" /> {recentIds.length}개 링크 묶음 복사</button>
          </section>
        )}

        <div className="invite-links-layout">
          <section className="invite-links-create" aria-labelledby="invite-links-create-title">
            <header><div><span>NEW DELIVERY</span><h2 id="invite-links-create-title">개인 초대 만들기</h2></div><div className="invite-links-mode" role="group" aria-label="생성 방식"><button type="button" aria-pressed={createMode === "single"} onClick={() => setCreateMode("single")}><Plus aria-hidden="true" /> 한 명</button><button type="button" aria-pressed={createMode === "bulk"} onClick={() => setCreateMode("bulk")}><Upload aria-hidden="true" /> 여러 명</button></div></header>
            {createMode === "single" ? (
              <form onSubmit={(event) => { event.preventDefault(); void createLinks([{ guestName: guestName.trim(), side, groupLabel: groupLabel.trim() }]); }}>
                <label><span>하객 이름</span><input value={guestName} maxLength={40} autoComplete="off" required placeholder="예: 김하객" onChange={(event) => setGuestName(event.target.value)} /></label>
                <div className="invite-links-form-row"><label><span>신랑·신부 측</span><select value={side} onChange={(event) => setSide(event.target.value as InvitationInviteLinkSide)}><option value="bride">신부측</option><option value="groom">신랑측</option></select></label><label><span>관계 그룹</span><input value={groupLabel} maxLength={40} autoComplete="off" placeholder="예: 대학 친구" onChange={(event) => setGroupLabel(event.target.value)} /></label></div>
                <button type="submit" disabled={loading || !guestName.trim()}><Link2 aria-hidden="true" /> {loading ? "생성 중…" : "개인 링크 생성"}</button>
              </form>
            ) : (
              <form onSubmit={(event) => {
                event.preventDefault();
                const parsed = parseInviteLinkBulkInput(bulkText);
                if (parsed.error) { setError(parsed.error); return; }
                void createLinks(parsed.links);
              }}>
                <label><span>하객 목록</span><textarea rows={8} value={bulkText} placeholder={"김하객, 신부측, 대학 친구\n이하객, 신랑측, 직장"} onChange={(event) => setBulkText(event.target.value)} /></label>
                <p>한 줄에 이름, 신부측 또는 신랑측, 그룹 순서로 입력합니다. 쉼표와 탭을 모두 지원합니다.</p>
                <button type="submit" disabled={loading || !bulkText.trim()}><Upload aria-hidden="true" /> {loading ? "생성 중…" : "여러 링크 생성"}</button>
              </form>
            )}
          </section>

          <section className="invite-links-list" aria-labelledby="invite-links-list-title">
            <header><div><span>DELIVERY LIST</span><h2 id="invite-links-list-title">발송 현황</h2></div><button type="button" className="rsvp-admin-secondary" onClick={() => sessionRef.current && void loadLinks(sessionRef.current.token)} disabled={loading}><RefreshCw aria-hidden="true" /> 새로고침</button></header>
            <div className="invite-links-toolbar"><label><Search aria-hidden="true" /><span className="sr-only">하객 검색</span><input type="search" value={query} placeholder="이름·그룹 검색" onChange={(event) => setQuery(event.target.value)} /></label><div role="group" aria-label="링크 상태 필터">{filterOptions.map((option) => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>)}</div></div>
            {loading && result.links.length === 0 ? <p className="invite-links-empty" role="status"><LoaderCircle aria-hidden="true" /> 초대 링크를 불러오고 있습니다…</p> : visibleLinks.length === 0 ? <p className="invite-links-empty">조건에 맞는 초대 링크가 없습니다.</p> : (
              <ol className="invite-links-rows">
                {visibleLinks.map((link) => {
                  const rawToken = tokens[link.id];
                  const rowBusy = busyId === link.id;
                  return (
                    <li key={link.id} className={!link.active ? "is-inactive" : ""}>
                      <div className="invite-links-row-main"><div className="invite-links-avatar" aria-hidden="true">{link.guestName.slice(0, 1)}</div><div className="invite-links-identity"><span>{sideLabel(link.side)}{link.groupLabel ? ` · ${link.groupLabel}` : ""}</span><strong>{link.guestName}</strong><small>{link.active ? "활성" : "중지"} · 열람 {link.openCount}회 · RSVP {link.respondedAt ? "완료" : "대기"}</small></div><div className="invite-links-row-times"><span>최근 열람 <strong>{formatDateTime(link.lastOpenedAt)}</strong></span><span>응답 <strong>{formatDateTime(link.respondedAt)}</strong></span></div></div>
                      <div className="invite-links-row-actions">
                        <LinkEditor link={link} busy={rowBusy} onSave={(update) => updateLink(link.id, update)} />
                        <button type="button" className="invite-links-icon-action" disabled={!rawToken || rowBusy} onClick={() => void copyLink(link)} aria-label={`${link.guestName} 초대 링크 복사`} title={rawToken ? "초대 링크 복사" : "재발급 후 복사 가능"}><ClipboardCopy aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action" disabled={!rawToken || rowBusy} onClick={() => void shareLink(link)} aria-label={`${link.guestName} 초대 링크 공유`} title="공유"><Share2 aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action" disabled={!rawToken || rowBusy} onClick={() => void showQr(link)} aria-label={`${link.guestName} QR 보기`} title="QR 보기"><QrCode aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action" disabled={rowBusy} onClick={() => void updateLink(link.id, { active: !link.active })} aria-label={`${link.guestName} 링크 ${link.active ? "중지" : "활성화"}`} title={link.active ? "링크 중지" : "링크 활성화"}><Power aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action" disabled={rowBusy} onClick={() => void rotateLink(link)} aria-label={`${link.guestName} 링크 재발급`} title="링크 재발급"><RefreshCw aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action is-danger" disabled={rowBusy} onClick={() => void deleteLink(link)} aria-label={`${link.guestName} 링크 삭제`} title="삭제"><Trash2 aria-hidden="true" /></button>
                      </div>
                      {!rawToken && <p className="invite-links-token-note">보안상 링크 원문이 서버에 남아 있지 않습니다. 복사·QR이 필요하면 재발급하세요.</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>

      {qrPreview && (
        <div className="invite-links-qr-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQrPreview(null); }}>
          <section className="invite-links-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-links-qr-title">
            <header><div><span>PERSONAL QR</span><h2 id="invite-links-qr-title">{qrPreview.guestName}님 초대 QR</h2></div><button type="button" className="invite-links-icon-action" onClick={() => setQrPreview(null)} aria-label="QR 닫기"><X aria-hidden="true" /></button></header>
            <img src={qrPreview.dataUrl} alt={`${qrPreview.guestName}님 개인 초대 링크 QR 코드`} />
            <p>이 QR에는 이름이나 연락처가 아니라 무작위 초대 토큰만 포함됩니다.</p>
            <div><button type="button" onClick={() => void downloadInvitationInviteQr(qrPreview.url, qrPreview.guestName)}><Download aria-hidden="true" /> PNG 다운로드</button><button type="button" className="rsvp-admin-secondary" onClick={() => setQrPreview(null)}>닫기</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

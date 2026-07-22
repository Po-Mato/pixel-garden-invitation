import {
  Check,
  ClipboardCopy,
  Download,
  Eye,
  FileDown,
  FileUp,
  Link2,
  LoaderCircle,
  LogOut,
  MessageSquareCheck,
  MessageSquareText,
  Pencil,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Search,
  Send,
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
  InvitationInviteDeliveryChannel,
  InvitationInviteLinkInput,
  InvitationInviteLinkRecord,
  InvitationInviteLinkSide,
  InvitationInviteLinkUpdate
} from "@wedding-game/shared";
import {
  createAdminInvitationInviteLinks,
  deleteAdminInvitationInviteLink,
  fetchAdminInvitationInviteLinks,
  recordAdminInvitationInviteLinkDeliveries,
  rotateAdminInvitationInviteLink,
  updateAdminInvitationInviteLink
} from "../api/invitationInviteLinksApi";
import { createAdminSession, WeddingApiError, type AdminSession } from "../api/weddingApi";
import { copyText, isShareAbortError, NativeShareUnavailableError, shareContent } from "../invitation/browserActions";
import { formatInviteLinkBulkInput, parseInviteLinkBulkInput } from "../invitation/inviteLinkBulkInput";
import {
  buildInviteGuestCsv,
  downloadInviteGuestCsv,
  parseInviteGuestCsv
} from "../invitation/inviteGuestCsv";
import {
  buildInviteDeliveryMessage,
  inviteDeliveryTemplates,
  type InviteDeliveryTemplateId
} from "../invitation/inviteDeliveryMessages";
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

type Filter = "all" | "unsent" | "delivered" | "unopened" | "opened" | "responded" | "inactive";
type CreateMode = "single" | "bulk";

const emptyResult: InvitationInviteLinkAdminResult = {
  summary: { total: 0, active: 0, delivered: 0, opened: 0, responded: 0 },
  links: []
};

const filterOptions: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "unsent", label: "미발송" },
  { value: "delivered", label: "발송" },
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

function deliveryChannelLabel(channel: InvitationInviteDeliveryChannel | null): string {
  if (channel === "kakao") return "카카오톡";
  if (channel === "sms") return "문자";
  if (channel === "in_person") return "직접 전달";
  if (channel === "other") return "기타";
  return "미발송";
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
      delivered: links.filter(({ sendCount }) => sendCount > 0).length,
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
  const csvInputRef = useRef<HTMLInputElement>(null);
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<InviteDeliveryTemplateId>("formal");
  const [deliveryTargetIds, setDeliveryTargetIds] = useState<string[]>([]);
  const [deliveryChannel, setDeliveryChannel] = useState<InvitationInviteDeliveryChannel>("kakao");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [qrPreview, setQrPreview] = useState<{ guestName: string; url: string; dataUrl: string } | null>(null);

  const logout = useCallback((message = "") => {
    sessionRef.current = null;
    clearAdminSession(id);
    clearAdminInviteLinkTokens(id);
    setSession(null);
    setResult(emptyResult);
    setTokens({});
    setSelectedIds([]);
    setDeliveryTargetIds([]);
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

  async function handleCsvFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = parseInviteGuestCsv(await file.text());
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
      setCreateMode("bulk");
      setBulkText(formatInviteLinkBulkInput(parsed.links));
      setError("");
      setStatus(`${parsed.links.length}명의 CSV 명단을 불러왔습니다. 내용을 확인한 뒤 링크를 생성해 주세요.`);
    } catch {
      setError("CSV 파일을 읽지 못했습니다.");
    }
  }

  function exportCsv() {
    downloadInviteGuestCsv(buildInviteGuestCsv(result.links, tokens));
    setStatus(`${result.links.length}명의 발송 현황을 CSV로 내보냈습니다.`);
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
      setSelectedIds((current) => current.filter((currentId) => currentId !== link.id));
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

  async function copyMessage(link: InvitationInviteLinkRecord) {
    const token = tokens[link.id];
    if (!token) return;
    try {
      const message = buildInviteDeliveryMessage(templateId, link.guestName, buildInvitationInviteUrl(token));
      await copyText(message.copyText);
      setStatus(`${link.guestName}님의 초대 문구와 링크를 복사했습니다.`);
    } catch {
      setError("초대 문구를 복사하지 못했습니다.");
    }
  }

  async function shareLink(link: InvitationInviteLinkRecord) {
    const token = tokens[link.id];
    if (!token) return;
    const message = buildInviteDeliveryMessage(templateId, link.guestName, buildInvitationInviteUrl(token));
    try {
      await shareContent({ title: message.title, text: message.text, url: message.url });
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

  function openDeliveryDialog(linkIds: string[]) {
    const selected = result.links.filter((link) => linkIds.includes(link.id));
    if (selected.length === 0) return;
    setDeliveryTargetIds(selected.map(({ id: linkId }) => linkId));
    setDeliveryChannel(selected.length === 1 && selected[0].deliveryChannel ? selected[0].deliveryChannel : "kakao");
    setDeliveryNote(selected.length === 1 ? selected[0].deliveryNote : "");
  }

  async function recordDelivery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = sessionRef.current?.token;
    if (!token || deliveryBusy || deliveryTargetIds.length === 0) return;
    setDeliveryBusy(true);
    setError("");
    try {
      const next = await recordAdminInvitationInviteLinkDeliveries(token, {
        linkIds: deliveryTargetIds,
        channel: deliveryChannel,
        note: deliveryNote
      });
      setResult(next);
      setSelectedIds([]);
      setDeliveryTargetIds([]);
      setDeliveryNote("");
      setStatus(`${deliveryTargetIds.length}명의 발송 이력을 기록했습니다.`);
    } catch (deliveryError) {
      setError(errorMessage(deliveryError, "발송 이력을 기록하지 못했습니다."));
    } finally {
      setDeliveryBusy(false);
    }
  }

  async function copySelectedMessages() {
    const selected = result.links.filter((link) => selectedIds.includes(link.id) && tokens[link.id]);
    if (selected.length === 0) {
      setError("현재 탭에서 링크를 확인할 수 있는 하객을 선택해 주세요.");
      return;
    }
    const messages = selected.map((link) => buildInviteDeliveryMessage(
      templateId,
      link.guestName,
      buildInvitationInviteUrl(tokens[link.id])
    ).copyText);
    try {
      await copyText(messages.join("\n\n──────────\n\n"));
      setStatus(`${selected.length}명의 개인 초대 문구를 한 번에 복사했습니다.`);
    } catch {
      setError("선택한 초대 문구를 복사하지 못했습니다.");
    }
  }

  const visibleLinks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    return result.links.filter((link) => {
      const matchesQuery = !normalizedQuery || `${link.guestName} ${link.groupLabel} ${sideLabel(link.side)}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery);
      const matchesFilter = filter === "all"
        || (filter === "unsent" && link.sendCount === 0)
        || (filter === "delivered" && link.sendCount > 0)
        || (filter === "unopened" && link.openCount === 0)
        || (filter === "opened" && link.openCount > 0)
        || (filter === "responded" && link.respondedAt !== null)
        || (filter === "inactive" && !link.active);
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, result.links]);
  const visibleIds = visibleLinks.map(({ id: linkId }) => linkId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((linkId) => selectedIds.includes(linkId));

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
          <article><Send aria-hidden="true" /><div><span>발송 완료</span><strong>{result.summary.delivered}</strong></div></article>
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

        <section className="invite-links-message-tools" aria-labelledby="invite-message-template-title">
          <div><MessageSquareText aria-hidden="true" /><div><span>MESSAGE TEMPLATE</span><h2 id="invite-message-template-title">발송 문구</h2></div></div>
          <label><span>문구 유형</span><select value={templateId} onChange={(event) => setTemplateId(event.target.value as InviteDeliveryTemplateId)}>{inviteDeliveryTemplates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></label>
          <p>하객 이름·예식 일정·장소가 개인별 문구에 자동으로 들어갑니다.</p>
        </section>

        <div className="invite-links-layout">
          <section className="invite-links-create" aria-labelledby="invite-links-create-title">
            <header><div><span>NEW DELIVERY</span><h2 id="invite-links-create-title">개인 초대 만들기</h2></div><div className="invite-links-mode" role="group" aria-label="생성 방식"><button type="button" aria-pressed={createMode === "single"} onClick={() => setCreateMode("single")}><Plus aria-hidden="true" /> 한 명</button><button type="button" aria-pressed={createMode === "bulk"} onClick={() => setCreateMode("bulk")}><Upload aria-hidden="true" /> 여러 명</button></div></header>
            <input ref={csvInputRef} className="invite-links-file-input" type="file" accept=".csv,text/csv,text/tab-separated-values" onChange={(event) => void handleCsvFile(event)} />
            <button type="button" className="invite-links-csv-import rsvp-admin-secondary" onClick={() => csvInputRef.current?.click()}><FileUp aria-hidden="true" /> CSV 명단 불러오기</button>
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
            <header><div><span>DELIVERY LIST</span><h2 id="invite-links-list-title">발송 현황</h2></div><div className="invite-links-list-actions"><button type="button" className="rsvp-admin-secondary" onClick={exportCsv} disabled={result.links.length === 0}><FileDown aria-hidden="true" /> CSV 내보내기</button><button type="button" className="rsvp-admin-secondary" onClick={() => sessionRef.current && void loadLinks(sessionRef.current.token)} disabled={loading}><RefreshCw aria-hidden="true" /> 새로고침</button></div></header>
            <div className="invite-links-toolbar"><label><Search aria-hidden="true" /><span className="sr-only">하객 검색</span><input type="search" value={query} placeholder="이름·그룹 검색" onChange={(event) => setQuery(event.target.value)} /></label><div role="group" aria-label="링크 상태 필터">{filterOptions.map((option) => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>)}</div></div>
            {visibleLinks.length > 0 && (
              <div className="invite-links-selection-tools">
                <label><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds((current) => allVisibleSelected ? current.filter((linkId) => !visibleIds.includes(linkId)) : [...new Set([...current, ...visibleIds])])} /> 현재 목록 전체 선택</label>
                <span>{selectedIds.length}명 선택</span>
                <button type="button" className="rsvp-admin-secondary" disabled={selectedIds.length === 0} onClick={() => void copySelectedMessages()}><MessageSquareText aria-hidden="true" /> 문구 묶음 복사</button>
                <button type="button" disabled={selectedIds.length === 0} onClick={() => openDeliveryDialog(selectedIds)}><Send aria-hidden="true" /> 발송 기록</button>
              </div>
            )}
            {loading && result.links.length === 0 ? <p className="invite-links-empty" role="status"><LoaderCircle aria-hidden="true" /> 초대 링크를 불러오고 있습니다…</p> : visibleLinks.length === 0 ? <p className="invite-links-empty">조건에 맞는 초대 링크가 없습니다.</p> : (
              <ol className="invite-links-rows">
                {visibleLinks.map((link) => {
                  const rawToken = tokens[link.id];
                  const rowBusy = busyId === link.id;
                  return (
                    <li key={link.id} className={!link.active ? "is-inactive" : ""}>
                      <div className="invite-links-row-main"><label className="invite-links-row-select"><input type="checkbox" checked={selectedIds.includes(link.id)} onChange={() => setSelectedIds((current) => current.includes(link.id) ? current.filter((linkId) => linkId !== link.id) : [...current, link.id])} /><span className="sr-only">{link.guestName} 선택</span></label><div className="invite-links-avatar" aria-hidden="true">{link.guestName.slice(0, 1)}</div><div className="invite-links-identity"><span>{sideLabel(link.side)}{link.groupLabel ? ` · ${link.groupLabel}` : ""}</span><strong>{link.guestName}</strong><small>{link.active ? "활성" : "중지"} · {link.sendCount > 0 ? `${deliveryChannelLabel(link.deliveryChannel)} ${link.sendCount}회` : "미발송"} · 열람 {link.openCount}회 · RSVP {link.respondedAt ? "완료" : "대기"}</small></div><div className="invite-links-row-times"><span>최근 발송 <strong>{formatDateTime(link.lastSentAt)}</strong></span><span>최근 열람 <strong>{formatDateTime(link.lastOpenedAt)}</strong></span><span>응답 <strong>{formatDateTime(link.respondedAt)}</strong></span></div></div>
                      <div className="invite-links-row-actions">
                        <LinkEditor link={link} busy={rowBusy} onSave={(update) => updateLink(link.id, update)} />
                        <button type="button" className="invite-links-icon-action" disabled={!rawToken || rowBusy} onClick={() => void copyLink(link)} aria-label={`${link.guestName} 초대 링크 복사`} title={rawToken ? "초대 링크 복사" : "재발급 후 복사 가능"}><ClipboardCopy aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action" disabled={!rawToken || rowBusy} onClick={() => void copyMessage(link)} aria-label={`${link.guestName} 초대 문구 복사`} title="개인 초대 문구 복사"><MessageSquareText aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action" disabled={!rawToken || rowBusy} onClick={() => void shareLink(link)} aria-label={`${link.guestName} 초대 링크 공유`} title="공유"><Share2 aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action" disabled={!rawToken || rowBusy} onClick={() => void showQr(link)} aria-label={`${link.guestName} QR 보기`} title="QR 보기"><QrCode aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action is-delivery" disabled={rowBusy} onClick={() => openDeliveryDialog([link.id])} aria-label={`${link.guestName} ${link.sendCount > 0 ? "재발송" : "발송"} 기록`} title={link.sendCount > 0 ? "재발송 기록" : "발송 기록"}><Send aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action" disabled={rowBusy} onClick={() => void updateLink(link.id, { active: !link.active })} aria-label={`${link.guestName} 링크 ${link.active ? "중지" : "활성화"}`} title={link.active ? "링크 중지" : "링크 활성화"}><Power aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action" disabled={rowBusy} onClick={() => void rotateLink(link)} aria-label={`${link.guestName} 링크 재발급`} title="링크 재발급"><RefreshCw aria-hidden="true" /></button>
                        <button type="button" className="invite-links-icon-action is-danger" disabled={rowBusy} onClick={() => void deleteLink(link)} aria-label={`${link.guestName} 링크 삭제`} title="삭제"><Trash2 aria-hidden="true" /></button>
                      </div>
                      {link.deliveryNote && <p className="invite-links-delivery-note">발송 메모 · {link.deliveryNote}</p>}
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
      {deliveryTargetIds.length > 0 && (
        <div className="invite-links-qr-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deliveryBusy) setDeliveryTargetIds([]); }}>
          <section className="invite-links-qr-dialog invite-links-delivery-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-links-delivery-title">
            <header><div><span>DELIVERY HISTORY</span><h2 id="invite-links-delivery-title">{deliveryTargetIds.length}명 발송 기록</h2></div><button type="button" className="invite-links-icon-action" disabled={deliveryBusy} onClick={() => setDeliveryTargetIds([])} aria-label="발송 기록 닫기"><X aria-hidden="true" /></button></header>
            <form onSubmit={(event) => void recordDelivery(event)}>
              <label><span>발송 경로</span><select value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value as InvitationInviteDeliveryChannel)}><option value="kakao">카카오톡</option><option value="sms">문자</option><option value="in_person">직접 전달</option><option value="other">기타</option></select></label>
              <label><span>관리 메모</span><textarea rows={3} maxLength={200} value={deliveryNote} placeholder="예: 신부가 대학 친구 단체방으로 발송" onChange={(event) => setDeliveryNote(event.target.value)} /></label>
              <p>발송을 기록하면 횟수와 최초·최근 발송 시각이 저장됩니다. 연락처와 메시지 내용은 저장하지 않습니다.</p>
              <div><button type="submit" disabled={deliveryBusy}><Send aria-hidden="true" /> {deliveryBusy ? "기록 중…" : "발송 완료 기록"}</button><button type="button" className="rsvp-admin-secondary" disabled={deliveryBusy} onClick={() => setDeliveryTargetIds([])}>취소</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

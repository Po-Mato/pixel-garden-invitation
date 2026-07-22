import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Database,
  Image,
  LogOut,
  Phone,
  RefreshCw,
  TriangleAlert
} from "lucide-react";
import {
  weddingContentPublication,
  type AdminNotificationResult
} from "@wedding-game/shared";

import {
  createAdminSession,
  fetchAdminGuestbook,
  fetchAdminNotifications,
  fetchAdminRsvps,
  WeddingApiError,
  type AdminSession
} from "../api/weddingApi";
import {
  buildPublicationReadiness,
  type ReadinessCategory,
  type ReadinessRuntime,
  type ReadinessService
} from "../invitation/publicationReadiness";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import "../readiness-admin.css";

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function checkingService(): ReadinessService {
  return { state: "checking" };
}

function initialRuntime(): ReadinessRuntime {
  return {
    rsvp: checkingService(),
    guestbook: checkingService(),
    notifications: checkingService()
  };
}

function categoryIcon(category: ReadinessCategory) {
  if (category.id === "event") return <CalendarCheck2 aria-hidden="true" />;
  if (category.id === "content") return <Image aria-hidden="true" />;
  if (category.id === "contact") return <Phone aria-hidden="true" />;
  return <Database aria-hidden="true" />;
}

function readTurnstileConfigured(result: AdminNotificationResult): boolean | undefined {
  const value = (result as { spamProtection?: { turnstileConfigured?: unknown } }).spamProtection
    ?.turnstileConfigured;
  return typeof value === "boolean" ? value : undefined;
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof WeddingApiError && error.status === 429) {
    return "로그인 시도가 제한되었습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "로그인하지 못했습니다. 비밀번호를 확인해 주세요.";
}

function statusIcon(status: "ready" | "attention" | "pending") {
  if (status === "ready") return <CheckCircle2 aria-hidden="true" />;
  if (status === "attention") return <TriangleAlert aria-hidden="true" />;
  return <Clock3 aria-hidden="true" />;
}

export function ReadinessAdminPage() {
  const id = invitationId();
  const mountedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [password, setPassword] = useState("");
  const [runtime, setRuntime] = useState<ReadinessRuntime>(initialRuntime);
  const [checking, setChecking] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const published = usePublishedInvitationContent();

  const readiness = useMemo(() => buildPublicationReadiness({
    event: published.event,
    content: published.content,
    publication: {
      ...weddingContentPublication,
      ...(published.source === "published"
        ? { coupleIntroduction: "ready" as const, storyTimeline: "ready" as const }
        : {}),
      ...(published.gallerySource === "published" ? { gallery: "ready" as const } : {})
    },
    runtime
  }), [published.content, published.event, published.gallerySource, published.source, runtime]);

  function logout(message = "") {
    sessionRef.current = null;
    clearAdminSession(id);
    setSession(null);
    setPassword("");
    setRuntime(initialRuntime());
    setCheckedAt(null);
    setChecking(false);
    setError(message);
  }

  async function loadReadiness(token: string) {
    setChecking(true);
    setError("");
    setRuntime(initialRuntime());

    const [rsvpResult, guestbookResult, notificationResult] = await Promise.allSettled([
      fetchAdminRsvps(token),
      fetchAdminGuestbook(token),
      fetchAdminNotifications(token)
    ]);
    if (!mountedRef.current || sessionRef.current?.token !== token) return;

    const failures = [rsvpResult, guestbookResult, notificationResult]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.some(({ reason }) => reason instanceof WeddingApiError && reason.status === 401)) {
      logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      return;
    }

    const nextRuntime: ReadinessRuntime = {
      rsvp: rsvpResult.status === "fulfilled"
        ? {
            state: "ready",
            detail: `정상 응답 · 저장된 답변 ${rsvpResult.value.summary.responseCount}건`
          }
        : { state: "error", detail: "참석 답변 API 또는 데이터 저장소가 응답하지 않습니다." },
      guestbook: guestbookResult.status === "fulfilled"
        ? {
            state: "ready",
            detail: `정상 응답 · 저장된 메시지 ${guestbookResult.value.summary.totalCount}건`
          }
        : { state: "error", detail: "방명록 API 또는 데이터 저장소가 응답하지 않습니다." },
      notifications: notificationResult.status === "fulfilled"
        ? {
            state: "ready",
            detail: `정상 응답 · 읽지 않은 알림 ${notificationResult.value.unreadCount}건`
          }
        : { state: "error", detail: "관리자 알림 저장소가 응답하지 않습니다." },
      rsvpDeleteAt: rsvpResult.status === "fulfilled" ? rsvpResult.value.summary.deleteAt : undefined,
      guestbookDeleteAt: guestbookResult.status === "fulfilled" ? guestbookResult.value.summary.deleteAt : undefined,
      turnstileConfigured: notificationResult.status === "fulfilled"
        ? readTurnstileConfigured(notificationResult.value)
        : undefined,
      emailConfigured: notificationResult.status === "fulfilled"
        ? notificationResult.value.emailConfigured
        : undefined
    };

    setRuntime(nextRuntime);
    setCheckedAt(new Date());
    setChecking(false);
  }

  useEffect(() => {
    mountedRef.current = true;
    const restored = loadAdminSession(id);
    if (restored) {
      sessionRef.current = restored;
      setSession(restored);
      void loadReadiness(restored.token);
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
    const timer = window.setTimeout(() => {
      logout("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
    }, remaining);
    return () => window.clearTimeout(timer);
    // The timer intentionally expires the session snapshot that created it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.expiresAt, session?.token]);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setTimeout(() => setRetrySeconds((seconds) => Math.max(0, seconds - 1)), 1_000);
    return () => window.clearTimeout(timer);
  }, [retrySeconds]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || loggingIn || retrySeconds > 0) return;
    setLoggingIn(true);
    setError("");
    try {
      const nextSession = await createAdminSession(password);
      if (!mountedRef.current) return;
      sessionRef.current = nextSession;
      setSession(nextSession);
      saveAdminSession(id, nextSession);
      setPassword("");
      await loadReadiness(nextSession.token);
    } catch (loginError) {
      if (!mountedRef.current) return;
      setPassword("");
      if (loginError instanceof WeddingApiError && loginError.status === 429) {
        setRetrySeconds(loginError.retryAfterSeconds ?? 30);
      }
      setError(loginErrorMessage(loginError));
    } finally {
      if (mountedRef.current) setLoggingIn(false);
    }
  }

  if (!session) {
    return (
      <main className="rsvp-admin-page">
        <section className="rsvp-admin-login" aria-labelledby="readiness-admin-login-title">
          <ClipboardCheck aria-hidden="true" />
          <p className="rsvp-admin-eyebrow">PRIVATE ACCESS</p>
          <h1 id="readiness-admin-login-title">공개 준비 점검</h1>
          <form onSubmit={handleLogin}>
            <label htmlFor="readiness-admin-password">관리자 비밀번호</label>
            <input
              id="readiness-admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loggingIn || retrySeconds > 0}
              required
            />
            <button type="submit" disabled={loggingIn || retrySeconds > 0 || !password}>
              {loggingIn ? "로그인 중" : retrySeconds > 0 ? `${retrySeconds}초 후 로그인` : "로그인"}
            </button>
          </form>
          {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="rsvp-admin-page readiness-admin-page">
      <div className="rsvp-admin-shell">
        <header className="rsvp-admin-header readiness-admin-header">
          <div>
            <p className="rsvp-admin-eyebrow">MJ CONVENTION · 2027.05.01</p>
            <h1>공개 준비 점검</h1>
          </div>
          <div className="guestbook-admin-header-actions">
            <a className="rsvp-admin-nav-link" href="?admin=setup">일괄 입력</a>
            <a className="rsvp-admin-nav-link" href="?admin=analytics">방문 통계</a>
            <a className="rsvp-admin-nav-link" href="?admin=release">통합 공개</a>
            <a className="rsvp-admin-nav-link" href="?admin=content">실데이터 편집</a>
            <a className="rsvp-admin-nav-link" href="?admin=gallery">사진 관리</a>
            <a className="rsvp-admin-nav-link" href="?admin=rsvp">참석 답변</a>
            <a className="rsvp-admin-nav-link" href="?admin=guestbook">방명록</a>
            <button type="button" className="rsvp-admin-secondary" onClick={() => logout()}>
              <LogOut aria-hidden="true" /> 로그아웃
            </button>
          </div>
        </header>

        {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}

        <section className="readiness-overview" aria-labelledby="readiness-overview-title">
          <div className="readiness-overview__copy">
            <span className={`readiness-overview__state readiness-overview__state--${readiness.isReady ? "ready" : "attention"}`}>
              {readiness.isReady ? <CheckCircle2 aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
              {readiness.isReady ? "공개 준비 완료" : "보완 필요"}
            </span>
            <h2 id="readiness-overview-title">공개 준비도 {readiness.percent}%</h2>
            <p>
              {readiness.isReady
                ? "실데이터와 운영 연동 점검을 모두 통과했습니다."
                : `실데이터 ${readiness.attentionCount}건, 운영 연동 ${readiness.pendingCount}건을 확인해 주세요.`}
            </p>
            <div
              className="readiness-progress"
              role="progressbar"
              aria-label="공개 준비도"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={readiness.percent}
            >
              <span style={{ width: `${readiness.percent}%` }} />
            </div>
          </div>

          <dl className="readiness-overview__stats">
            <div><dt>완료</dt><dd>{readiness.readyCount}</dd></div>
            <div><dt>확인 필요</dt><dd>{readiness.attentionCount}</dd></div>
            <div><dt>운영 대기</dt><dd>{readiness.pendingCount}</dd></div>
          </dl>

          <div className="readiness-overview__actions">
            <p role="status" aria-live="polite">
              {checking
                ? "운영 상태 확인 중"
                : checkedAt
                  ? `최근 점검 ${new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(checkedAt)}`
                  : "운영 상태를 확인해 주세요."}
            </p>
            <button type="button" onClick={() => void loadReadiness(session.token)} disabled={checking}>
              <RefreshCw aria-hidden="true" /> {checking ? "점검 중" : "다시 점검"}
            </button>
          </div>
        </section>

        <div className="readiness-category-list">
          {readiness.categories.map((category) => {
            const completeCount = category.items.filter((item) => item.status === "ready").length;
            return (
              <section key={category.id} className="readiness-category" aria-labelledby={`readiness-${category.id}-title`}>
                <header className="readiness-category__header">
                  <span className="readiness-category__icon">{categoryIcon(category)}</span>
                  <div>
                    <h2 id={`readiness-${category.id}-title`}>{category.title}</h2>
                    <p>{category.description}</p>
                  </div>
                  <strong>{completeCount}/{category.items.length} 완료</strong>
                </header>
                <ul className="readiness-check-list">
                  {category.items.map((item) => (
                    <li key={item.id} className={`readiness-check readiness-check--${item.status}`}>
                      <span className="readiness-check__icon">{statusIcon(item.status)}</span>
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <span className="readiness-check__status">
                        {item.status === "ready" ? "완료" : item.status === "attention" ? "확인 필요" : "운영 대기"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <footer className="readiness-admin-footer">
          <BellRing aria-hidden="true" />
          <p>운영 연동 상태는 관리자 인증 후 실제 API 응답을 기준으로 표시됩니다.</p>
        </footer>
      </div>
    </main>
  );
}

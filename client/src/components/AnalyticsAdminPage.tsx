import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarRange,
  Download,
  Gamepad2,
  Gauge,
  LogOut,
  MapPin,
  MessageCircle,
  MousePointerClick,
  RefreshCw,
  Share2,
  Users
} from "lucide-react";
import type {
  InvitationAnalyticsAdminResult,
  InvitationAnalyticsBreakdown
} from "@wedding-game/shared";
import { fetchAdminInvitationAnalytics } from "../api/invitationAnalyticsApi";
import { createAdminSession, WeddingApiError, type AdminSession } from "../api/weddingApi";
import { downloadInvitationAnalyticsCsv } from "../invitation/analyticsCsv";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "../invitation/rsvpStorage";
import "../analytics-admin.css";

type RangePreset = "7" | "30" | "90" | "all";

const rangeOptions: Array<{ value: RangePreset; label: string }> = [
  { value: "7", label: "7일" },
  { value: "30", label: "30일" },
  { value: "90", label: "90일" },
  { value: "all", label: "전체" }
];

const deviceLabels: Record<string, string> = { mobile: "모바일", tablet: "태블릿", desktop: "데스크톱" };
const modeLabels: Record<string, string> = { game: "게임 정원", simple: "간편 초대장" };
const mapLabels: Record<string, string> = { naver: "네이버지도", kakao: "카카오맵", google: "Google 지도" };
const shareLabels: Record<string, string> = { native: "공유 앱", copy: "링크 복사", fallback: "자동 링크 복사" };
const calendarLabels: Record<string, string> = { ics: "기본 캘린더", google: "Google 캘린더", copy: "일정 복사" };

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function koreaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function subtractDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function rangeQuery(preset: RangePreset): { from?: string; to: string } {
  const to = koreaDate();
  return preset === "all" ? { to } : { from: subtractDays(to, Number(preset) - 1), to };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function percentage(numerator: number, denominator: number): string {
  if (denominator < 1) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function errorMessage(error: unknown): string {
  if (error instanceof WeddingApiError && error.status === 401) return "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (error instanceof WeddingApiError && error.code === "invalid_range") return "조회 기간을 확인해 주세요.";
  return "통계 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function BreakdownList({
  title,
  items,
  labels
}: {
  title: string;
  items: InvitationAnalyticsBreakdown[];
  labels: Record<string, string>;
}) {
  const max = Math.max(1, ...items.map(({ count }) => count));
  return (
    <section className="analytics-breakdown" aria-label={title}>
      <h3>{title}</h3>
      {items.length === 0 ? <p>아직 집계된 데이터가 없습니다.</p> : (
        <ol>
          {items.map((item) => (
            <li key={item.key}>
              <div><span>{labels[item.key] ?? item.key}</span><strong>{formatNumber(item.count)}</strong></div>
              <span className="analytics-breakdown__track" aria-hidden="true">
                <span style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function AnalyticsAdminPage() {
  const id = invitationId();
  const initializedRef = useRef(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [password, setPassword] = useState("");
  const [preset, setPreset] = useState<RangePreset>("30");
  const [analytics, setAnalytics] = useState<InvitationAnalyticsAdminResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const logout = useCallback((message = "") => {
    sessionRef.current = null;
    clearAdminSession(id);
    setSession(null);
    setAnalytics(null);
    setPassword("");
    setLoading(false);
    setError(message);
  }, [id]);

  const loadAnalytics = useCallback(async (token: string, nextPreset: RangePreset) => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminInvitationAnalytics(token, rangeQuery(nextPreset));
      if (sessionRef.current?.token === token) setAnalytics(result);
    } catch (loadError) {
      if (loadError instanceof WeddingApiError && loadError.status === 401) {
        logout(errorMessage(loadError));
        return;
      }
      setError(errorMessage(loadError));
    } finally {
      if (sessionRef.current?.token === token) setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const stored = loadAdminSession(id);
    if (!stored) return;
    sessionRef.current = stored;
    setSession(stored);
    void loadAnalytics(stored.token, "30");
  }, [id, loadAnalytics]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError("");
    try {
      const nextSession = await createAdminSession(password);
      sessionRef.current = nextSession;
      saveAdminSession(id, nextSession);
      setSession(nextSession);
      setPassword("");
      await loadAnalytics(nextSession.token, preset);
    } catch (loginError) {
      setError(loginError instanceof WeddingApiError && loginError.status === 401
        ? "비밀번호를 확인해 주세요."
        : "관리자 로그인에 실패했습니다.");
      setLoading(false);
    }
  }

  function changePreset(nextPreset: RangePreset) {
    setPreset(nextPreset);
    if (sessionRef.current) void loadAnalytics(sessionRef.current.token, nextPreset);
  }

  const recentDays = analytics?.daily.slice(-7) ?? [];
  const maxVisits = Math.max(1, ...recentDays.map((day) => day.visits));
  const repeatRate = analytics ? percentage(analytics.totals.returningVisits, analytics.totals.visits) : "0%";
  const rsvpConversion = analytics ? percentage(analytics.totals.rsvpSubmits, analytics.totals.rsvpViews) : "0%";
  const periodLabel = analytics ? `${analytics.range.from} - ${analytics.range.to}` : "조회 중";
  const metricCards = useMemo(() => analytics ? [
    { label: "방문", value: formatNumber(analytics.totals.visits), detail: `재방문 ${repeatRate}`, icon: Users },
    { label: "모드 진입", value: formatNumber(analytics.totals.gameEntries + analytics.totals.simpleEntries), detail: `게임 ${formatNumber(analytics.totals.gameEntries)} · 간편 ${formatNumber(analytics.totals.simpleEntries)}`, icon: Gamepad2 },
    { label: "참석 답변", value: formatNumber(analytics.totals.rsvpResponses), detail: `예상 참석 ${formatNumber(analytics.totals.attendingGuests)}명`, icon: MousePointerClick },
    { label: "방명록", value: formatNumber(analytics.totals.guestbookMessages), detail: `화면 조회 ${formatNumber(analytics.totals.guestbookViews)}`, icon: MessageCircle },
    { label: "공유", value: formatNumber(analytics.totals.shareClicks), detail: `지도 클릭 ${formatNumber(analytics.totals.mapClicks)}`, icon: Share2 }
  ] : [], [analytics, repeatRate]);

  if (!session) {
    return (
      <main className="rsvp-admin-page">
        <section className="rsvp-admin-login" aria-labelledby="analytics-admin-login-title">
          <BarChart3 aria-hidden="true" />
          <p className="rsvp-admin-eyebrow">PRIVATE ANALYTICS</p>
          <h1 id="analytics-admin-login-title">방문 통계·행동 분석</h1>
          <form onSubmit={handleLogin}>
            <label htmlFor="analytics-admin-password">관리자 비밀번호</label>
            <input id="analytics-admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} required />
            <button type="submit" disabled={loading || !password}>{loading ? "로그인 중" : "로그인"}</button>
          </form>
          {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="rsvp-admin-page analytics-admin-page">
      <div className="rsvp-admin-shell">
        <header className="rsvp-admin-header analytics-admin-header">
          <div>
            <p className="rsvp-admin-eyebrow">MJ CONVENTION · INSIGHTS</p>
            <h1>방문 통계·행동 분석</h1>
            <span>{periodLabel}</span>
          </div>
          <div className="guestbook-admin-header-actions">
            <a className="rsvp-admin-nav-link" href="?admin=release">통합 공개</a>
            <a className="rsvp-admin-nav-link" href="?admin=rsvp">참석 답변</a>
            <a className="rsvp-admin-nav-link" href="?admin=guestbook">방명록</a>
            <button type="button" className="rsvp-admin-secondary" onClick={() => logout()}><LogOut aria-hidden="true" /> 로그아웃</button>
          </div>
        </header>

        <section className="analytics-toolbar" aria-label="통계 조회 설정">
          <div className="analytics-range" role="group" aria-label="조회 기간">
            <CalendarRange aria-hidden="true" />
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={preset === option.value ? "is-active" : ""}
                aria-pressed={preset === option.value}
                onClick={() => changePreset(option.value)}
                disabled={loading}
              >{option.label}</button>
            ))}
          </div>
          <div className="analytics-toolbar__actions">
            <button type="button" className="rsvp-admin-secondary" onClick={() => sessionRef.current && void loadAnalytics(sessionRef.current.token, preset)} disabled={loading}>
              <RefreshCw aria-hidden="true" /> {loading ? "갱신 중" : "새로고침"}
            </button>
            <button type="button" onClick={() => analytics && downloadInvitationAnalyticsCsv(analytics)} disabled={!analytics || loading}>
              <Download aria-hidden="true" /> CSV
            </button>
          </div>
        </section>

        {error && <p className="rsvp-admin-message rsvp-admin-message--error" role="alert">{error}</p>}

        {analytics ? (
          <>
            <section className="analytics-kpis" aria-label="핵심 지표">
              {metricCards.map((metric) => {
                const Icon = metric.icon;
                return <article key={metric.label}><Icon aria-hidden="true" /><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>;
              })}
            </section>

            <section className="analytics-section analytics-trend" aria-labelledby="analytics-trend-title">
              <header><div><p>RECENT TREND</p><h2 id="analytics-trend-title">최근 7일 방문 흐름</h2></div><span>재방문율 {repeatRate}</span></header>
              <div className="analytics-trend__chart" role="img" aria-label="최근 7일 일별 방문 수 막대 차트">
                {recentDays.map((day) => (
                  <div key={day.date} title={`${day.date} 방문 ${day.visits}회`}>
                    <strong>{day.visits}</strong>
                    <span><i style={{ height: `${day.visits === 0 ? 3 : Math.max(10, (day.visits / maxVisits) * 100)}%` }} /></span>
                    <small>{day.date.slice(5).replace("-", ".")}</small>
                  </div>
                ))}
              </div>
            </section>

            <div className="analytics-primary-grid">
              <section className="analytics-section analytics-funnel" aria-labelledby="analytics-funnel-title">
                <header><div><p>RSVP FUNNEL</p><h2 id="analytics-funnel-title">참석 답변 전환</h2></div><span>완료율 {rsvpConversion}</span></header>
                {[
                  ["답변 화면 조회", analytics.totals.rsvpViews],
                  ["작성 시작", analytics.totals.rsvpStarts],
                  ["전송 완료", analytics.totals.rsvpSubmits]
                ].map(([label, value], index) => (
                  <div className="analytics-funnel__step" key={label as string}>
                    <span>{index + 1}</span><strong>{label}</strong><em>{formatNumber(value as number)}</em>
                    <i aria-hidden="true" style={{ width: `${Math.max((value as number) > 0 ? 6 : 0, ((value as number) / Math.max(1, analytics.totals.rsvpViews)) * 100)}%` }} />
                  </div>
                ))}
                <p>실제 저장된 답변 {formatNumber(analytics.totals.rsvpResponses)}건은 기존 응답을 포함하며, 행동 전환 지표는 통계 기능 적용 이후부터 집계됩니다.</p>
              </section>

              <section className="analytics-section analytics-actions" aria-labelledby="analytics-actions-title">
                <header><div><p>ENGAGEMENT</p><h2 id="analytics-actions-title">주요 행동</h2></div></header>
                <dl>
                  <div><MapPin aria-hidden="true" /><dt>오시는 길 조회</dt><dd>{formatNumber(analytics.totals.directionsViews)}</dd></div>
                  <div><MousePointerClick aria-hidden="true" /><dt>지도 클릭</dt><dd>{formatNumber(analytics.totals.mapClicks)}</dd></div>
                  <div><Share2 aria-hidden="true" /><dt>초대장 공유</dt><dd>{formatNumber(analytics.totals.shareClicks)}</dd></div>
                  <div><BookOpen aria-hidden="true" /><dt>사진 확대</dt><dd>{formatNumber(analytics.totals.galleryZooms)}</dd></div>
                </dl>
              </section>
            </div>

            <section className="analytics-breakdown-grid" aria-label="행동별 분포">
              <BreakdownList title="접속 기기" items={analytics.breakdowns.devices} labels={deviceLabels} />
              <BreakdownList title="초대장 모드" items={analytics.breakdowns.modes} labels={modeLabels} />
              <BreakdownList title="지도 선택" items={analytics.breakdowns.maps} labels={mapLabels} />
              <BreakdownList title="공유 방식" items={analytics.breakdowns.shares} labels={shareLabels} />
              <BreakdownList title="캘린더 저장" items={analytics.breakdowns.calendars} labels={calendarLabels} />
            </section>

            <section className="analytics-quality" aria-labelledby="analytics-quality-title">
              <Gauge aria-hidden="true" />
              <div><p>EXPERIENCE QUALITY</p><h2 id="analytics-quality-title">로딩·오류 상태</h2><span>표본 {formatNumber(analytics.totals.pageLoadSamples)}회 · 평균 {analytics.totals.averagePageLoadMs === null ? "집계 전" : `${(analytics.totals.averagePageLoadMs / 1000).toFixed(1)}초`}</span></div>
              <strong className={analytics.totals.clientErrors > 0 ? "has-errors" : ""}><AlertTriangle aria-hidden="true" /> 오류 {formatNumber(analytics.totals.clientErrors)}건</strong>
            </section>

            <footer className="analytics-privacy-note">
              <span>마지막 집계 {formatDateTime(analytics.generatedAt)}</span>
              <p>IP 주소나 개인별 행동 로그는 저장하지 않습니다. 날짜·행동·기기 유형별 합계만 집계하며 재방문은 해당 기기의 로컬 상태로 판단합니다.</p>
            </footer>
          </>
        ) : <p className="analytics-loading" role="status">통계를 불러오고 있습니다.</p>}
      </div>
    </main>
  );
}

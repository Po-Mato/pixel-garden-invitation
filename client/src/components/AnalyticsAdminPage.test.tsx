import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvitationAnalyticsAdminResponse } from "@wedding-game/shared";
import { AnalyticsAdminPage } from "./AnalyticsAdminPage";

const analyticsApi = vi.hoisted(() => ({
  fetchAdminInvitationAnalytics: vi.fn(),
  updateAdminInvitationPerformanceMode: vi.fn()
}));
const authApi = vi.hoisted(() => ({ createAdminSession: vi.fn() }));
const storage = vi.hoisted(() => ({
  loadAdminSession: vi.fn(),
  saveAdminSession: vi.fn(),
  clearAdminSession: vi.fn()
}));

vi.mock("../api/invitationAnalyticsApi", () => analyticsApi);
vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  createAdminSession: authApi.createAdminSession
}));
vi.mock("../invitation/rsvpStorage", () => storage);

const session = { token: "admin-token", expiresAt: Date.now() + 60_000 };

function result(): InvitationAnalyticsAdminResponse {
  return {
    range: { from: "2026-07-16", to: "2026-07-22", days: 7 },
    totals: {
      visits: 10, returningVisits: 4, gameEntries: 6, simpleEntries: 4,
      directionsViews: 7, mapClicks: 5, callClicks: 1, shareClicks: 3, calendarClicks: 2,
      rsvpViews: 8, rsvpStarts: 6, rsvpSubmits: 4, rsvpResponses: 5, attendingGuests: 9,
      guestbookViews: 6, guestbookMessages: 3, galleryViews: 8, galleryZooms: 5,
      clientErrors: 1, pageLoadSamples: 10, averagePageLoadMs: 1400,
      fpsSamples: 4, averageFps: 54, longTaskCount: 2, averageLongTaskMs: 82,
      qualityDowngrades: 1, qualityRecoveries: 1, deviceQaReports: 8, deviceQaIssues: 2
    },
    performance: {
      mode: "adaptive",
      effective: {
        version: 1, source: "observed", sampleCount: 30, observedAverageFps: 50,
        slowFpsThreshold: 41, recoveryFpsThreshold: 49,
        slowWindowsRequired: 2, recoveryWindowsRequired: 4,
        generatedAt: "2026-07-22T03:00:00.000Z"
      },
      adaptive: {
        version: 1, source: "observed", sampleCount: 30, observedAverageFps: 50,
        slowFpsThreshold: 41, recoveryFpsThreshold: 49,
        slowWindowsRequired: 2, recoveryWindowsRequired: 4,
        generatedAt: "2026-07-22T03:00:00.000Z"
      },
      updatedAt: null
    },
    daily: Array.from({ length: 7 }, (_, index) => ({
      date: `2026-07-${String(16 + index).padStart(2, "0")}`,
      visits: index + 1,
      returningVisits: index % 2,
      gameEntries: 1,
      simpleEntries: 1,
      rsvpResponses: index === 6 ? 1 : 0,
      guestbookMessages: 0,
      shares: 1,
      clientErrors: 0,
      deviceQaReports: index < 4 ? 1 : 0,
      deviceQaIssues: index === 6 ? 1 : 0
    })),
    breakdowns: {
      devices: [{ key: "mobile", count: 8 }, { key: "desktop", count: 2 }],
      modes: [{ key: "game", count: 6 }, { key: "simple", count: 4 }],
      maps: [{ key: "naver", count: 5 }],
      shares: [{ key: "copy", count: 3 }],
      calendars: [{ key: "ics", count: 2 }],
      qualityModes: [{ key: "lite:frame-rate", count: 1 }],
      deviceQaDevices: [{ key: "ios:complete", count: 5 }, { key: "android:warning", count: 3 }],
      deviceQaIssues: [{ key: "android:layout", count: 2 }]
    },
    generatedAt: "2026-07-22T03:00:00.000Z"
  };
}

describe("AnalyticsAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.loadAdminSession.mockReturnValue(null);
    storage.saveAdminSession.mockReturnValue(true);
    storage.clearAdminSession.mockReturnValue(true);
    authApi.createAdminSession.mockResolvedValue(session);
    analyticsApi.fetchAdminInvitationAnalytics.mockResolvedValue(result());
    analyticsApi.updateAdminInvitationPerformanceMode.mockResolvedValue({
      ...result().performance,
      mode: "safe-default",
      effective: { ...result().performance.effective, source: "default", slowFpsThreshold: 42, recoveryFpsThreshold: 52 },
      updatedAt: "2026-07-22T04:00:00.000Z"
    });
  });

  afterEach(cleanup);

  async function login() {
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("heading", { name: "최근 7일 방문 흐름" });
  }

  it("로그인 후 핵심 지표와 RSVP 전환을 표시한다", async () => {
    render(<AnalyticsAdminPage />);
    await login();
    expect(screen.getByText("재방문 40%")).toBeInTheDocument();
    expect(screen.getByText("예상 참석 9명")).toBeInTheDocument();
    expect(screen.getByText("완료율 50%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "로딩·게임 성능" })).toBeInTheDocument();
    expect(screen.getByText(/FPS 표본 4회/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "실기기 성능 기준 운영" })).toBeInTheDocument();
    expect(screen.getByText("실측 표본 자동 보정 중")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "실제 휴대폰 점검 현황" })).toBeInTheDocument();
    expect(screen.getByText("8회 점검 · 2건 불편")).toBeInTheDocument();
    expect(screen.getByText("비교 가능한 표본을 더 모으는 중입니다")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "기기 QA 이상 알림" })).toHaveTextContent("새로운 기기 이상 추세 없음");
    expect(screen.getByLabelText("알림 기준")).toHaveValue("regression");
    expect(screen.getByRole("region", { name: "기기별 QA 상세 분석" })).toHaveTextContent("서버 집계 알림 연결");
    expect(screen.getByRole("region", { name: "기기별 QA 상세 분석" })).toHaveTextContent("Android");
    expect(screen.getByRole("region", { name: "기기별 QA 상세 분석" })).toHaveTextContent("화면 배치 2");
  });

  it("기간 버튼을 바꾸면 해당 기간으로 다시 조회한다", async () => {
    render(<AnalyticsAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: "7일" }));
    await waitFor(() => expect(analyticsApi.fetchAdminInvitationAnalytics).toHaveBeenCalledTimes(2));
    expect(analyticsApi.fetchAdminInvitationAnalytics).toHaveBeenLastCalledWith(
      "admin-token",
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) })
    );
  });

  it("안정 기본값으로 즉시 전환하고 상태를 갱신한다", async () => {
    render(<AnalyticsAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: "안정 기본값으로 즉시 전환" }));
    await waitFor(() => expect(analyticsApi.updateAdminInvitationPerformanceMode)
      .toHaveBeenCalledWith("admin-token", "safe-default"));
    expect(await screen.findByText("안정 기본값으로 즉시 전환했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "자동 보정 다시 사용" })).toBeInTheDocument();
  });
});

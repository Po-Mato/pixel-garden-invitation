import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvitationAnalyticsAdminResult } from "@wedding-game/shared";
import { AnalyticsAdminPage } from "./AnalyticsAdminPage";

const analyticsApi = vi.hoisted(() => ({ fetchAdminInvitationAnalytics: vi.fn() }));
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

function result(): InvitationAnalyticsAdminResult {
  return {
    range: { from: "2026-07-16", to: "2026-07-22", days: 7 },
    totals: {
      visits: 10, returningVisits: 4, gameEntries: 6, simpleEntries: 4,
      directionsViews: 7, mapClicks: 5, callClicks: 1, shareClicks: 3, calendarClicks: 2,
      rsvpViews: 8, rsvpStarts: 6, rsvpSubmits: 4, rsvpResponses: 5, attendingGuests: 9,
      guestbookViews: 6, guestbookMessages: 3, galleryViews: 8, galleryZooms: 5,
      clientErrors: 1, pageLoadSamples: 10, averagePageLoadMs: 1400
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
      clientErrors: 0
    })),
    breakdowns: {
      devices: [{ key: "mobile", count: 8 }, { key: "desktop", count: 2 }],
      modes: [{ key: "game", count: 6 }, { key: "simple", count: 4 }],
      maps: [{ key: "naver", count: 5 }],
      shares: [{ key: "copy", count: 3 }],
      calendars: [{ key: "ics", count: 2 }]
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
    expect(screen.getByRole("heading", { name: "로딩·오류 상태" })).toBeInTheDocument();
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
});

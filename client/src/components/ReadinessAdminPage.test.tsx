import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WeddingApiError } from "../api/weddingApi";
import { ReadinessAdminPage } from "./ReadinessAdminPage";

const api = vi.hoisted(() => ({
  createAdminSession: vi.fn(),
  fetchAdminRsvps: vi.fn(),
  fetchAdminGuestbook: vi.fn(),
  fetchAdminNotifications: vi.fn()
}));

const storage = vi.hoisted(() => ({
  loadAdminSession: vi.fn(),
  saveAdminSession: vi.fn(),
  clearAdminSession: vi.fn()
}));

vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  ...api
}));
vi.mock("../invitation/rsvpStorage", () => storage);

const session = { token: "admin-token", expiresAt: Date.now() + 60_000 };
const rsvpResult = {
  summary: {
    responseCount: 3,
    attendingResponseCount: 2,
    attendingPartySize: 4,
    mealPartySize: 3,
    declinedResponseCount: 1,
    unsureResponseCount: 0,
    unsurePartySize: 0,
    deleteAt: "2027-05-31T14:59:59.000Z"
  },
  responses: []
};
const guestbookResult = {
  summary: {
    totalCount: 2,
    visibleCount: 2,
    hiddenCount: 0,
    deleteAt: "2027-05-31T14:59:59.000Z"
  },
  messages: []
};
const notificationResult = {
  notifications: [],
  unreadCount: 1,
  emailConfigured: false,
  emailPendingCount: 0,
  emailFailedCount: 0,
  lastEmailSentAt: null,
  spamProtection: {
    turnstileConfigured: false,
    blockedToday: 0,
    recentBlocks: []
  }
};

describe("ReadinessAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.loadAdminSession.mockReturnValue(null);
    storage.saveAdminSession.mockReturnValue(true);
    storage.clearAdminSession.mockReturnValue(true);
    api.createAdminSession.mockResolvedValue(session);
    api.fetchAdminRsvps.mockResolvedValue(rsvpResult);
    api.fetchAdminGuestbook.mockResolvedValue(guestbookResult);
    api.fetchAdminNotifications.mockResolvedValue(notificationResult);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  async function login() {
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("heading", { name: "공개 준비도 53%" });
  }

  it("관리자 인증 후 정적 콘텐츠와 실제 운영 상태를 함께 점검한다", async () => {
    render(<ReadinessAdminPage />);
    await login();

    expect(storage.saveAdminSession).toHaveBeenCalledWith("sample-garden", session);
    expect(api.fetchAdminRsvps).toHaveBeenCalledWith("admin-token");
    expect(api.fetchAdminGuestbook).toHaveBeenCalledWith("admin-token");
    expect(api.fetchAdminNotifications).toHaveBeenCalledWith("admin-token");
    expect(screen.getByText("완료 0/6건 · 성함과 전화번호를 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("Turnstile 운영 키와 검증 Worker 연결이 필요합니다.")).toBeInTheDocument();
    expect(screen.getByText("발신 도메인과 관리자 수신 이메일 연결이 필요합니다.")).toBeInTheDocument();
  });

  it("저장된 관리자 세션으로 바로 점검하고 수동 재점검한다", async () => {
    storage.loadAdminSession.mockReturnValue(session);
    render(<ReadinessAdminPage />);

    expect(await screen.findByRole("heading", { name: "공개 준비도 53%" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 점검" }));
    await waitFor(() => expect(api.fetchAdminRsvps).toHaveBeenCalledTimes(2));
    expect(api.fetchAdminGuestbook).toHaveBeenCalledTimes(2);
    expect(api.fetchAdminNotifications).toHaveBeenCalledTimes(2);
  });

  it("일부 운영 API가 실패하면 해당 항목만 운영 대기로 표시한다", async () => {
    api.fetchAdminRsvps.mockRejectedValue(new Error("network"));
    render(<ReadinessAdminPage />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByText("참석 답변 API 또는 데이터 저장소가 응답하지 않습니다.")).toBeInTheDocument();
    expect(screen.getByText("정상 응답 · 저장된 메시지 2건")).toBeInTheDocument();
  });

  it("인증된 점검 중 401 응답을 받으면 세션을 제거한다", async () => {
    api.fetchAdminGuestbook.mockRejectedValue(new WeddingApiError(401, "unauthorized"));
    storage.loadAdminSession.mockReturnValue(session);
    render(<ReadinessAdminPage />);

    expect(await screen.findByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("세션이 만료되었습니다");
    expect(storage.clearAdminSession).toHaveBeenCalledWith("sample-garden");
  });

  it("로그아웃하면 보호된 점검 결과를 지운다", async () => {
    render(<ReadinessAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "공개 준비도 53%" })).not.toBeInTheDocument();
    expect(storage.clearAdminSession).toHaveBeenCalledWith("sample-garden");
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminNotificationInbox } from "./AdminNotificationInbox";

const api = vi.hoisted(() => ({
  fetchAdminNotifications: vi.fn(),
  markAdminNotificationsRead: vi.fn(),
  retryFailedAdminNotificationEmails: vi.fn()
}));

vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  ...api
}));

const unreadResult = {
  notifications: [{
    id: "notification_1",
    kind: "rsvp_created" as const,
    sourceId: "rsvp_1",
    title: "새 참석 답변",
    body: "김하객 · 신부측 · 참석 · 2명",
    createdAt: "2026-07-21T10:00:00.000Z",
    readAt: null,
    emailStatus: "pending" as const,
    emailAttempts: 0,
    emailSentAt: null
  }],
  unreadCount: 1,
  emailConfigured: false,
  emailPendingCount: 1,
  emailFailedCount: 0,
  lastEmailSentAt: null
};

describe("AdminNotificationInbox", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.fetchAdminNotifications.mockResolvedValue(unreadResult);
    api.markAdminNotificationsRead.mockResolvedValue({
      ...unreadResult,
      notifications: [{ ...unreadResult.notifications[0], readAt: "2026-07-21T10:10:00.000Z" }],
      unreadCount: 0
    });
    api.retryFailedAdminNotificationEmails.mockResolvedValue(unreadResult);
  });

  afterEach(cleanup);

  it("미확인 알림을 표시하고 개별 확인 처리한다", async () => {
    render(<AdminNotificationInbox token="admin-token" onUnauthorized={vi.fn()} />);

    expect(await screen.findByText("김하객 · 신부측 · 참석 · 2명")).toBeInTheDocument();
    expect(screen.getByText("확인하지 않은 알림 1건")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "새 참석 답변 확인 처리" }));

    await waitFor(() => expect(api.markAdminNotificationsRead).toHaveBeenCalledWith(
      "admin-token",
      ["notification_1"]
    ));
    expect(await screen.findByText("확인하지 않은 알림이 없습니다.")).toBeInTheDocument();
  });

  it("전체 확인 요청은 알림 ID 없이 전송한다", async () => {
    render(<AdminNotificationInbox token="admin-token" onUnauthorized={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "전체 확인" }));
    await waitFor(() => expect(api.markAdminNotificationsRead).toHaveBeenCalledWith("admin-token", undefined));
  });

  it("이메일 최종 실패를 운영자가 다시 시도한다", async () => {
    const failedResult = {
      ...unreadResult,
      emailConfigured: true,
      emailPendingCount: 0,
      emailFailedCount: 1,
      notifications: [{
        ...unreadResult.notifications[0],
        emailStatus: "failed" as const,
        emailAttempts: 5
      }]
    };
    api.fetchAdminNotifications.mockResolvedValue(failedResult);
    api.retryFailedAdminNotificationEmails.mockResolvedValue({
      ...failedResult,
      emailPendingCount: 1,
      emailFailedCount: 0,
      notifications: [{
        ...failedResult.notifications[0],
        emailStatus: "pending" as const,
        emailAttempts: 0
      }]
    });
    render(<AdminNotificationInbox token="admin-token" onUnauthorized={vi.fn()} />);

    expect(await screen.findByText("이메일 발송 실패 1건 · 설정 확인 필요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "실패 재시도" }));
    await waitFor(() => expect(api.retryFailedAdminNotificationEmails).toHaveBeenCalledWith("admin-token"));
    expect(await screen.findByText("이메일 발송 대기·재시도 1건")).toBeInTheDocument();
  });
});

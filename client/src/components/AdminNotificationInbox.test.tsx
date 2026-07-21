import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminNotificationInbox } from "./AdminNotificationInbox";

const api = vi.hoisted(() => ({
  fetchAdminNotifications: vi.fn(),
  markAdminNotificationsRead: vi.fn()
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
    readAt: null
  }],
  unreadCount: 1,
  emailConfigured: false
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
});

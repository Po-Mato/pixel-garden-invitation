import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuestbookAdminPage } from "./GuestbookAdminPage";

const api = vi.hoisted(() => ({
  createAdminSession: vi.fn(),
  fetchAdminGuestbook: vi.fn(),
  moderateAdminGuestbook: vi.fn(),
  updateAdminGuestbook: vi.fn(),
  deleteAdminGuestbook: vi.fn()
}));

const csv = vi.hoisted(() => ({ downloadGuestbookCsv: vi.fn() }));

vi.mock("../invitation/guestbookCsv", () => csv);

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
const message = {
  id: "guestbook_1",
  nickname: "하객1",
  message: "결혼을 축하합니다",
  isHidden: false,
  revision: 1,
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z"
};
const result = {
  summary: {
    totalCount: 1,
    visibleCount: 1,
    hiddenCount: 0,
    deleteAt: "2027-05-31T14:59:59.000Z"
  },
  messages: [message]
};

describe("GuestbookAdminPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    storage.loadAdminSession.mockReturnValue(null);
    api.createAdminSession.mockResolvedValue(session);
    api.fetchAdminGuestbook.mockResolvedValue(result);
    api.moderateAdminGuestbook.mockResolvedValue({ ...message, isHidden: true, revision: 2 });
    api.updateAdminGuestbook.mockResolvedValue({ ...message, nickname: "수정 하객", message: "수정 축하", revision: 2 });
    api.deleteAdminGuestbook.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("관리자 비밀번호로 로그인해 현황과 메시지를 조회한다", async () => {
    render(<GuestbookAdminPage />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("heading", { name: "전체 메시지" })).toBeInTheDocument();
    expect(screen.getByText("결혼을 축하합니다")).toBeInTheDocument();
    expect(api.createAdminSession).toHaveBeenCalledWith("password");
    expect(storage.saveAdminSession).toHaveBeenCalledWith("sample-garden", session);
  });

  it("저장된 세션으로 메시지를 비공개 처리한다", async () => {
    storage.loadAdminSession.mockReturnValue(session);
    render(<GuestbookAdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "비공개" }));
    await waitFor(() => expect(api.moderateAdminGuestbook).toHaveBeenCalledWith(
      "admin-token",
      "guestbook_1",
      true,
      1
    ));
  });

  it("삭제 확인 후 관리자 메시지를 영구 삭제한다", async () => {
    storage.loadAdminSession.mockReturnValue(session);
    render(<GuestbookAdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "하객1 메시지 삭제" }));
    expect(screen.getByText("영구 삭제할까요?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(api.deleteAdminGuestbook).toHaveBeenCalledWith("admin-token", "guestbook_1"));
  });

  it("관리자가 작성자와 메시지를 수정한 뒤 전체 목록을 다시 불러온다", async () => {
    const updated = { ...message, nickname: "수정 하객", message: "수정 축하", revision: 2 };
    api.fetchAdminGuestbook.mockResolvedValueOnce(result).mockResolvedValueOnce({
      ...result,
      messages: [updated]
    });
    storage.loadAdminSession.mockReturnValue(session);
    render(<GuestbookAdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByRole("textbox", { name: "작성자" }), { target: { value: "수정 하객" } });
    fireEvent.change(screen.getByRole("textbox", { name: /메시지/ }), { target: { value: "수정 축하" } });
    fireEvent.click(screen.getByRole("button", { name: "변경 저장" }));

    await waitFor(() => expect(api.updateAdminGuestbook).toHaveBeenCalledWith("admin-token", "guestbook_1", {
      nickname: "수정 하객",
      message: "수정 축하",
      revision: 1
    }));
    expect(await screen.findByText("수정 축하")).toBeInTheDocument();
  });

  it("방명록 전체 결과를 CSV로 저장한다", async () => {
    storage.loadAdminSession.mockReturnValue(session);
    render(<GuestbookAdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "CSV 저장" }));
    expect(csv.downloadGuestbookCsv).toHaveBeenCalledWith(result);
  });
});

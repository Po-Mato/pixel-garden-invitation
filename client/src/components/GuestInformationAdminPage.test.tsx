import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuestInformationAdminPage } from "./GuestInformationAdminPage";

const api = vi.hoisted(() => ({
  createAdminSession: vi.fn(),
  createAdminGuestAnnouncement: vi.fn(),
  createAdminGuestFaq: vi.fn(),
  deleteAdminGuestInformationItem: vi.fn(),
  fetchAdminGuestInformation: vi.fn(),
  updateAdminGuestAnnouncement: vi.fn(),
  updateAdminGuestFaq: vi.fn()
}));

const storage = vi.hoisted(() => ({
  loadAdminSession: vi.fn(),
  saveAdminSession: vi.fn(),
  clearAdminSession: vi.fn()
}));

vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  createAdminSession: api.createAdminSession
}));

vi.mock("../api/guestInformationApi", () => ({
  createAdminGuestAnnouncement: api.createAdminGuestAnnouncement,
  createAdminGuestFaq: api.createAdminGuestFaq,
  deleteAdminGuestInformationItem: api.deleteAdminGuestInformationItem,
  fetchAdminGuestInformation: api.fetchAdminGuestInformation,
  updateAdminGuestAnnouncement: api.updateAdminGuestAnnouncement,
  updateAdminGuestFaq: api.updateAdminGuestFaq
}));

vi.mock("../invitation/rsvpStorage", () => storage);

const session = { token: "admin-token", expiresAt: Date.now() + 60_000 };
const announcement = {
  id: "notice_1",
  title: "주차장 혼잡 안내",
  body: "예식 30분 전 도착을 권장합니다.",
  tone: "urgent" as const,
  active: true,
  pinned: true,
  startsAt: null,
  endsAt: null,
  actionKind: "directions" as const,
  actionLabel: "길 찾기",
  actionUrl: null,
  sortOrder: 10,
  viewCount: 4,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z"
};
const faq = {
  id: "faq_1",
  category: "교통·주차",
  question: "주차는 가능한가요?",
  answer: "2시간 무료 주차가 가능합니다.",
  active: true,
  featured: true,
  sortOrder: 10,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z"
};
const result = {
  announcements: [announcement],
  faqs: [faq],
  generatedAt: "2026-07-22T00:00:00.000Z",
  summary: {
    totalAnnouncements: 1,
    activeAnnouncements: 1,
    urgentAnnouncements: 1,
    totalFaqs: 1,
    activeFaqs: 1,
    announcementViews: 4
  }
};

describe("GuestInformationAdminPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    storage.loadAdminSession.mockReturnValue(null);
    api.createAdminSession.mockResolvedValue(session);
    api.fetchAdminGuestInformation.mockResolvedValue(result);
    api.createAdminGuestAnnouncement.mockResolvedValue(announcement);
    api.createAdminGuestFaq.mockResolvedValue(faq);
    api.updateAdminGuestAnnouncement.mockResolvedValue(announcement);
    api.updateAdminGuestFaq.mockResolvedValue(faq);
    api.deleteAdminGuestInformationItem.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it("관리자 비밀번호로 로그인해 공개 현황과 항목을 조회한다", async () => {
    render(<GuestInformationAdminPage />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("heading", { name: "공개 현황" })).toBeInTheDocument();
    expect(screen.getByText("주차장 혼잡 안내")).toBeInTheDocument();
    expect(api.createAdminSession).toHaveBeenCalledWith("password");
    expect(storage.saveAdminSession).toHaveBeenCalledWith("sample-garden", session);
  });

  it("새 공지를 등록하고 목록을 다시 불러온다", async () => {
    storage.loadAdminSession.mockReturnValue(session);
    render(<GuestInformationAdminPage />);
    await screen.findByText("주차장 혼잡 안내");

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "셔틀 운행 안내" } });
    fireEvent.change(screen.getByLabelText(/^내용/), { target: { value: "소사역에서 셔틀이 운행됩니다." } });
    fireEvent.click(screen.getByRole("button", { name: "공지 등록" }));

    await waitFor(() => expect(api.createAdminGuestAnnouncement).toHaveBeenCalledWith("admin-token", expect.objectContaining({
      title: "셔틀 운행 안내",
      body: "소사역에서 셔틀이 운행됩니다.",
      startsAt: null,
      endsAt: null
    })));
    expect(api.fetchAdminGuestInformation).toHaveBeenCalledTimes(2);
  });

  it("FAQ 공개 상태를 전환한다", async () => {
    storage.loadAdminSession.mockReturnValue(session);
    render(<GuestInformationAdminPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "FAQ 1" }));
    fireEvent.click(screen.getByRole("button", { name: "비공개" }));

    await waitFor(() => expect(api.updateAdminGuestFaq).toHaveBeenCalledWith("admin-token", "faq_1", {
      category: "교통·주차",
      question: "주차는 가능한가요?",
      answer: "2시간 무료 주차가 가능합니다.",
      active: false,
      featured: true,
      sortOrder: 10
    }));
  });

  it("삭제 확인 후 FAQ를 삭제한다", async () => {
    storage.loadAdminSession.mockReturnValue(session);
    render(<GuestInformationAdminPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "FAQ 1" }));
    fireEvent.click(screen.getByRole("button", { name: "주차는 가능한가요? FAQ 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(api.deleteAdminGuestInformationItem).toHaveBeenCalledWith("admin-token", "faqs", "faq_1"));
  });
});

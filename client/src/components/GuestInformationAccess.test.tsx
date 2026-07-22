import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuestInformationAccess, resetGuestInformationCacheForTest } from "./GuestInformationAccess";

const api = vi.hoisted(() => ({
  fetchGuestInformation: vi.fn(),
  recordGuestInformationViews: vi.fn()
}));

vi.mock("../api/guestInformationApi", () => api);

const result = {
  generatedAt: "2027-05-01T08:00:00.000Z",
  announcements: [{
    id: "notice_1",
    title: "주차장 혼잡 안내",
    body: "지하 주차장 입구가 혼잡합니다.",
    tone: "urgent" as const,
    active: true,
    pinned: true,
    startsAt: null,
    endsAt: null,
    actionKind: "directions" as const,
    actionLabel: "길 찾기",
    actionUrl: null,
    sortOrder: 1,
    viewCount: 0,
    createdAt: "2027-05-01T00:00:00.000Z",
    updatedAt: "2027-05-01T00:00:00.000Z"
  }],
  faqs: [{
    id: "faq_1",
    category: "교통·주차",
    question: "주차는 가능한가요?",
    answer: "2시간 무료 주차가 가능합니다.",
    active: true,
    featured: true,
    sortOrder: 1,
    createdAt: "2027-05-01T00:00:00.000Z",
    updatedAt: "2027-05-01T00:00:00.000Z"
  }]
};

describe("GuestInformationAccess", () => {
  beforeEach(() => {
    resetGuestInformationCacheForTest();
    sessionStorage.clear();
    api.fetchGuestInformation.mockReset().mockResolvedValue(result);
    api.recordGuestInformationViews.mockReset().mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it("입장 화면에서 긴급 공지를 우선 표시하고 공지·FAQ 시트를 연다", async () => {
    render(<GuestInformationAccess variant="entry" />);
    const trigger = await screen.findByRole("button", { name: /주차장 혼잡 안내/ });
    expect(trigger).toHaveTextContent("긴급 공지");
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "공지·자주 묻는 질문" });
    expect(dialog).toHaveTextContent("지하 주차장 입구가 혼잡합니다.");
    expect(dialog).toHaveTextContent("주차는 가능한가요?");
    expect(within(dialog).getByRole("link", { name: "길 찾기" })).toHaveAttribute("href", expect.stringContaining("naver.com"));
    await waitFor(() => expect(api.recordGuestInformationViews).toHaveBeenCalledWith(["notice_1"]));
  });

  it("같은 세션에서는 공지 조회를 한 번만 기록한다", async () => {
    const first = render(<GuestInformationAccess variant="quick" />);
    fireEvent.click(await screen.findByRole("button", { name: "공지·FAQ 열기" }));
    await waitFor(() => expect(api.recordGuestInformationViews).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    first.unmount();

    render(<GuestInformationAccess variant="quick" />);
    fireEvent.click(await screen.findByRole("button", { name: "공지·FAQ 열기" }));
    expect(api.recordGuestInformationViews).toHaveBeenCalledTimes(1);
  });

  it("공개 정보가 비어 있으면 진입 버튼을 숨긴다", async () => {
    api.fetchGuestInformation.mockResolvedValueOnce({ announcements: [], faqs: [], generatedAt: "now" });
    render(<GuestInformationAccess variant="world" />);
    await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument());
  });
});

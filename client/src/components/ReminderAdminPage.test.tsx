import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReminderAdminPage } from "./ReminderAdminPage";

const api = vi.hoisted(() => ({
  createAdminSession: vi.fn(),
  fetchAdminRsvps: vi.fn(),
  fetchAdminInvitationInviteLinks: vi.fn(),
  rotateAdminInvitationInviteLink: vi.fn(),
  updateAdminInvitationInviteLink: vi.fn(),
  fetchAdminInvitationReminders: vi.fn(),
  recordAdminInvitationReminders: vi.fn()
}));
const storage = vi.hoisted(() => ({
  loadAdminSession: vi.fn(),
  saveAdminSession: vi.fn(),
  clearAdminSession: vi.fn()
}));
const tokenStorage = vi.hoisted(() => ({
  loadAdminInviteLinkTokens: vi.fn(),
  saveAdminInviteLinkTokens: vi.fn(),
  clearAdminInviteLinkTokens: vi.fn()
}));
const browser = vi.hoisted(() => ({
  copyText: vi.fn(),
  shareContent: vi.fn(),
  isShareAbortError: vi.fn(() => false),
  NativeShareUnavailableError: class NativeShareUnavailableError extends Error {}
}));

vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  createAdminSession: api.createAdminSession,
  fetchAdminRsvps: api.fetchAdminRsvps
}));
vi.mock("../api/invitationInviteLinksApi", () => ({
  fetchAdminInvitationInviteLinks: api.fetchAdminInvitationInviteLinks,
  rotateAdminInvitationInviteLink: api.rotateAdminInvitationInviteLink,
  updateAdminInvitationInviteLink: api.updateAdminInvitationInviteLink
}));
vi.mock("../api/invitationRemindersApi", () => ({
  fetchAdminInvitationReminders: api.fetchAdminInvitationReminders,
  recordAdminInvitationReminders: api.recordAdminInvitationReminders
}));
vi.mock("../invitation/rsvpStorage", () => storage);
vi.mock("../invitation/inviteLinkAdminTokens", () => tokenStorage);
vi.mock("../invitation/browserActions", () => browser);

const session = { token: "admin-token", expiresAt: Date.now() + 60_000 };
const link = {
  id: "invite_abc",
  guestName: "김하객",
  side: "bride" as const,
  groupLabel: "대학 친구",
  active: true,
  deliveryChannel: "kakao" as const,
  sendCount: 1,
  firstSentAt: "2027-03-01T00:00:00.000Z",
  lastSentAt: "2027-03-01T00:00:00.000Z",
  deliveryNote: "",
  openCount: 1,
  firstOpenedAt: "2027-03-01T00:00:00.000Z",
  lastOpenedAt: "2027-03-01T00:00:00.000Z",
  respondedAt: null,
  rsvpId: null,
  followUpCompletedAt: null,
  createdAt: "2027-03-01T00:00:00.000Z",
  updatedAt: "2027-03-01T00:00:00.000Z"
};
const inviteResult = {
  summary: { total: 1, active: 1, delivered: 1, opened: 1, responded: 0 },
  links: [link]
};
const rsvpResult = {
  summary: { responseCount: 0, attendingResponseCount: 0, attendingPartySize: 0, mealPartySize: 0, declinedResponseCount: 0, unsureResponseCount: 0, unsurePartySize: 0, deleteAt: "2027-05-31T00:00:00.000Z" },
  responses: []
};
const reminderResult = {
  summary: { totalSent: 0, uniqueGuests: 0, lastSentAt: null, byStage: { d30: 0, d14: 0, d7: 0, d1: 0, manual: 0 } },
  events: []
};

describe("ReminderAdminPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    storage.loadAdminSession.mockReturnValue(session);
    tokenStorage.loadAdminInviteLinkTokens.mockReturnValue({ invite_abc: "a".repeat(43) });
    tokenStorage.saveAdminInviteLinkTokens.mockReturnValue({ invite_abc: "b".repeat(43) });
    api.createAdminSession.mockResolvedValue(session);
    api.fetchAdminInvitationInviteLinks.mockResolvedValue(inviteResult);
    api.fetchAdminRsvps.mockResolvedValue(rsvpResult);
    api.fetchAdminInvitationReminders.mockResolvedValue(reminderResult);
    api.recordAdminInvitationReminders.mockResolvedValue(reminderResult);
    api.rotateAdminInvitationInviteLink.mockResolvedValue({ ...inviteResult, created: [{ link, token: "b".repeat(43) }] });
    api.updateAdminInvitationInviteLink.mockResolvedValue({ ...link, followUpCompletedAt: "2027-04-01T00:00:00.000Z" });
    browser.copyText.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => cleanup());

  it("일정별 추천 큐와 미응답 하객을 표시한다", async () => {
    render(<ReminderAdminPage />);
    expect(await screen.findByRole("heading", { name: "권장 발송 일정" })).toBeInTheDocument();
    expect(screen.getByText("김하객")).toBeInTheDocument();
    expect(screen.getByText("열람 후 미응답")).toBeInTheDocument();
    expect(api.fetchAdminInvitationReminders).toHaveBeenCalledWith("admin-token");
  });

  it("선택한 하객의 개인화 문구를 한 번에 복사한다", async () => {
    render(<ReminderAdminPage />);
    fireEvent.click(await screen.findByLabelText("김하객 선택"));
    fireEvent.click(screen.getByRole("button", { name: "문구 묶음 복사" }));
    await waitFor(() => expect(browser.copyText).toHaveBeenCalledWith(expect.stringContaining("김하객님")));
    expect(browser.copyText).toHaveBeenCalledWith(expect.stringContaining("?invite="));
  });

  it("실제 발송 후 단계·채널·메모가 포함된 이력을 기록한다", async () => {
    render(<ReminderAdminPage />);
    fireEvent.click(await screen.findByRole("button", { name: "기록" }));
    fireEvent.click(screen.getByRole("button", { name: "발송 완료 저장" }));
    await waitFor(() => expect(api.recordAdminInvitationReminders).toHaveBeenCalledWith("admin-token", {
      linkIds: ["invite_abc"],
      stage: "d30",
      channel: "kakao",
      note: "30일 전 리마인드"
    }));
  });

  it("링크 원문이 없으면 확인 후 재발급한다", async () => {
    tokenStorage.loadAdminInviteLinkTokens.mockReturnValue({});
    render(<ReminderAdminPage />);
    fireEvent.click(await screen.findByRole("button", { name: "링크 준비" }));
    await waitFor(() => expect(api.rotateAdminInvitationInviteLink).toHaveBeenCalledWith("admin-token", "invite_abc"));
    expect(tokenStorage.saveAdminInviteLinkTokens).toHaveBeenCalled();
  });
});

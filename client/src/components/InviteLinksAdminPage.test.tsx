import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InviteLinksAdminPage } from "./InviteLinksAdminPage";

const api = vi.hoisted(() => ({
  createAdminSession: vi.fn(),
  fetchAdminInvitationInviteLinks: vi.fn(),
  createAdminInvitationInviteLinks: vi.fn(),
  recordAdminInvitationInviteLinkDeliveries: vi.fn(),
  updateAdminInvitationInviteLink: vi.fn(),
  rotateAdminInvitationInviteLink: vi.fn(),
  deleteAdminInvitationInviteLink: vi.fn()
}));
const sessionStorageApi = vi.hoisted(() => ({
  loadAdminSession: vi.fn(),
  saveAdminSession: vi.fn(),
  clearAdminSession: vi.fn()
}));
const tokenStorage = vi.hoisted(() => ({
  loadAdminInviteLinkTokens: vi.fn(),
  saveAdminInviteLinkTokens: vi.fn(),
  removeAdminInviteLinkToken: vi.fn(),
  clearAdminInviteLinkTokens: vi.fn()
}));
const actions = vi.hoisted(() => ({ copyText: vi.fn(), shareContent: vi.fn() }));
const qr = vi.hoisted(() => ({
  buildInvitationInviteUrl: vi.fn((token: string) => `https://invite.test/?invite=${token}`),
  invitationInviteQrDataUrl: vi.fn(),
  downloadInvitationInviteQr: vi.fn()
}));

vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  createAdminSession: api.createAdminSession
}));
vi.mock("../api/invitationInviteLinksApi", () => ({
  fetchAdminInvitationInviteLinks: api.fetchAdminInvitationInviteLinks,
  createAdminInvitationInviteLinks: api.createAdminInvitationInviteLinks,
  recordAdminInvitationInviteLinkDeliveries: api.recordAdminInvitationInviteLinkDeliveries,
  updateAdminInvitationInviteLink: api.updateAdminInvitationInviteLink,
  rotateAdminInvitationInviteLink: api.rotateAdminInvitationInviteLink,
  deleteAdminInvitationInviteLink: api.deleteAdminInvitationInviteLink
}));
vi.mock("../invitation/rsvpStorage", () => sessionStorageApi);
vi.mock("../invitation/inviteLinkAdminTokens", () => tokenStorage);
vi.mock("../invitation/browserActions", async (importOriginal) => ({
  ...await importOriginal<typeof import("../invitation/browserActions")>(),
  copyText: actions.copyText,
  shareContent: actions.shareContent
}));
vi.mock("../invitation/inviteLinkQr", () => qr);

const token = "A".repeat(43);
const link = {
  id: "invite_00000000-0000-4000-8000-000000000001",
  guestName: "김하객",
  side: "bride" as const,
  groupLabel: "대학 친구",
  active: true,
  deliveryChannel: null,
  sendCount: 0,
  firstSentAt: null,
  lastSentAt: null,
  deliveryNote: "",
  openCount: 2,
  firstOpenedAt: "2026-07-22T00:00:00.000Z",
  lastOpenedAt: "2026-07-22T01:00:00.000Z",
  respondedAt: null,
  rsvpId: null,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T01:00:00.000Z"
};
const result = { summary: { total: 1, active: 1, delivered: 0, opened: 1, responded: 0 }, links: [link] };
const createdResult = { ...result, created: [{ link, token }] };

describe("InviteLinksAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/?admin=invites");
    sessionStorageApi.loadAdminSession.mockReturnValue(null);
    sessionStorageApi.saveAdminSession.mockReturnValue(true);
    api.createAdminSession.mockResolvedValue({ token: "admin-token", expiresAt: Date.now() + 60_000 });
    api.fetchAdminInvitationInviteLinks.mockResolvedValue(result);
    api.createAdminInvitationInviteLinks.mockResolvedValue(createdResult);
    api.recordAdminInvitationInviteLinkDeliveries.mockResolvedValue({
      summary: { ...result.summary, delivered: 1 },
      links: [{
        ...link,
        deliveryChannel: "kakao",
        sendCount: 1,
        firstSentAt: "2026-07-22T02:00:00.000Z",
        lastSentAt: "2026-07-22T02:00:00.000Z",
        deliveryNote: "대학 친구 단체방"
      }]
    });
    api.updateAdminInvitationInviteLink.mockResolvedValue({ ...link, active: false });
    api.rotateAdminInvitationInviteLink.mockResolvedValue(createdResult);
    api.deleteAdminInvitationInviteLink.mockResolvedValue(undefined);
    tokenStorage.loadAdminInviteLinkTokens.mockReturnValue({});
    tokenStorage.saveAdminInviteLinkTokens.mockReturnValue({ [link.id]: token });
    tokenStorage.removeAdminInviteLinkToken.mockReturnValue({});
    actions.copyText.mockResolvedValue(undefined);
    actions.shareContent.mockResolvedValue(undefined);
    qr.invitationInviteQrDataUrl.mockResolvedValue("data:image/png;base64,qr");
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  async function login() {
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("heading", { name: "하객별 초대 링크·QR" });
  }

  it("loads privacy-preserving delivery status after administrator login", async () => {
    render(<InviteLinksAdminPage />);
    await login();
    expect(api.fetchAdminInvitationInviteLinks).toHaveBeenCalledWith("admin-token");
    expect(screen.getByText("김하객")).toBeInTheDocument();
    expect(screen.getByText(/링크 원문이 서버에 남아 있지 않습니다/)).toBeInTheDocument();
    expect(within(screen.getByText("전체 하객").closest("article")!).getByText("1")).toBeInTheDocument();
  });

  it("creates a personal link and enables copy and QR actions in the current tab", async () => {
    render(<InviteLinksAdminPage />);
    await login();
    fireEvent.change(screen.getByLabelText("하객 이름"), { target: { value: "김하객" } });
    fireEvent.change(screen.getByLabelText("관계 그룹"), { target: { value: "대학 친구" } });
    fireEvent.click(screen.getByRole("button", { name: "개인 링크 생성" }));
    await screen.findByText("1명의 개인 초대 링크를 생성했습니다.");
    fireEvent.click(screen.getByRole("button", { name: "김하객 초대 링크 복사" }));
    await waitFor(() => expect(actions.copyText).toHaveBeenCalledWith(`https://invite.test/?invite=${token}`));
    fireEvent.click(screen.getByRole("button", { name: "김하객 QR 보기" }));
    expect(await screen.findByRole("dialog", { name: "김하객님 초대 QR" })).toBeInTheDocument();
  });

  it("parses a bulk list and creates every recipient in one request", async () => {
    render(<InviteLinksAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: /여러 명/ }));
    fireEvent.change(screen.getByLabelText("하객 목록"), {
      target: { value: "김하객, 신부측, 친구\n이하객, 신랑측, 직장" }
    });
    fireEvent.click(screen.getByRole("button", { name: "여러 링크 생성" }));
    await waitFor(() => expect(api.createAdminInvitationInviteLinks).toHaveBeenCalledWith("admin-token", [
      { guestName: "김하객", side: "bride", groupLabel: "친구" },
      { guestName: "이하객", side: "groom", groupLabel: "직장" }
    ]));
  });

  it("loads an Excel-compatible CSV into the reviewable bulk form", async () => {
    const { container } = render(<InviteLinksAdminPage />);
    await login();
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["이름,측,그룹\n박하객,신랑측,직장"], "guests.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: vi.fn().mockResolvedValue("이름,측,그룹\n박하객,신랑측,직장")
    });
    fireEvent.change(fileInput, {
      target: { files: [file] }
    });

    expect(await screen.findByText(/1명의 CSV 명단을 불러왔습니다/)).toBeInTheDocument();
    expect(screen.getByLabelText("하객 목록")).toHaveValue("박하객\t신랑측\t직장");
  });

  it("copies a personalized template when the raw token exists in the current tab", async () => {
    tokenStorage.loadAdminInviteLinkTokens.mockReturnValue({ [link.id]: token });
    render(<InviteLinksAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: "김하객 초대 문구 복사" }));
    await waitFor(() => expect(actions.copyText).toHaveBeenCalledWith(expect.stringMatching(
      /김하객님[\s\S]*이건희 · 이승재[\s\S]*https:\/\/invite\.test/
    )));
  });

  it("records a delivery channel, note and recipient selection", async () => {
    render(<InviteLinksAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: "김하객 발송 기록" }));
    const dialog = screen.getByRole("dialog", { name: "1명 발송 기록" });
    fireEvent.change(within(dialog).getByLabelText("관리 메모"), { target: { value: "대학 친구 단체방" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "발송 완료 기록" }));

    await waitFor(() => expect(api.recordAdminInvitationInviteLinkDeliveries).toHaveBeenCalledWith(
      "admin-token",
      { linkIds: [link.id], channel: "kakao", note: "대학 친구 단체방" }
    ));
    expect(await screen.findByText("1명의 발송 이력을 기록했습니다.")).toBeInTheDocument();
  });

  it("can stop an active link without exposing its token", async () => {
    render(<InviteLinksAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: "김하객 링크 중지" }));
    await waitFor(() => expect(api.updateAdminInvitationInviteLink).toHaveBeenCalledWith(
      "admin-token", link.id, { active: false }
    ));
  });
});

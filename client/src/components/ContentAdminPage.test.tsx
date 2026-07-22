import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDefaultEditableInvitationContent,
  invitationContent,
  type EditableInvitationContent,
  type InvitationContentAdminResult
} from "@wedding-game/shared";
import { WeddingApiError } from "../api/weddingApi";
import { ContentAdminPage } from "./ContentAdminPage";

const api = vi.hoisted(() => ({
  createAdminSession: vi.fn(),
  fetchAdminInvitationContent: vi.fn(),
  saveAdminInvitationContent: vi.fn(),
  publishAdminInvitationContent: vi.fn(),
  restoreAdminInvitationContent: vi.fn()
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
vi.mock("../api/invitationContentApi", () => ({
  fetchAdminInvitationContent: api.fetchAdminInvitationContent,
  saveAdminInvitationContent: api.saveAdminInvitationContent,
  publishAdminInvitationContent: api.publishAdminInvitationContent,
  restoreAdminInvitationContent: api.restoreAdminInvitationContent
}));
vi.mock("../invitation/rsvpStorage", () => storage);

const session = { token: "admin-token", expiresAt: Date.now() + 60_000 };

function defaultContent(): EditableInvitationContent {
  return buildDefaultEditableInvitationContent(invitationContent.event, invitationContent.content);
}

function completeContent(): EditableInvitationContent {
  const content = defaultContent();
  content.familyContacts.contacts.forEach((contact, index) => {
    contact.name ||= `혼주 ${index}`;
    contact.phone = `010-1234-12${index}0`;
  });
  content.giftAccounts.accounts.forEach((account, index) => {
    account.name ||= `혼주 ${index}`;
    account.bank = "은행";
    account.accountNumber = `123-${index}`;
    account.holder = `예금주 ${index}`;
  });
  return content;
}

function result(draft: EditableInvitationContent | null = defaultContent(), revision = draft ? 1 : 0): InvitationContentAdminResult {
  return {
    draft,
    revision,
    publishedRevision: null,
    updatedAt: draft ? "2026-07-22T00:00:00.000Z" : null,
    publishedAt: null,
    history: []
  };
}

describe("ContentAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.loadAdminSession.mockReturnValue(null);
    storage.saveAdminSession.mockReturnValue(true);
    storage.clearAdminSession.mockReturnValue(true);
    api.createAdminSession.mockResolvedValue(session);
    api.fetchAdminInvitationContent.mockResolvedValue(result());
    api.saveAdminInvitationContent.mockImplementation(async (_token, content) => result(content, 2));
    api.publishAdminInvitationContent.mockResolvedValue({ ...result(completeContent(), 2), publishedRevision: 2, publishedAt: "2026-07-22T01:00:00.000Z" });
    api.restoreAdminInvitationContent.mockResolvedValue(result(defaultContent(), 3));
  });

  afterEach(cleanup);

  async function login() {
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("heading", { name: "신랑·신부와 혼주 연락처" });
  }

  it("관리자 로그인 후 초안과 공개 차단 항목을 불러온다", async () => {
    render(<ContentAdminPage />);
    await login();

    expect(api.fetchAdminInvitationContent).toHaveBeenCalledWith("admin-token");
    expect(screen.getByText("공개본 없음 · 기존 정적 콘텐츠 사용 중")).toBeInTheDocument();
    expect(screen.getByText(/연락처 6건/)).toBeInTheDocument();
    expect(screen.getByText(/계좌 6건/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "공개 반영" })).toBeDisabled();
  });

  it("입력 변경을 초안으로 저장하고 새 revision을 반영한다", async () => {
    render(<ContentAdminPage />);
    await login();
    const groom = screen.getByRole("group", { name: "신랑" });
    fireEvent.change(within(groom).getByLabelText("전화번호"), { target: { value: "010-1111-2222" } });
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));

    await waitFor(() => expect(api.saveAdminInvitationContent).toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ familyContacts: expect.any(Object) }),
      1
    ));
    expect(await screen.findByText("초안 2번을 저장했습니다.")).toBeInTheDocument();
  });

  it("미리보기에서 공유 이름 토큰을 실제 이름으로 치환한다", async () => {
    render(<ContentAdminPage />);
    await login();
    fireEvent.click(screen.getAllByRole("button", { name: "미리보기" })[1]);

    expect(screen.getByText("이건희 · 이승재 결혼식")).toBeInTheDocument();
    expect(screen.queryByText(/\{names\}/)).not.toBeInTheDocument();
  });

  it("완성되고 저장된 초안만 공개 반영한다", async () => {
    const complete = completeContent();
    api.fetchAdminInvitationContent.mockResolvedValue(result(complete, 2));
    render(<ContentAdminPage />);
    await login();

    const publish = screen.getByRole("button", { name: "공개 반영" });
    expect(publish).toBeEnabled();
    fireEvent.click(publish);
    await waitFor(() => expect(api.publishAdminInvitationContent).toHaveBeenCalledWith("admin-token", 2));
    expect(await screen.findByText("공개본 2번을 반영했습니다.")).toBeInTheDocument();
  });

  it("변경 이력에서 선택한 버전을 확인 후 새 초안으로 복구한다", async () => {
    const version = {
      id: "content_save_1",
      revision: 1,
      action: "save" as const,
      content: defaultContent(),
      createdAt: "2026-07-22T00:00:00.000Z"
    };
    api.fetchAdminInvitationContent.mockResolvedValue({ ...result(), history: [version] });
    render(<ContentAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: "변경 이력" }));
    fireEvent.click(screen.getByRole("button", { name: "이 버전 복구" }));
    fireEvent.click(screen.getByRole("button", { name: "초안으로 복구" }));

    await waitFor(() => expect(api.restoreAdminInvitationContent).toHaveBeenCalledWith("admin-token", "content_save_1", 1));
    expect(await screen.findByText("1번 버전을 새 초안으로 복구했습니다.")).toBeInTheDocument();
  });

  it("낙관적 잠금 충돌을 사용자에게 알린다", async () => {
    api.saveAdminInvitationContent.mockRejectedValue(new WeddingApiError(409, "conflict"));
    render(<ContentAdminPage />);
    await login();
    const groom = screen.getByRole("group", { name: "신랑" });
    fireEvent.change(within(groom).getByLabelText("전화번호"), { target: { value: "010-1111-2222" } });
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("다른 변경이 먼저 저장되었습니다");
  });
});

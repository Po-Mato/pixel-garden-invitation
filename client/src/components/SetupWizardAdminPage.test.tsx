import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDefaultEditableInvitationContent,
  buildDefaultEditableInvitationGallery,
  invitationContent,
  type EditableInvitationContent,
  type InvitationContentAdminResult,
  type InvitationGalleryAdminResult
} from "@wedding-game/shared";
import { SetupWizardAdminPage } from "./SetupWizardAdminPage";

const api = vi.hoisted(() => ({
  createAdminSession: vi.fn(),
  fetchAdminInvitationContent: vi.fn(),
  saveAdminInvitationContent: vi.fn(),
  fetchAdminInvitationGallery: vi.fn()
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
  saveAdminInvitationContent: api.saveAdminInvitationContent
}));
vi.mock("../api/invitationGalleryApi", () => ({
  fetchAdminInvitationGallery: api.fetchAdminInvitationGallery
}));
vi.mock("../invitation/rsvpStorage", () => storage);

const session = { token: "admin-token", expiresAt: Date.now() + 60_000 };

function contentDraft(): EditableInvitationContent {
  return buildDefaultEditableInvitationContent(invitationContent.event, invitationContent.content);
}

function contentResult(draft = contentDraft(), revision = 1): InvitationContentAdminResult {
  return {
    draft,
    revision,
    publishedRevision: null,
    updatedAt: "2026-07-22T00:00:00.000Z",
    publishedAt: null,
    history: []
  };
}

function galleryResult(): InvitationGalleryAdminResult {
  return {
    draft: buildDefaultEditableInvitationGallery(invitationContent.content),
    revision: 1,
    publishedRevision: null,
    updatedAt: "2026-07-22T00:00:00.000Z",
    publishedAt: null,
    history: []
  };
}

describe("SetupWizardAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/?admin=setup");
    storage.loadAdminSession.mockReturnValue(null);
    storage.saveAdminSession.mockReturnValue(true);
    storage.clearAdminSession.mockReturnValue(true);
    api.createAdminSession.mockResolvedValue(session);
    api.fetchAdminInvitationContent.mockResolvedValue(contentResult());
    api.fetchAdminInvitationGallery.mockResolvedValue(galleryResult());
    api.saveAdminInvitationContent.mockImplementation(async (_token, content) => contentResult(content, 2));
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  async function login() {
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("heading", { name: "예식 정보 확인" });
  }

  it("관리자 인증 후 콘텐츠와 사진 초안을 함께 불러온다", async () => {
    render(<SetupWizardAdminPage />);
    await login();

    expect(api.fetchAdminInvitationContent).toHaveBeenCalledWith("admin-token");
    expect(api.fetchAdminInvitationGallery).toHaveBeenCalledWith("admin-token");
    expect(screen.getByText("4 / 8단계 완료")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "실데이터 입력 완료도" })).toHaveAttribute("value", "4");
  });

  it("단계 선택을 URL에 반영하고 입력 변경을 하나의 초안으로 저장한다", async () => {
    render(<SetupWizardAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: /2\. 연락처/ }));
    expect(window.location.search).toContain("step=contacts");
    const groom = screen.getByRole("group", { name: "신랑" });
    fireEvent.change(within(groom).getByLabelText("전화번호"), { target: { value: "010-1111-2222" } });
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));

    await waitFor(() => expect(api.saveAdminInvitationContent).toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ familyContacts: expect.any(Object) }),
      1
    ));
    expect(await screen.findByText("실데이터 초안 2번을 저장했습니다.")).toBeInTheDocument();
  });

  it("사진 단계와 최종 검토에서 기존 관리 화면으로 연결한다", async () => {
    render(<SetupWizardAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: /7\. 웨딩 사진/ }));
    expect(screen.getByText("0 / 10장 완료")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /사진 관리 열기/ })).toHaveAttribute("href", "?admin=gallery");

    fireEvent.click(screen.getByRole("button", { name: /8\. 최종 검토/ }));
    expect(screen.getByText("필수 데이터 보완 필요")).toBeInTheDocument();
    expect(screen.getByText(/연락처 6건 · 계좌 6건 · 웨딩 사진/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /통합 공개로 이동/ })).not.toBeInTheDocument();
  });

  it("저장된 관리자 세션으로 비밀번호 입력 없이 시작한다", async () => {
    storage.loadAdminSession.mockReturnValue(session);
    render(<SetupWizardAdminPage />);

    expect(await screen.findByRole("heading", { name: "예식 정보 확인" })).toBeInTheDocument();
    expect(screen.queryByLabelText("관리자 비밀번호")).not.toBeInTheDocument();
  });
});

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDefaultEditableInvitationGallery,
  invitationContent,
  type EditableInvitationGallery,
  type InvitationGalleryAdminResult
} from "@wedding-game/shared";
import { GalleryAdminPage } from "./GalleryAdminPage";

const api = vi.hoisted(() => ({
  createAdminSession: vi.fn(),
  fetchAdminGalleryAsset: vi.fn(),
  fetchAdminInvitationGallery: vi.fn(),
  publishAdminInvitationGallery: vi.fn(),
  restoreAdminInvitationGallery: vi.fn(),
  saveAdminInvitationGallery: vi.fn(),
  uploadAdminGalleryAsset: vi.fn()
}));
const storage = vi.hoisted(() => ({
  loadAdminSession: vi.fn(),
  saveAdminSession: vi.fn(),
  clearAdminSession: vi.fn()
}));
const processor = vi.hoisted(() => ({
  calculateGalleryCropRect: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
  createGalleryDerivatives: vi.fn(),
  loadGallerySourceImage: vi.fn(),
  validateGallerySourceFile: vi.fn(() => null)
}));

vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  createAdminSession: api.createAdminSession
}));
vi.mock("../api/invitationGalleryApi", () => api);
vi.mock("../invitation/rsvpStorage", () => storage);
vi.mock("../invitation/galleryImageProcessor", () => processor);

const session = { token: "admin-token", expiresAt: Date.now() + 60_000 };

function defaultGallery(): EditableInvitationGallery {
  return buildDefaultEditableInvitationGallery(invitationContent.content);
}

function result(draft: EditableInvitationGallery | null = defaultGallery(), revision = draft ? 1 : 0): InvitationGalleryAdminResult {
  return {
    draft,
    revision,
    publishedRevision: null,
    updatedAt: draft ? "2026-07-22T03:00:00.000Z" : null,
    publishedAt: null,
    history: []
  };
}

describe("GalleryAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.loadAdminSession.mockReturnValue(null);
    storage.saveAdminSession.mockReturnValue(true);
    storage.clearAdminSession.mockReturnValue(true);
    api.createAdminSession.mockResolvedValue(session);
    api.fetchAdminGalleryAsset.mockResolvedValue(new Blob(["preview"], { type: "image/webp" }));
    api.fetchAdminInvitationGallery.mockResolvedValue(result());
    api.saveAdminInvitationGallery.mockImplementation(async (_token, gallery) => result(gallery, 2));
    api.publishAdminInvitationGallery.mockResolvedValue({ ...result(defaultGallery(), 2), publishedRevision: 2 });
    api.restoreAdminInvitationGallery.mockResolvedValue(result(defaultGallery(), 3));
    api.uploadAdminGalleryAsset.mockResolvedValue(undefined);
    processor.loadGallerySourceImage.mockResolvedValue({
      image: {} as HTMLImageElement,
      width: 2000,
      height: 1400,
      dispose: vi.fn()
    });
    processor.createGalleryDerivatives.mockResolvedValue([
      { width: 640, height: 427, blob: new Blob(["small"], { type: "image/webp" }) },
      { width: 1024, height: 683, blob: new Blob(["large"], { type: "image/webp" }) }
    ]);
    vi.stubGlobal("crypto", { ...crypto, randomUUID: () => "12345678-1234-4000-8123-123456789abc" });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function login() {
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("region", { name: "사진 편집 상태" });
  }

  it("관리자 로그인 후 10개 사진 슬롯과 공개 차단 수를 표시한다", async () => {
    render(<GalleryAdminPage />);
    await login();
    expect(screen.getByRole("status")).toHaveTextContent("사진 10장 교체");
    expect(screen.getAllByRole("button", { name: "사진 선택·자르기" })).toHaveLength(10);
    expect(screen.getByRole("button", { name: "공개 반영" })).toBeDisabled();
  });

  it("대체 텍스트 변경을 사진 초안으로 저장한다", async () => {
    render(<GalleryAdminPage />);
    await login();
    const first = screen.getAllByText("대체 텍스트", { exact: false })[0].closest("label")!;
    fireEvent.change(within(first).getByRole("textbox"), { target: { value: "새 대표 사진 설명" } });
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));
    await waitFor(() => expect(api.saveAdminInvitationGallery).toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ photos: expect.arrayContaining([expect.objectContaining({ alt: "새 대표 사진 설명" })]) }),
      1
    ));
  });

  it("사진 선택 후 두 파생본을 업로드하고 초안을 자동 저장한다", async () => {
    render(<GalleryAdminPage />);
    await login();
    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("사진 1 파일 선택"), { target: { files: [file] } });
    expect(await screen.findByRole("dialog", { name: "초점과 자르기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이대로 적용" }));

    await waitFor(() => expect(api.uploadAdminGalleryAsset).toHaveBeenCalledTimes(2));
    expect(api.uploadAdminGalleryAsset).toHaveBeenCalledWith("admin-token", "01-cover", expect.any(String), 640, expect.any(Blob));
    expect(api.saveAdminInvitationGallery).toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ photos: expect.arrayContaining([expect.objectContaining({ assetId: expect.any(String), width: 1024, height: 683 })]) }),
      1
    );
  });

  it("변경 이력에서 선택한 사진 버전을 복구한다", async () => {
    const version = { id: "gallery_save_1", revision: 1, action: "save" as const, gallery: defaultGallery(), createdAt: "2026-07-22T03:00:00.000Z" };
    api.fetchAdminInvitationGallery.mockResolvedValue({ ...result(), history: [version] });
    render(<GalleryAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: "변경 이력" }));
    fireEvent.click(screen.getByRole("button", { name: "이 버전 복구" }));
    fireEvent.click(screen.getByRole("button", { name: "초안으로 복구" }));
    await waitFor(() => expect(api.restoreAdminInvitationGallery).toHaveBeenCalledWith("admin-token", "gallery_save_1", 1));
  });
});

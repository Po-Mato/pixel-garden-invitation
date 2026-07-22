import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDefaultEditableInvitationContent,
  buildDefaultEditableInvitationGallery,
  invitationContent,
  type InvitationContentAdminResult,
  type InvitationGalleryAdminResult,
  type InvitationReleaseAdminResult
} from "@wedding-game/shared";
import { ReleaseAdminPage } from "./ReleaseAdminPage";

const releaseApi = vi.hoisted(() => ({
  fetchAdminInvitationRelease: vi.fn(),
  publishAdminInvitationRelease: vi.fn(),
  scheduleAdminInvitationRelease: vi.fn(),
  cancelAdminInvitationReleaseSchedule: vi.fn(),
  restoreAdminInvitationRelease: vi.fn()
}));
const contentApi = vi.hoisted(() => ({ fetchAdminInvitationContent: vi.fn() }));
const galleryApi = vi.hoisted(() => ({
  fetchAdminInvitationGallery: vi.fn(),
  fetchAdminGalleryAsset: vi.fn(),
  invitationGalleryMediaUrl: vi.fn((assetId: string, width: number) => `/media/${assetId}-${width}.webp`)
}));
const authApi = vi.hoisted(() => ({ createAdminSession: vi.fn() }));
const storage = vi.hoisted(() => ({
  loadAdminSession: vi.fn(),
  saveAdminSession: vi.fn(),
  clearAdminSession: vi.fn()
}));

vi.mock("../api/invitationReleaseApi", () => releaseApi);
vi.mock("../api/invitationContentApi", () => contentApi);
vi.mock("../api/invitationGalleryApi", () => galleryApi);
vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  createAdminSession: authApi.createAdminSession
}));
vi.mock("../invitation/rsvpStorage", () => storage);
vi.mock("./QuickInvitation", () => ({ QuickInvitation: () => <div>최종 초대장 미리보기</div> }));

const session = { token: "admin-token", expiresAt: Date.now() + 60_000 };

function contentResult(): InvitationContentAdminResult {
  return {
    draft: buildDefaultEditableInvitationContent(invitationContent.event, invitationContent.content),
    revision: 2,
    publishedRevision: 1,
    updatedAt: "2026-07-22T01:00:00.000Z",
    publishedAt: "2026-07-21T01:00:00.000Z",
    history: []
  };
}

function galleryResult(): InvitationGalleryAdminResult {
  const draft = buildDefaultEditableInvitationGallery(invitationContent.content);
  draft.photos.forEach((photo, index) => {
    photo.assetId = `12345678-1234-4${String(index).padStart(3, "0")}-8123-123456789abc`;
  });
  return {
    draft,
    revision: 3,
    publishedRevision: 2,
    updatedAt: "2026-07-22T02:00:00.000Z",
    publishedAt: "2026-07-21T02:00:00.000Z",
    history: []
  };
}

function releaseResult(ready = true): InvitationReleaseAdminResult {
  return {
    content: { draftRevision: 2, publishedRevision: 1, updatedAt: "2026-07-22T01:00:00.000Z", publishedAt: null, ready, changed: true, issues: ready ? [] : ["family_contacts"] },
    gallery: { draftRevision: 3, publishedRevision: 2, updatedAt: "2026-07-22T02:00:00.000Z", publishedAt: null, ready, changed: true, issues: ready ? [] : ["images"] },
    schedule: null,
    latestRelease: { id: "release_12345678-1234-4000-8123-123456789abc", releaseNumber: 1, action: "publish", sourceReleaseId: null, contentRevision: 1, galleryRevision: 2, createdAt: "2026-07-21T02:00:00.000Z" },
    history: [
      { id: "release_22345678-1234-4000-8123-123456789abc", releaseNumber: 2, action: "publish", sourceReleaseId: null, contentRevision: 2, galleryRevision: 3, createdAt: "2026-07-22T02:00:00.000Z" },
      { id: "release_12345678-1234-4000-8123-123456789abc", releaseNumber: 1, action: "publish", sourceReleaseId: null, contentRevision: 1, galleryRevision: 2, createdAt: "2026-07-21T02:00:00.000Z" }
    ]
  };
}

describe("ReleaseAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.loadAdminSession.mockReturnValue(null);
    storage.saveAdminSession.mockReturnValue(true);
    storage.clearAdminSession.mockReturnValue(true);
    authApi.createAdminSession.mockResolvedValue(session);
    releaseApi.fetchAdminInvitationRelease.mockResolvedValue(releaseResult());
    releaseApi.publishAdminInvitationRelease.mockResolvedValue(releaseResult());
    releaseApi.scheduleAdminInvitationRelease.mockResolvedValue({
      ...releaseResult(),
      schedule: { id: "schedule_1", contentRevision: 2, galleryRevision: 3, scheduledFor: "2027-01-01T00:00:00.000Z", createdAt: "2026-07-22T00:00:00.000Z", updatedAt: "2026-07-22T00:00:00.000Z" }
    });
    releaseApi.cancelAdminInvitationReleaseSchedule.mockResolvedValue(releaseResult());
    releaseApi.restoreAdminInvitationRelease.mockResolvedValue(releaseResult());
    contentApi.fetchAdminInvitationContent.mockResolvedValue(contentResult());
    galleryApi.fetchAdminInvitationGallery.mockResolvedValue(galleryResult());
    galleryApi.fetchAdminGalleryAsset.mockResolvedValue(new Blob(["image"], { type: "image/webp" }));
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function login() {
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("heading", { name: "공개 후보" });
  }

  it("문구와 사진 초안을 하나의 공개 후보로 표시한다", async () => {
    render(<ReleaseAdminPage />);
    await login();
    expect(screen.getByRole("heading", { name: "문구 2번 · 사진 3번" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "지금 공개" })).toBeEnabled();
    expect(screen.getAllByText("완료")).toHaveLength(2);
  });

  it("확인 대화상자 이후 두 리비전을 통합 공개한다", async () => {
    render(<ReleaseAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: "지금 공개" }));
    fireEvent.click(screen.getByRole("button", { name: "통합 공개" }));
    await waitFor(() => expect(releaseApi.publishAdminInvitationRelease)
      .toHaveBeenCalledWith("admin-token", 2, 3));
  });

  it("공개 예약과 과거 통합 공개본 복원을 실행한다", async () => {
    render(<ReleaseAdminPage />);
    await login();
    fireEvent.change(screen.getByLabelText("공개 일시"), { target: { value: "2027-01-01T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "예약 저장" }));
    await waitFor(() => expect(releaseApi.scheduleAdminInvitationRelease)
      .toHaveBeenCalledWith("admin-token", 2, 3, expect.any(String)));

    fireEvent.click(screen.getByRole("button", { name: "복원" }));
    fireEvent.click(screen.getByRole("button", { name: "공개본 복원" }));
    await waitFor(() => expect(releaseApi.restoreAdminInvitationRelease)
      .toHaveBeenCalledWith("admin-token", "release_12345678-1234-4000-8123-123456789abc"));
  });

  it("필수 항목이 남은 후보는 공개와 예약을 차단한다", async () => {
    releaseApi.fetchAdminInvitationRelease.mockResolvedValue(releaseResult(false));
    render(<ReleaseAdminPage />);
    await login();
    expect(screen.getByText(/연락처 6건/)).toBeInTheDocument();
    expect(screen.getByText(/사진 10장/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "지금 공개" })).toBeDisabled();
    expect(screen.getByLabelText("공개 일시")).toBeDisabled();
  });
});

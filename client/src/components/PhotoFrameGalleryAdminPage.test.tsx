import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoFrameGalleryAdminResult, PhotoFrameGalleryItem } from "@wedding-game/shared";

const api = vi.hoisted(() => ({
  createAdminSession: vi.fn(),
  fetchAdminPhotoFrameGallery: vi.fn(),
  moderateAdminPhotoFrameGallery: vi.fn()
}));
const storage = vi.hoisted(() => ({
  clearAdminSession: vi.fn(),
  loadAdminSession: vi.fn(),
  saveAdminSession: vi.fn()
}));

vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  createAdminSession: api.createAdminSession
}));
vi.mock("../api/photoFrameGalleryApi", () => api);
vi.mock("../invitation/rsvpStorage", () => storage);

import { PhotoFrameGalleryAdminPage } from "./PhotoFrameGalleryAdminPage";

const pending: PhotoFrameGalleryItem = {
  id: "frame_pending",
  contributorName: "꽃하객",
  design: {
    label: "정원 리본",
    photoTransform: { zoom: 1.2, offsetX: 0.1, offsetY: -0.2, rotation: 2 },
    stickerText: "행복하세요",
    stickerStyle: { tone: "rose", font: "hand" },
    stickerTransform: { x: 0.6, y: 0.3, scale: 1.1, rotation: -3 }
  },
  status: "pending",
  createdAt: "2026-07-31T01:00:00.000Z",
  reviewedAt: null
};

function result(item = pending): PhotoFrameGalleryAdminResult {
  return {
    items: [item],
    generatedAt: "2026-07-31T02:00:00.000Z",
    counts: {
      pending: item.status === "pending" ? 1 : 0,
      approved: item.status === "approved" ? 1 : 0,
      rejected: item.status === "rejected" ? 1 : 0
    }
  };
}

describe("PhotoFrameGalleryAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.loadAdminSession.mockReturnValue(null);
    storage.saveAdminSession.mockReturnValue(true);
    api.createAdminSession.mockResolvedValue({ token: "admin-token", expiresAt: Date.now() + 60_000 });
    api.fetchAdminPhotoFrameGallery.mockResolvedValue(result());
    api.moderateAdminPhotoFrameGallery.mockResolvedValue({
      ...pending,
      status: "approved",
      reviewedAt: "2026-07-31T02:10:00.000Z"
    });
  });

  afterEach(cleanup);

  async function login() {
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("region", { name: "공동 프레임 승인 현황" });
  }

  it("관리자 로그인 후 승인 대기 목록과 사진 관리 복귀 링크를 표시한다", async () => {
    render(<PhotoFrameGalleryAdminPage />);
    await login();
    expect(screen.getByText("정원 리본")).toBeInTheDocument();
    expect(screen.getAllByText("승인 대기")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "사진 관리" })).toHaveAttribute("href", "?admin=gallery");
  });

  it("승인 즉시 상태 집계와 공개 상태를 갱신한다", async () => {
    render(<PhotoFrameGalleryAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: "승인 후 공개" }));

    await waitFor(() => expect(api.moderateAdminPhotoFrameGallery).toHaveBeenCalledWith("admin-token", "frame_pending", "approved"));
    expect(screen.getByRole("status")).toHaveTextContent("공동 갤러리에 공개했습니다");
    expect(screen.getByRole("button", { name: "공개 중" })).toBeDisabled();
  });
});

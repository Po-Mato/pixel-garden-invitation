import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPhotoFrameTransform, defaultPhotoStickerStyle, defaultPhotoStickerTransform } from "../game/photoFrameEditor";

const galleryApi = vi.hoisted(() => ({
  fetchPublicPhotoFrameGallery: vi.fn(),
  submitPhotoFrameGallery: vi.fn()
}));

vi.mock("../api/photoFrameGalleryApi", () => galleryApi);

import { PhotoCompositionTemplateControls } from "./PhotoCompositionTemplateControls";

const communityFrame = {
  id: "frame_community",
  contributorName: "꽃하객",
  design: {
    label: "정원 리본",
    photoTransform: { zoom: 1.2, offsetX: 0.1, offsetY: -0.2, rotation: 2 },
    stickerText: "행복하세요",
    stickerStyle: { tone: "rose" as const, font: "hand" as const },
    stickerTransform: { x: 0.6, y: 0.3, scale: 1.1, rotation: -3 }
  },
  status: "approved" as const,
  createdAt: "2026-07-31T01:00:00.000Z",
  reviewedAt: "2026-07-31T02:00:00.000Z"
};

describe("PhotoCompositionTemplateControls", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    galleryApi.fetchPublicPhotoFrameGallery.mockReset().mockResolvedValue({ items: [communityFrame], generatedAt: "2026-07-31T02:00:00.000Z" });
    galleryApi.submitPhotoFrameGallery.mockReset().mockResolvedValue({ ...communityFrame, id: "frame_pending", status: "pending" });
  });

  it("승인된 공동 프레임을 불러와 적용한다", async () => {
    const onApply = vi.fn();
    render(
      <PhotoCompositionTemplateControls
        contributorName="민지"
        photoTransform={defaultPhotoFrameTransform}
        stickerText="축하해요"
        stickerStyle={defaultPhotoStickerStyle}
        stickerTransform={defaultPhotoStickerTransform}
        onApply={onApply}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /함께 만든 프레임/ }));
    const apply = await screen.findByRole("button", { name: "정원 리본, 꽃하객 프레임 적용" });
    fireEvent.click(apply);

    expect(galleryApi.fetchPublicPhotoFrameGallery).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id: "community-frame_community", label: "정원 리본" }));
    expect(screen.getByRole("status")).toHaveTextContent("꽃하객님의 정원 리본을 적용했어요");
  });

  it("현재 구도를 공개하지 않고 관리자 승인 대기로 제출한다", async () => {
    render(
      <PhotoCompositionTemplateControls
        contributorName="민지"
        photoTransform={defaultPhotoFrameTransform}
        stickerText="축하해요"
        stickerStyle={defaultPhotoStickerStyle}
        stickerTransform={defaultPhotoStickerTransform}
        onApply={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /함께 만든 프레임/ }));
    await screen.findByRole("button", { name: "정원 리본, 꽃하객 프레임 적용" });
    fireEvent.change(screen.getByRole("textbox", { name: "내 프레임 이름" }), { target: { value: "민지의 봄날" } });
    fireEvent.click(screen.getByRole("button", { name: "현재 구도 승인 요청" }));

    await waitFor(() => expect(galleryApi.submitPhotoFrameGallery).toHaveBeenCalledWith(expect.objectContaining({
      contributorName: "민지",
      design: expect.objectContaining({ label: "민지의 봄날", stickerText: "축하해요" })
    })));
    expect(screen.getByRole("status")).toHaveTextContent("관리자가 확인한 뒤 공동 갤러리에 공개됩니다");
  });
});

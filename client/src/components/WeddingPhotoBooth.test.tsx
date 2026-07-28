import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { gardenWorld, getWorldZone } from "../game/world";
import { WeddingPhotoBooth } from "./WeddingPhotoBooth";

const photoMocks = vi.hoisted(() => ({
  create: vi.fn(),
  preview: vi.fn(async () => null),
  save: vi.fn(),
  persist: vi.fn(() => true),
  share: vi.fn(async (): Promise<"shared" | "saved"> => "shared")
}));

vi.mock("../game/weddingPhoto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../game/weddingPhoto")>();
  return {
    ...actual,
    createWeddingPhotoNpcPreviewUrl: photoMocks.preview,
    createWeddingPhotoCapture: photoMocks.create,
    saveWeddingPhotoBlob: photoMocks.save,
    saveWeddingPhotoMemory: photoMocks.persist,
    shareWeddingPhotoBlob: photoMocks.share
  };
});

const spot = getWorldZone(gardenWorld, "lobby").photoSpots[0];
const memory = {
  version: 1 as const,
  dataUrl: "data:image/jpeg;base64,photo",
  photoSpotId: spot.id,
  zoneId: spot.zoneId,
  spotLabel: spot.label,
  guestName: "정원하객",
  pose: "flower-heart" as const,
  createdAt: 1234
};

beforeEach(() => {
  photoMocks.create.mockReset();
  photoMocks.preview.mockClear();
  photoMocks.save.mockReset();
  photoMocks.persist.mockClear();
  photoMocks.share.mockReset();
  photoMocks.share.mockResolvedValue("shared");
  photoMocks.create.mockResolvedValue({
    blob: new Blob(["png"], { type: "image/png" }),
    memory
  });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

afterEach(() => cleanup());

describe("WeddingPhotoBooth", () => {
  it("selects a pose, captures the scene, and exposes save and share actions", async () => {
    const onCaptured = vi.fn();
    render(
      <WeddingPhotoBooth
        spot={spot}
        nickname="정원하객"
        appearance={defaultCharacterAppearance}
        onClose={vi.fn()}
        onCaptured={onCaptured}
      />
    );

    expect(screen.getByRole("button", { name: "포토존 닫기" })).toHaveFocus();
    expect(document.querySelector(".wedding-photo-booth__guest .character-portrait"))
      .toHaveAttribute("src", expect.stringContaining("/guests/portraits/feminine-long-wave-dress.png"));
    fireEvent.click(screen.getByRole("button", { name: "꽃하트" }));
    expect(screen.getByRole("button", { name: "꽃하트" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "기념 촬영" }));

    await waitFor(() => expect(photoMocks.create).toHaveBeenCalledWith(expect.objectContaining({
      guestName: "정원하객",
      pose: "flower-heart",
      spot
    })));
    expect(photoMocks.persist).toHaveBeenCalledWith(memory);
    expect(onCaptured).toHaveBeenCalledWith(memory);
    expect(screen.getByRole("img", { name: "정원하객님의 로비 포토월 기념 사진" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "PNG 저장" }));
    expect(photoMocks.save).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "모바일 공유" }));
    await waitFor(() => expect(photoMocks.share).toHaveBeenCalledOnce());
  });

  it("returns to the live preview for another take", async () => {
    render(
      <WeddingPhotoBooth
        spot={spot}
        nickname="정원하객"
        appearance={defaultCharacterAppearance}
        onClose={vi.fn()}
        onCaptured={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "기념 촬영" }));
    await screen.findByRole("button", { name: "다시 찍기" });
    fireEvent.click(screen.getByRole("button", { name: "다시 찍기" }));

    expect(screen.getByLabelText(`${spot.sceneLabel} 촬영 미리보기`)).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("adds nearby realtime guests to the preview and captured photo", async () => {
    const companion = {
      guestId: "nearby-friend",
      nickname: "친구하객",
      appearance: defaultCharacterAppearance
    };
    render(
      <WeddingPhotoBooth
        spot={spot}
        nickname="정원하객"
        appearance={defaultCharacterAppearance}
        companions={[companion]}
        onClose={vi.fn()}
        onCaptured={vi.fn()}
      />
    );

    expect(screen.getByText("가까이 있는 친구하객님과 함께 촬영합니다.")).toBeInTheDocument();
    expect(document.querySelectorAll(".wedding-photo-booth__companion .character-portrait")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "기념 촬영" }));

    await waitFor(() => expect(photoMocks.create).toHaveBeenCalledWith(expect.objectContaining({
      companions: [{ guestName: "친구하객", appearance: defaultCharacterAppearance }]
    })));
  });

  it("applies the collection-complete limited frame to preview and capture", async () => {
    render(
      <WeddingPhotoBooth
        spot={spot}
        nickname="정원하객"
        appearance={defaultCharacterAppearance}
        celebrationFrameUnlocked
        onClose={vi.fn()}
        onCaptured={vi.fn()}
      />
    );

    expect(screen.getByText("축복의 꽃 정원 한정 프레임 적용 중")).toBeInTheDocument();
    expect(screen.getByLabelText(`${spot.sceneLabel} 촬영 미리보기`)).toHaveAttribute("data-celebration-frame", "true");
    fireEvent.click(screen.getByRole("button", { name: "로즈" }));
    fireEvent.click(screen.getByRole("button", { name: "리본" }));
    fireEvent.click(screen.getByRole("button", { name: "기념 촬영" }));
    await waitFor(() => expect(photoMocks.create).toHaveBeenCalledWith(expect.objectContaining({
      celebrationFrame: { palette: "rose", decoration: "ribbons" }
    })));
  });
});

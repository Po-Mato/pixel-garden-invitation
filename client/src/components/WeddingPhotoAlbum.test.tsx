import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import {
  createEmptyWeddingPhotoAlbum,
  upsertWeddingPhotoMemory,
  weddingPhotoSpotOrder,
  type WeddingPhotoMemory
} from "../game/weddingPhoto";
import { gardenWorld } from "../game/world";
import { WeddingPhotoAlbum } from "./WeddingPhotoAlbum";

const photoMocks = vi.hoisted(() => ({
  createStrip: vi.fn(),
  saveMemory: vi.fn(),
  saveStrip: vi.fn(),
  shareMemory: vi.fn(async (): Promise<"shared" | "saved"> => "shared"),
  shareStrip: vi.fn(async (): Promise<"shared" | "saved"> => "shared")
}));

vi.mock("../game/weddingPhoto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../game/weddingPhoto")>();
  return {
    ...actual,
    createWeddingPhotoStrip: photoMocks.createStrip,
    saveWeddingPhotoMemoryImage: photoMocks.saveMemory,
    saveWeddingPhotoStripBlob: photoMocks.saveStrip,
    shareWeddingPhotoMemoryImage: photoMocks.shareMemory,
    shareWeddingPhotoStripBlob: photoMocks.shareStrip
  };
});

const spots = gardenWorld.zones.flatMap((zone) => zone.photoSpots);

function memory(index: number): WeddingPhotoMemory {
  const spot = spots.find((candidate) => candidate.id === weddingPhotoSpotOrder[index])!;
  return {
    version: 1,
    dataUrl: `data:image/jpeg;base64,photo-${index}`,
    photoSpotId: spot.id,
    zoneId: spot.zoneId,
    spotLabel: spot.label,
    guestName: "정원하객",
    pose: "wave",
    createdAt: 1000 + index
  };
}

function album(size: number) {
  return Array.from({ length: size }, (_, index) => memory(index))
    .reduce(upsertWeddingPhotoMemory, createEmptyWeddingPhotoAlbum());
}

beforeEach(() => {
  photoMocks.createStrip.mockReset();
  photoMocks.createStrip.mockResolvedValue(new Blob(["strip"], { type: "image/png" }));
  photoMocks.saveMemory.mockReset();
  photoMocks.saveStrip.mockReset();
  photoMocks.shareMemory.mockReset();
  photoMocks.shareMemory.mockResolvedValue("shared");
  photoMocks.shareStrip.mockReset();
  photoMocks.shareStrip.mockResolvedValue("shared");
});

afterEach(() => cleanup());

describe("WeddingPhotoAlbum", () => {
  it("shows three fixed photo spots and keeps the strip locked while incomplete", () => {
    render(<WeddingPhotoAlbum album={album(1)} nickname="정원하객" onClose={vi.fn()} onRetake={vi.fn()} />);

    expect(screen.getByLabelText("포토앨범 1 / 3 장")).toBeInTheDocument();
    const collection = within(screen.getByLabelText("포토존 사진 세 장"));
    expect(collection.getByRole("button", { name: /로비 포토월/ })).toHaveAttribute("aria-pressed", "true");
    expect(collection.getByRole("button", { name: /신부 대기실 포토존/ })).toBeInTheDocument();
    expect(collection.getByRole("button", { name: /버진로드 포토존/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "공유" })).toBeDisabled();
  });

  it("opens a captured photo full screen and offers save, share, and retake", async () => {
    const onRetake = vi.fn();
    render(<WeddingPhotoAlbum album={album(1)} nickname="정원하객" onClose={vi.fn()} onRetake={onRetake} />);

    fireEvent.click(screen.getByRole("button", { name: "로비 포토월 사진 크게 보기" }));
    expect(screen.getByRole("dialog", { name: "로비 포토월 사진 전체 화면" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "전체 화면 사진 닫기" }));

    fireEvent.click(screen.getByRole("button", { name: "사진 저장" }));
    expect(photoMocks.saveMemory).toHaveBeenCalledWith(memory(0));
    fireEvent.click(screen.getByRole("button", { name: "사진 공유" }));
    await waitFor(() => expect(photoMocks.shareMemory).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "다시 촬영" }));
    expect(onRetake).toHaveBeenCalledWith("lobby-photo-wall");
  });

  it("builds, saves, and shares the vertical strip after all three photos are complete", async () => {
    const completeAlbum = album(3);
    render(<WeddingPhotoAlbum album={completeAlbum} nickname="정원하객" onClose={vi.fn()} onRetake={vi.fn()} />);

    expect(screen.getByLabelText("포토앨범 3 / 3 장")).toBeInTheDocument();
    expect(screen.getByText("세 장의 축하가 완성됐어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(photoMocks.createStrip).toHaveBeenCalledWith(expect.objectContaining({ album: completeAlbum })));
    expect(photoMocks.saveStrip).toHaveBeenCalledWith(expect.any(Blob), "정원하객");

    fireEvent.click(screen.getByRole("button", { name: "공유" }));
    await waitFor(() => expect(photoMocks.shareStrip).toHaveBeenCalledOnce());
  });
});

import { describe, expect, it, vi } from "vitest";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { getWorldZone, gardenWorld } from "./world";
import { memoryStorage } from "../test/memoryStorage";
import {
  loadWeddingPhotoMemory,
  saveWeddingPhotoBlob,
  saveWeddingPhotoMemory,
  shareWeddingPhotoBlob,
  weddingPhotoFilename,
  weddingPhotoMemoryStorageKey,
  type WeddingPhotoData,
  type WeddingPhotoMemory
} from "./weddingPhoto";

const spot = getWorldZone(gardenWorld, "lobby").photoSpots[0];
const data: WeddingPhotoData = {
  guestName: " 김 하객 ",
  appearance: defaultCharacterAppearance,
  coupleNames: "이건희 · 이승재",
  dateLabel: "2027년 5월 1일 토요일",
  venueLabel: "MJ컨벤션 5층 파티오볼룸",
  publicUrl: "https://example.com/invitation",
  pose: "flower-heart",
  spot
};

const memory: WeddingPhotoMemory = {
  version: 1,
  dataUrl: "data:image/jpeg;base64,photo",
  photoSpotId: spot.id,
  zoneId: spot.zoneId,
  spotLabel: spot.label,
  guestName: "김 하객",
  pose: "flower-heart",
  createdAt: 1234
};

function downloadEnvironment() {
  return {
    createObjectUrl: vi.fn(() => "blob:wedding-photo"),
    clickDownload: vi.fn(),
    revokeObjectUrl: vi.fn()
  };
}

describe("wedding photo", () => {
  it("uses a safe personalized PNG filename", () => {
    expect(weddingPhotoFilename(data.guestName, spot.id))
      .toBe("wedding-photo-lobby-photo-wall-김-하객.png");
    expect(weddingPhotoFilename(" !!! ", spot.id))
      .toBe("wedding-photo-lobby-photo-wall-guest.png");
  });

  it("persists only a validated image memory", () => {
    const storage = memoryStorage();
    expect(saveWeddingPhotoMemory(memory, storage)).toBe(true);
    expect(storage.getItem(weddingPhotoMemoryStorageKey)).toContain(memory.photoSpotId);
    expect(loadWeddingPhotoMemory(storage)).toEqual(memory);

    storage.setItem(weddingPhotoMemoryStorageKey, JSON.stringify({ ...memory, dataUrl: "https://example.com/photo" }));
    expect(loadWeddingPhotoMemory(storage)).toBeNull();
    expect(saveWeddingPhotoMemory({ ...memory, dataUrl: "invalid" }, storage)).toBe(false);
  });

  it("downloads the PNG and always releases its object URL", () => {
    const environment = downloadEnvironment();
    const blob = new Blob(["png"], { type: "image/png" });
    saveWeddingPhotoBlob(blob, data, environment);

    expect(environment.clickDownload).toHaveBeenCalledWith(
      "blob:wedding-photo",
      "wedding-photo-lobby-photo-wall-김-하객.png"
    );
    expect(environment.revokeObjectUrl).toHaveBeenCalledWith("blob:wedding-photo");
  });

  it("shares a PNG file or falls back to a download", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const shareEnvironment = {
      ...downloadEnvironment(),
      share: vi.fn(async (_data: ShareData) => undefined),
      canShare: vi.fn(() => true)
    };
    await expect(shareWeddingPhotoBlob(blob, data, shareEnvironment)).resolves.toBe("shared");
    expect(shareEnvironment.share.mock.calls[0]![0]).toMatchObject({
      title: "이건희 · 이승재 웨딩 가든 기념 사진",
      files: [expect.objectContaining({ type: "image/png" })]
    });

    const fallbackEnvironment = downloadEnvironment();
    await expect(shareWeddingPhotoBlob(blob, data, fallbackEnvironment)).resolves.toBe("saved");
    expect(fallbackEnvironment.clickDownload).toHaveBeenCalledOnce();
  });
});

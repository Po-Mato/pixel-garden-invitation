import { describe, expect, it, vi } from "vitest";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { getWorldZone, gardenWorld } from "./world";
import { memoryStorage } from "../test/memoryStorage";
import {
  removeGroomLegBackground,
  loadWeddingPhotoMemory,
  saveWeddingPhotoBlob,
  saveWeddingPhotoMemory,
  shareWeddingPhotoBlob,
  weddingPhotoFilename,
  weddingPhotoNpcFrames,
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
  it("uses the complete neutral walking frame for the bride photo sprite", () => {
    expect(weddingPhotoNpcFrames.bride).toEqual({
      file: "bride__walk.png",
      x: 96,
      y: 0
    });
  });

  it("removes only the light background connected to the groom's feet", () => {
    const width = 5;
    const height = 8;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const setPixel = (x: number, y: number, value: number) => {
      const offset = (y * width + x) * 4;
      pixels.set([value, value, value, 255], offset);
    };

    setPixel(2, 1, 248); // shirt: isolated above the lower-body cleanup area
    for (let y = 4; y < height; y += 1) setPixel(2, y, 245); // leg gap connected to the floor
    for (let x = 1; x <= 3; x += 1) setPixel(x, 7, 235);
    setPixel(0, 5, 32); // dark trouser pixel

    expect(removeGroomLegBackground(pixels, width, height)).toBeGreaterThan(0);
    expect(pixels[(1 * width + 2) * 4 + 3]).toBe(255);
    expect(pixels[(5 * width + 0) * 4 + 3]).toBe(255);
    expect(pixels[(5 * width + 2) * 4 + 3]).toBe(0);
    expect(pixels[(7 * width + 1) * 4 + 3]).toBe(0);
  });

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

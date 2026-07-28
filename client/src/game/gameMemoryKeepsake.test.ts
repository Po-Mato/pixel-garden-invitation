import { describe, expect, it, vi } from "vitest";
import {
  gameMemoryKeepsakeFilename,
  loadGameMemoryKeepsakeOptions,
  normalizeGameMemoryKeepsakeOptions,
  orderGameMemoryKeepsakePhotos,
  saveGameMemoryKeepsakeOptions,
  shareGameMemoryKeepsake,
  type GameMemoryKeepsakeData
} from "./gameMemoryKeepsake";

const data = {
  album: { version: 1 as const, entries: [] },
  photoAlbum: { version: 2 as const, photos: [] },
  guestName: "정원 하객",
  coupleNames: "이건희 · 이승재",
  dateLabel: "2027. 5. 1.",
  venueLabel: "MJ컨벤션",
  publicUrl: "https://example.com",
  collectedCount: 12,
  totalCollectibles: 30
} satisfies GameMemoryKeepsakeData;

describe("gameMemoryKeepsake", () => {
  it("creates a stable Korean-safe filename", () => {
    expect(gameMemoryKeepsakeFilename(" 정원 하객 ")).toBe("wedding-garden-memory-정원-하객.png");
  });

  it("shares the keepsake when file sharing is available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const environment = {
      createObjectUrl: vi.fn(() => "blob:memory"),
      clickDownload: vi.fn(),
      revokeObjectUrl: vi.fn(),
      canShare: vi.fn(() => true),
      share
    };
    await expect(shareGameMemoryKeepsake(new Blob(["memory"]), data, environment)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: "이건희 · 이승재 웨딩 가든 추억" }));
  });

  it("normalizes and persists editable layout options", () => {
    const storage = {
      value: "",
      getItem: vi.fn(() => storage.value),
      setItem: vi.fn((_key: string, value: string) => { storage.value = value; })
    };
    const options = normalizeGameMemoryKeepsakeOptions({
      layout: "film",
      message: "  우리들의 정원 산책  ",
      photoOrder: ["ceremony-aisle", "ceremony-aisle", "lobby-photo-wall"]
    });
    expect(options).toEqual({
      layout: "film",
      message: "우리들의 정원 산책",
      photoOrder: ["ceremony-aisle", "lobby-photo-wall"]
    });
    expect(saveGameMemoryKeepsakeOptions(options, storage)).toBe(true);
    expect(loadGameMemoryKeepsakeOptions(storage)).toEqual(options);
  });

  it("orders captured photos without dropping unspecified photos", () => {
    const photo = (photoSpotId: "lobby-photo-wall" | "bridal-flower-wall" | "ceremony-aisle") => ({
      version: 1 as const,
      dataUrl: `data:${photoSpotId}`,
      photoSpotId,
      zoneId: "lobby" as const,
      spotLabel: photoSpotId,
      guestName: "하객",
      pose: "wave" as const,
      createdAt: 1
    });
    const ordered = orderGameMemoryKeepsakePhotos({
      version: 2,
      photos: [photo("lobby-photo-wall"), photo("bridal-flower-wall"), photo("ceremony-aisle")]
    }, ["ceremony-aisle", "lobby-photo-wall"]);
    expect(ordered.map(({ photoSpotId }) => photoSpotId)).toEqual([
      "ceremony-aisle",
      "lobby-photo-wall",
      "bridal-flower-wall"
    ]);
  });
});

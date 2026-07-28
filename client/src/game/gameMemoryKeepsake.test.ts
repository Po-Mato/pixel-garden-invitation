import { describe, expect, it, vi } from "vitest";
import { gameMemoryKeepsakeFilename, shareGameMemoryKeepsake, type GameMemoryKeepsakeData } from "./gameMemoryKeepsake";

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
});

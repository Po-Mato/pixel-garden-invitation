import { describe, expect, it, vi } from "vitest";
import {
  applyGameMemoryKeepsakeTemplate,
  createGameMemoryKeepsakeTemplate,
  defaultGameMemoryKeepsakeOptions,
  gameMemoryKeepsakeFilename,
  loadGameMemoryKeepsakeOptions,
  loadGameMemoryKeepsakeTemplates,
  normalizeGameMemoryKeepsakeOptions,
  orderGameMemoryKeepsakePhotos,
  saveGameMemoryKeepsakeOptions,
  saveGameMemoryKeepsakeTemplates,
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
      frame: "postage",
      stickers: ["heart", "heart", "sparkle", "invalid"],
      quality: "standard",
      message: "  우리들의 정원 산책  ",
      photoOrder: ["ceremony-aisle", "ceremony-aisle", "lobby-photo-wall"],
      photoTransforms: {
        "ceremony-aisle": { scale: 4, x: -2, y: 0.428 }
      },
      stickerTransforms: {
        heart: { x: -2, y: 0.428, scale: 3, rotation: 205 }
      }
    });
    expect(options).toEqual({
      layout: "film",
      frame: "postage",
      stickers: ["heart", "sparkle"],
      quality: "standard",
      message: "우리들의 정원 산책",
      photoOrder: ["ceremony-aisle", "lobby-photo-wall"],
      photoTransforms: {
        "ceremony-aisle": { scale: 2.2, x: -1, y: 0.43 }
      },
      stickerTransforms: {
        heart: { x: 0.04, y: 0.43, scale: 1.8, rotation: 180 },
        flower: { x: 0.9, y: 0.1, scale: 1, rotation: 8 },
        sparkle: { x: 0.86, y: 0.35, scale: 1, rotation: 0 },
        dove: { x: 0.12, y: 0.35, scale: 1, rotation: -6 },
        ring: { x: 0.5, y: 0.12, scale: 1, rotation: 0 },
        leaf: { x: 0.88, y: 0.58, scale: 1, rotation: 18 }
      },
      textSticker: { enabled: false, text: "우리의 봄날", x: 0.5, y: 0.68, scale: 1, rotation: 0 }
    });
    expect(saveGameMemoryKeepsakeOptions(options, storage)).toBe(true);
    expect(loadGameMemoryKeepsakeOptions(storage)).toEqual(options);
  });

  it("stores up to three reusable design templates without replacing photo crops", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };
    const current = normalizeGameMemoryKeepsakeOptions({
      ...defaultGameMemoryKeepsakeOptions,
      layout: "film",
      frame: "postage",
      stickers: ["sparkle"],
      photoOrder: ["ceremony-aisle"],
      photoTransforms: { "ceremony-aisle": { scale: 1.4, x: 0.2, y: -0.1 } }
    });
    const template = createGameMemoryKeepsakeTemplate(current, 0, "template-one");
    expect(saveGameMemoryKeepsakeTemplates([template], storage)).toBe(true);
    expect(loadGameMemoryKeepsakeTemplates(storage)).toEqual([template]);

    const applied = applyGameMemoryKeepsakeTemplate({
      ...current,
      layout: "garden",
      photoTransforms: { "ceremony-aisle": { scale: 2, x: -0.3, y: 0.4 } }
    }, template);
    expect(applied.layout).toBe("film");
    expect(applied.photoTransforms["ceremony-aisle"]).toEqual({ scale: 2, x: -0.3, y: 0.4 });
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

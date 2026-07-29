import { describe, expect, it, vi } from "vitest";
import {
  applyGameMemoryKeepsakeTemplate,
  createGameMemoryKeepsakeTemplate,
  defaultGameMemoryKeepsakeOptions,
  createSingleImagePdf,
  gameMemoryKeepsakeFilename,
  gameMemoryKeepsakePrintFilename,
  gameMemoryKeepsakePdfFilename,
  gameMemoryKeepsakePrintGuide,
  gameMemoryKeepsakePrintLayout,
  loadGameMemoryKeepsakeOptions,
  loadGameMemoryKeepsakeTemplates,
  normalizeGameMemoryKeepsakeOptions,
  orderGameMemoryKeepsakePhotos,
  saveGameMemoryKeepsakeOptions,
  saveGameMemoryKeepsakePrint,
  saveGameMemoryKeepsakePdf,
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

  it("uses print-ready A4 and postcard canvas sizes and filenames", () => {
    expect(gameMemoryKeepsakePrintLayout("a4")).toEqual({ width: 2480, height: 3508, margin: 150, safeInset: 96, label: "A4", pageWidthPoints: 595.28, pageHeightPoints: 841.89 });
    expect(gameMemoryKeepsakePrintLayout("postcard")).toEqual({ width: 1200, height: 1800, margin: 72, safeInset: 54, label: "4×6 엽서", pageWidthPoints: 288, pageHeightPoints: 432 });
    expect(gameMemoryKeepsakePrintFilename(" 정원 하객 ", "a4"))
      .toBe("wedding-garden-memory-정원-하객-a4.png");

    const environment = {
      createObjectUrl: vi.fn(() => "blob:print"),
      clickDownload: vi.fn(),
      revokeObjectUrl: vi.fn()
    };
    saveGameMemoryKeepsakePrint(new Blob(["print"]), "정원 하객", "postcard", environment);
    expect(environment.clickDownload).toHaveBeenCalledWith("blob:print", "wedding-garden-memory-정원-하객-postcard.png");
    expect(environment.revokeObjectUrl).toHaveBeenCalledWith("blob:print");

    saveGameMemoryKeepsakePdf(new Blob(["pdf"]), "정원 하객", "a4", environment);
    expect(environment.clickDownload).toHaveBeenCalledWith("blob:print", "wedding-garden-memory-정원-하객-a4.pdf");
    expect(gameMemoryKeepsakePdfFilename(" 정원 하객 ", "postcard"))
      .toBe("wedding-garden-memory-정원-하객-postcard.pdf");
  });

  it("keeps trim and safe guides inside the printable page", () => {
    for (const format of ["a4", "postcard"] as const) {
      const guide = gameMemoryKeepsakePrintGuide(format);
      expect(guide.trim.x).toBeGreaterThan(0);
      expect(guide.trim.y).toBeGreaterThan(0);
      expect(guide.safe.x).toBeGreaterThan(guide.trim.x);
      expect(guide.safe.width).toBeLessThan(guide.trim.width);
      expect(guide.safe.y + guide.safe.height).toBeLessThan(guide.trim.y + guide.trim.height);
    }
  });

  it("wraps a JPEG in a one-page print PDF", async () => {
    const pdf = createSingleImagePdf(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 1200, 1800, 288, 432);
    expect(pdf.type).toBe("application/pdf");
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(pdf);
    });
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("%PDF-1.4");
    expect(new TextDecoder().decode(bytes.slice(-6))).toContain("%%EOF");
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

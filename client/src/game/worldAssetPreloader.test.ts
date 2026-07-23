import { worldZoneIds } from "@wedding-game/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { preloadImage } from "../performance/imagePreloader";
import { warmPwaAssetCache } from "../pwa/pwaClient";
import { gardenWorld, getWorldZone } from "./world";
import { preloadWorldZoneAssets, resolveWorldZoneAssetUrls } from "./worldAssetPreloader";

vi.mock("../performance/imagePreloader", () => ({
  preloadImage: vi.fn(async () => true)
}));

vi.mock("../pwa/pwaClient", () => ({
  warmPwaAssetCache: vi.fn()
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("world asset preloader", () => {
  it.each(worldZoneIds)("collects the %s background and every visible overlay once", (zoneId) => {
    const zone = getWorldZone(gardenWorld, zoneId);
    const urls = resolveWorldZoneAssetUrls(zoneId, "./base/");
    const expectedOverlayUrls = zone.decorations.flatMap((decoration) => (
      decoration.asset ? [`./base/assets/maps/v2/${zoneId}/${decoration.asset}`] : []
    ));

    expect(urls[0]).toBe(`./base/assets/maps/v2/${zoneId}/background.webp`);
    expect(urls).toEqual([...new Set([urls[0], ...expectedOverlayUrls])]);
  });

  it("warms the service-worker cache after the visible zone images finish preloading", async () => {
    const urls = resolveWorldZoneAssetUrls("lobby");

    await expect(preloadWorldZoneAssets("lobby", "high")).resolves.toEqual(urls.map(() => true));

    expect(preloadImage).toHaveBeenCalledTimes(urls.length);
    expect(preloadImage).toHaveBeenCalledWith(urls[0], "high");
    expect(warmPwaAssetCache).toHaveBeenCalledWith(urls);
  });
});

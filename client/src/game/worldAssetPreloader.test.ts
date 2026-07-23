import { worldZoneIds } from "@wedding-game/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { preloadImage } from "../performance/imagePreloader";
import { currentNetworkMode } from "../performance/networkQuality";
import { warmPwaAssetCache } from "../pwa/pwaClient";
import { gardenWorld, getWorldZone } from "./world";
import {
  nextWorldZoneToward,
  preloadWorldZoneAssets,
  resolveWorldZoneAssetUrls
} from "./worldAssetPreloader";

vi.mock("../performance/imagePreloader", () => ({
  preloadImage: vi.fn(async () => true)
}));

vi.mock("../pwa/pwaClient", () => ({
  warmPwaAssetCache: vi.fn()
}));

vi.mock("../performance/networkQuality", () => ({
  currentNetworkMode: vi.fn(() => "balanced")
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentNetworkMode).mockReturnValue("balanced");
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

  it("loads only the next map background for a low-priority economy request", async () => {
    vi.mocked(currentNetworkMode).mockReturnValue("economy");

    await expect(preloadWorldZoneAssets("lobby")).resolves.toEqual([true]);

    expect(preloadImage).toHaveBeenCalledOnce();
    expect(preloadImage).toHaveBeenCalledWith(expect.stringContaining("/lobby/background.webp"), "low");
    expect(warmPwaAssetCache).toHaveBeenCalledWith([expect.stringContaining("/lobby/background.webp")]);
  });

  it("finds only the immediate portal step toward the next journey destination", () => {
    expect(nextWorldZoneToward("home", "lobby")).toBe("neighborhood");
    expect(nextWorldZoneToward("bridal-room", "ceremony-hall")).toBe("lobby");
    expect(nextWorldZoneToward("banquet", "restroom")).toBe("restroom");
    expect(nextWorldZoneToward("lobby", "lobby")).toBeNull();
  });
});

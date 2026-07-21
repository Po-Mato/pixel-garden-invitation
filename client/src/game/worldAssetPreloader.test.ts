import { worldZoneIds } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { gardenWorld, getWorldZone } from "./world";
import { resolveWorldZoneAssetUrls } from "./worldAssetPreloader";

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
});

import { worldZoneIds } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { resolveWorldMapAsset, resolveWorldVisual, worldDepth, worldVisualZoneIds } from "./worldVisuals";

describe("world visuals", () => {
  it.each([
    ["home", "#d8c6b4", ["window-light"]],
    ["neighborhood", "#9eb79e", ["leaf-shadow"]],
    ["subway-station", "#c8d2cf", ["station-glow"]],
    ["subway-train", "#d8ddd7", ["city-motion"]],
    ["venue-exterior", "#adc49f", ["garden-petals"]],
    ["lobby", "#dedbd2", ["lobby-glint"]],
    ["bridal-room", "#e7d8d8", ["bridal-sparkle"]],
    ["ceremony-hall", "#536e5e", ["aisle-light"]],
    ["restroom", "#d6e5e1", ["mirror-glint"]],
    ["banquet", "#d9cfb9", ["banquet-light"]]
  ] as const)("resolves the %s background and visual settings", (zoneId, fallbackColor, effects) => {
    expect(resolveWorldVisual(zoneId, "./base/")).toEqual({
      backgroundUrl: `./base/assets/maps/v2/${zoneId}/background.webp`,
      fallbackColor,
      effects
    });
  });

  it("resolves map assets from a base URL without a trailing slash", () => {
    expect(resolveWorldMapAsset("banquet", "table-front.png", "./base"))
      .toBe("./base/assets/maps/v2/banquet/table-front.png");
  });

  it("places map artwork and characters on a shared Y-depth scale", () => {
    expect(worldDepth(345)).toBe(1345);
    expect(worldDepth(Number.NaN)).toBe(1000);
  });

  it("uses every shared world zone in visual order", () => {
    expect(worldVisualZoneIds).toEqual(worldZoneIds);
  });
});

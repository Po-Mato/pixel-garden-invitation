import { worldZoneIds } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { resolveWorldMapAsset, resolveWorldVisual, worldDepth, worldVisualZoneIds } from "./worldVisuals";

describe("world visuals", () => {
  it.each([
    ["home", "#d8c6b4", ["window-light"], "warm-wood", ["mote", "glint"]],
    ["neighborhood", "#9eb79e", ["leaf-shadow"], "garden-stone", ["petal", "mote"]],
    ["subway-station", "#c8d2cf", ["station-glow"], "station-terrazzo", ["streak", "glint"]],
    ["subway-train", "#d8ddd7", ["city-motion"], "train-metal", ["streak", "shimmer"]],
    ["venue-exterior", "#adc49f", ["garden-petals"], "garden-path", ["petal", "glint"]],
    ["lobby", "#dedbd2", ["lobby-glint"], "lobby-marble", ["glint", "shimmer"]],
    ["bridal-room", "#e7d8d8", ["bridal-sparkle"], "bridal-carpet", ["petal", "glint"]],
    ["ceremony-hall", "#536e5e", ["aisle-light"], "ceremony-velvet", ["mote", "glint"]],
    ["restroom", "#d6e5e1", ["mirror-glint"], "restroom-tile", ["shimmer", "glint"]],
    ["banquet", "#d9cfb9", ["banquet-light"], "banquet-parquet", ["glint", "mote"]]
  ] as const)("resolves the %s background and visual settings", (
    zoneId,
    fallbackColor,
    effects,
    texture,
    atmosphere
  ) => {
    expect(resolveWorldVisual(zoneId, "./base/")).toEqual({
      backgroundUrl: `./base/assets/maps/v2/${zoneId}/background.webp`,
      fallbackColor,
      effects,
      texture,
      atmosphere
    });
  });

  it("resolves map assets from a base URL without a trailing slash", () => {
    expect(resolveWorldMapAsset("banquet", "table-floral.png", "./base"))
      .toBe("./base/assets/maps/v2/banquet/table-floral.png");
    expect(resolveWorldMapAsset("banquet", "table-dining.png", "./base"))
      .toBe("./base/assets/maps/v2/banquet/table-dining.png");
  });

  it("places map artwork and characters on a shared Y-depth scale", () => {
    expect(worldDepth(345)).toBe(1345);
    expect(worldDepth(Number.NaN)).toBe(1000);
  });

  it("uses every shared world zone in visual order", () => {
    expect(worldVisualZoneIds).toEqual(worldZoneIds);
  });
});

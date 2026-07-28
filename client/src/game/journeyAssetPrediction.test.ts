import { defaultCharacterAppearance } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { journeyAssetPrediction, uniquePredictedAppearances } from "./journeyAssetPrediction";

describe("journeyAssetPrediction", () => {
  it("preloads full next-map assets on a capable network", () => {
    expect(journeyAssetPrediction({ nextZoneId: "lobby", networkMode: "balanced", performanceMode: "standard" }))
      .toEqual({ zoneId: "lobby", detail: "all", priority: "high", preloadGuestPortraits: true });
  });

  it("limits slow-network preload to the next background", () => {
    expect(journeyAssetPrediction({ nextZoneId: "lobby", networkMode: "economy", performanceMode: "standard" }))
      .toMatchObject({ detail: "background", priority: "low", preloadGuestPortraits: false });
  });

  it("deduplicates predicted guest portraits", () => {
    expect(uniquePredictedAppearances([defaultCharacterAppearance, defaultCharacterAppearance])).toHaveLength(1);
  });
});

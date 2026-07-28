import { describe, expect, it } from "vitest";
import { gardenWorld, getWorldZone } from "./world";
import { journeyRouteTurns, segmentJourneyRouteBySurface } from "./journeyRouteVisual";

describe("journey route visuals", () => {
  it("splits a route whenever the ground material changes", () => {
    const neighborhood = getWorldZone(gardenWorld, "neighborhood");
    const segments = segmentJourneyRouteBySurface(neighborhood, [
      { x: 450, y: 375 },
      { x: 480, y: 375 },
      { x: 510, y: 375 },
      { x: 540, y: 375 },
      { x: 570, y: 375 }
    ]);

    expect(segments.map((segment) => segment.surface)).toEqual(["asphalt", "concrete"]);
    expect(segments[0].points.at(-1)).toEqual(segments[1].points[0]);
  });

  it("marks only actual corners and points each arrow toward the next tile", () => {
    const home = getWorldZone(gardenWorld, "home");
    const turns = journeyRouteTurns(home, [
      { x: 120, y: 120 },
      { x: 150, y: 120 },
      { x: 150, y: 120 },
      { x: 150, y: 150 },
      { x: 180, y: 150 }
    ]);

    expect(turns).toMatchObject([
      { point: { x: 150, y: 120 }, direction: "down", rotation: 90, surface: "wood" },
      { point: { x: 150, y: 150 }, direction: "right", rotation: 0, surface: "wood" }
    ]);
  });

  it("limits tightly clustered corner markers for a small viewport", () => {
    const home = getWorldZone(gardenWorld, "home");
    const turns = journeyRouteTurns(home, [
      { x: 120, y: 120 },
      { x: 150, y: 120 },
      { x: 150, y: 150 },
      { x: 180, y: 150 },
      { x: 180, y: 180 },
      { x: 210, y: 180 }
    ], { minimumTileGap: 2, maxMarkers: 2 });

    expect(turns.map((turn) => turn.tileIndex)).toEqual([1, 3]);
    expect(turns.map((turn) => turn.direction)).toEqual(["down", "down"]);
  });
});

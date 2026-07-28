import { describe, expect, it } from "vitest";
import { crowdDensityCells, portalWaitEstimate } from "./crowdDensity";
import { gardenWorld } from "./world";
import { portalCongestion } from "./portalCongestion";

describe("crowdDensity", () => {
  it("groups realtime guests by world tile", () => {
    expect(crowdDensityCells([
      { x: 31, y: 31 }, { x: 40, y: 44 }, { x: 99, y: 99 }
    ])).toMatchObject([{ count: 2, level: "medium" }, { count: 1, level: "light" }]);
  });

  it("estimates a longer wait for occupied portal entries", () => {
    const portal = gardenWorld.zones[0]!.portals[0]!;
    const congestion = portalCongestion(portal, portal.entryTiles);
    expect(portalWaitEstimate(portal, congestion, portal.entryTiles)).toMatchObject({
      seconds: expect.any(Number),
      label: expect.stringContaining("예상")
    });
  });
});

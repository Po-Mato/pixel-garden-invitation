import { describe, expect, it } from "vitest";
import { resolveFootstepSurface } from "./footstepSurface";
import { gardenWorld, getWorldZone, type Point } from "./world";

describe("footstep surface", () => {
  it.each([
    ["home", { x: 285, y: 555 }, "wood"],
    ["neighborhood", { x: 135, y: 375 }, "asphalt"],
    ["subway-station", { x: 135, y: 435 }, "concrete"],
    ["subway-train", { x: 135, y: 285 }, "metal"],
    ["venue-exterior", { x: 135, y: 645 }, "gravel"],
    ["lobby", { x: 135, y: 435 }, "marble"],
    ["bridal-room", { x: 345, y: 555 }, "carpet"],
    ["ceremony-hall", { x: 375, y: 1785 }, "carpet"],
    ["banquet", { x: 135, y: 405 }, "carpet"],
    ["restroom", { x: 105, y: 345 }, "tile"]
  ] as const)("maps %s walkable tiles to %s", (zoneId, point, expected) => {
    expect(resolveFootstepSurface(getWorldZone(gardenWorld, zoneId), point as Point)).toBe(expected);
  });

  it("prefers the narrower concrete crosswalk over the surrounding asphalt street", () => {
    const neighborhood = getWorldZone(gardenWorld, "neighborhood");

    expect(resolveFootstepSurface(neighborhood, { x: 480, y: 375 })).toBe("asphalt");
    expect(resolveFootstepSurface(neighborhood, { x: 600, y: 375 })).toBe("concrete");
  });

  it("falls back to the map material outside an explicit path", () => {
    expect(resolveFootstepSurface(getWorldZone(gardenWorld, "restroom"), { x: 30, y: 30 }))
      .toBe("tile");
  });
});

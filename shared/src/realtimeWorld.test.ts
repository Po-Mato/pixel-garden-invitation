import { describe, expect, it } from "vitest";
import { worldZoneIds, type WorldZoneId } from "./protocol";
import { realtimeWorldContract } from "./realtimeWorld";

const expectedRealtimeWorldContract = {
  home: { spawn: { x: 285, y: 555 }, bounds: { width: 600, height: 720 } },
  neighborhood: { spawn: { x: 135, y: 375 }, bounds: { width: 1200, height: 660 } },
  "subway-station": { spawn: { x: 135, y: 435 }, bounds: { width: 900, height: 840 } },
  "subway-train": { spawn: { x: 135, y: 285 }, bounds: { width: 1440, height: 540 } },
  "venue-exterior": { spawn: { x: 465, y: 765 }, bounds: { width: 960, height: 900 } },
  lobby: { spawn: { x: 525, y: 765 }, bounds: { width: 1080, height: 900 } },
  "bridal-room": { spawn: { x: 345, y: 525 }, bounds: { width: 720, height: 630 } },
  "ceremony-hall": { spawn: { x: 375, y: 1785 }, bounds: { width: 780, height: 1920 } },
  restroom: { spawn: { x: 135, y: 345 }, bounds: { width: 660, height: 660 } },
  banquet: { spawn: { x: 585, y: 795 }, bounds: { width: 1200, height: 930 } }
} satisfies Record<WorldZoneId, { spawn: { x: number; y: number }; bounds: { width: number; height: number } }>;

describe("realtime world contract", () => {
  it("defines every world zone in journey order", () => {
    expect(Object.keys(realtimeWorldContract)).toEqual(worldZoneIds);
  });

  it.each(worldZoneIds)("defines the final spawn and bounds for %s", (zoneId) => {
    expect(realtimeWorldContract[zoneId]).toEqual(expectedRealtimeWorldContract[zoneId]);
  });
});

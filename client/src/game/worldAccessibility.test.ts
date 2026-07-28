import { describe, expect, it } from "vitest";
import { gardenWorld, getWorldZone } from "./world";
import { nearestWorldLandmark, relativeWorldDirection, worldAccessibilityLandmarks } from "./worldAccessibility";

describe("worldAccessibility", () => {
  it("describes relative directions without relying on the visual map", () => {
    expect(relativeWorldDirection({ x: 0, y: 0 }, { x: 90, y: 0 })).toBe("오른쪽");
    expect(relativeWorldDirection({ x: 0, y: 0 }, { x: -60, y: -60 })).toBe("위 왼쪽");
    expect(relativeWorldDirection({ x: 0, y: 0 }, { x: 10, y: 10 })).toBe("현재 위치 근처");
  });

  it("lists nearby spots, portals, photo zones, and people by tile distance", () => {
    const zone = getWorldZone(gardenWorld, "lobby");
    const landmarks = worldAccessibilityLandmarks(zone, zone.spawn);
    expect(landmarks.length).toBeGreaterThan(0);
    expect(landmarks[0]!.phrase).toMatch(/약 \d+칸/);
    expect(nearestWorldLandmark(zone, zone.spawn)).toEqual(landmarks[0]);
  });
});

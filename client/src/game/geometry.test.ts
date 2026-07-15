import { describe, expect, it } from "vitest";
import { clampToWorld, getNearbySpot, isBlocked, isWalkable } from "./geometry";
import { gardenWorld, getWorldZone, getZoneForSpot } from "./world";

describe("world geometry", () => {
  const home = getWorldZone(gardenWorld, "home");

  it("clamps points to the requested rectangle", () => {
    expect(clampToWorld({ x: -10, y: 900 }, home.bounds)).toEqual({ x: 0, y: 720 });
  });

  it("detects structural and interaction blockers", () => {
    const station = getWorldZone(gardenWorld, "subway-station");
    expect(isBlocked({ x: 375, y: 405 }, station)).toBe(true);
    expect(isBlocked(station.spawn, station)).toBe(false);
  });

  it("treats paths as the walkable area apart from blocked rectangles", () => {
    expect(isWalkable({ x: 225, y: 405 }, home)).toBe(true);
    expect(isBlocked({ x: 45, y: 45 }, home)).toBe(true);
    expect(isBlocked(home.spawn, home)).toBe(false);
  });

  it("finds the nearest actionable invitation spot", () => {
    expect(getNearbySpot({ x: 150, y: 225 }, home)?.id).toBe("directions");
    expect(getNearbySpot(home.spawn, home)).toBeNull();
  });

  it("locates invitation content across the ten route zones", () => {
    expect(gardenWorld.zones).toHaveLength(10);
    expect(getZoneForSpot(gardenWorld, "wedding-info").id).toBe("lobby");
    expect(getZoneForSpot(gardenWorld, "guestbook").id).toBe("banquet");
    expect(getWorldZone(gardenWorld, "lobby").portals.map((portal) => portal.to)).toEqual([
      "venue-exterior",
      "bridal-room",
      "restroom",
      "ceremony-hall"
    ]);
  });

  it("keeps the couple readable around the hall altar", () => {
    const hall = getWorldZone(gardenWorld, "ceremony-hall");
    const [groom, bride] = [...hall.npcs].sort((first, second) => first.x - second.x);
    expect(bride.x - groom.x).toBeGreaterThanOrEqual(90);
    expect(groom.y).toBe(bride.y);
  });
});

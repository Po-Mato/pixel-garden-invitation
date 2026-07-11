import { describe, expect, it } from "vitest";
import { getNearbySpot, isBlocked, clampToWorld } from "./geometry";
import { gardenWorld, getWorldZone, getZoneForSpot } from "./world";

describe("world geometry", () => {
  it("clamps the player inside the world", () => {
    expect(clampToWorld({ x: -10, y: 900 }, gardenWorld.bounds)).toEqual({ x: 0, y: 720 });
  });

  it("detects blocked booth rectangles", () => {
    expect(isBlocked({ x: 180, y: 96 }, gardenWorld)).toBe(true);
    expect(isBlocked({ x: 210, y: 340 }, gardenWorld)).toBe(false);
  });

  it("finds the nearest actionable spot", () => {
    expect(getNearbySpot({ x: 200, y: 114 }, gardenWorld)?.id).toBe("wedding-info");
    expect(getNearbySpot({ x: 210, y: 340 }, gardenWorld)).toBeNull();
  });

  it("splits invitation content into navigable map zones", () => {
    expect(gardenWorld.zones.map((zone) => zone.id)).toEqual(["entrance", "ceremony", "gallery", "lounge"]);
    expect(getWorldZone(gardenWorld, "lounge").spots.map((spot) => spot.id)).toEqual(["rsvp", "guestbook"]);
    expect(getZoneForSpot(gardenWorld, "directions").id).toBe("entrance");
    expect(getWorldZone(gardenWorld, "ceremony").portals.map((portal) => portal.to)).toEqual([
      "entrance",
      "gallery",
      "lounge"
    ]);
  });

  it("gives every zone a distinctive set of pixel decorations", () => {
    for (const zone of gardenWorld.zones) {
      expect(zone.decorations.length).toBeGreaterThanOrEqual(12);
      expect(new Set(zone.decorations.map((decoration) => decoration.kind)).size).toBeGreaterThanOrEqual(6);
      expect(zone.decorations.every((decoration) => decoration.label.length > 0)).toBe(true);
    }

    const kinds = (zoneId: "entrance" | "ceremony" | "gallery" | "lounge") =>
      new Set(getWorldZone(gardenWorld, zoneId).decorations.map((decoration) => decoration.kind));

    expect([...kinds("entrance")]).toEqual(expect.arrayContaining(["flower-arch", "butterfly"]));
    expect([...kinds("ceremony")]).toEqual(expect.arrayContaining(["rose-pillar", "petal-scatter"]));
    expect([...kinds("gallery")]).toEqual(expect.arrayContaining(["star-garland", "string-lights"]));
    expect([...kinds("lounge")]).toEqual(expect.arrayContaining(["gift-stack", "dessert-cart"]));
  });

  it("keeps bride and groom npc labels readable on the mobile stage", () => {
    const [leftNpc, rightNpc] = [...gardenWorld.npcs].sort((first, second) => first.x - second.x);
    const coupleSpot = gardenWorld.spots.find((spot) => spot.id === "couple");

    expect(rightNpc.x - leftNpc.x).toBeGreaterThanOrEqual(92);
    expect(leftNpc.x - 42).toBeGreaterThanOrEqual(gardenWorld.bounds.x);
    expect(rightNpc.x + 42).toBeLessThanOrEqual(gardenWorld.bounds.width);
    expect(coupleSpot).toBeDefined();
    expect(leftNpc.y - 45).toBeGreaterThanOrEqual(coupleSpot!.y + coupleSpot!.height + 8);
    expect(rightNpc.y - 45).toBeGreaterThanOrEqual(coupleSpot!.y + coupleSpot!.height + 8);
  });

  it("keeps the lounge dessert cart clear of the spawn character", () => {
    const lounge = getWorldZone(gardenWorld, "lounge");
    const dessertCart = lounge.decorations.find((decoration) => decoration.kind === "dessert-cart");

    expect(dessertCart).toBeDefined();
    expect(dessertCart!.y).toBeGreaterThanOrEqual(lounge.spawn.y + 36 + 8);
  });
});

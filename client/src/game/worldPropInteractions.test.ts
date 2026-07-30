import { describe, expect, it } from "vitest";
import { gardenWorld } from "./world";
import { worldPropInteractionFor, worldPropInteractionsForZone } from "./worldPropInteractions";

describe("worldPropInteractions", () => {
  it("모든 맵에 실제 장식과 연결된 대표 상호작용을 제공한다", () => {
    for (const zone of gardenWorld.zones) {
      const entries = worldPropInteractionsForZone(zone);
      expect(entries, zone.id).toHaveLength(1);
      expect(entries[0].decoration.id).toBe(entries[0].interaction.decorationId);
      expect(entries[0].interaction.actionRadius).toBeGreaterThanOrEqual(42);
    }
  });

  it("장식 식별자로 상호작용 내용을 찾는다", () => {
    const home = gardenWorld.zones.find(({ id }) => id === "home")!;
    expect(worldPropInteractionFor(home, "home-mail")).toMatchObject({
      actionLabel: "청첩장 살펴보기",
      reaction: "heart"
    });
    expect(worldPropInteractionFor(home, "home-door")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { resolveWorldLabelVisibility } from "./worldLabelLayout";

describe("resolveWorldLabelVisibility", () => {
  it("keeps the highest-priority label and quietens only overlapping labels", () => {
    const result = resolveWorldLabelVisibility([
      { id: "npc", rect: { x: 20, y: 20, width: 80, height: 24 }, priority: 60 },
      { id: "destination", rect: { x: 30, y: 18, width: 96, height: 58 }, priority: 120 },
      { id: "portal", rect: { x: 180, y: 20, width: 90, height: 22 }, priority: 80 }
    ]);

    expect(Object.fromEntries(result)).toEqual({
      destination: "full",
      portal: "full",
      npc: "quiet"
    });
  });

  it("uses source order as a stable tie-breaker", () => {
    const result = resolveWorldLabelVisibility([
      { id: "first", rect: { x: 0, y: 0, width: 40, height: 20 }, priority: 50 },
      { id: "second", rect: { x: 30, y: 0, width: 40, height: 20 }, priority: 50 }
    ], 0);

    expect(result.get("first")).toBe("full");
    expect(result.get("second")).toBe("quiet");
  });
});

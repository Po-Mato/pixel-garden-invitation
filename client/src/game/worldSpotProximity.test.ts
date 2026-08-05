import { describe, expect, it } from "vitest";
import { resolveWorldSpotProximity } from "./worldSpotProximity";

const spot = { x: 300, y: 300, width: 120, height: 90, actionRadius: 90 };

describe("resolveWorldSpotProximity", () => {
  it("keeps a nearby invitation label fully legible", () => {
    expect(resolveWorldSpotProximity({ x: 360, y: 345 }, spot)).toBe("near");
  });

  it("quietens labels in the middle distance", () => {
    expect(resolveWorldSpotProximity({ x: 600, y: 345 }, spot)).toBe("mid");
  });

  it("reduces distant labels to a subtle landmark", () => {
    expect(resolveWorldSpotProximity({ x: 900, y: 345 }, spot)).toBe("far");
  });
});

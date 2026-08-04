import { describe, expect, it } from "vitest";
import {
  nextWorldGeometryIssueZone,
  parseWorldGeometryAuditLayers,
  serializeWorldGeometryAuditLayers
} from "./worldGeometryAuditLayers";

describe("worldGeometryAuditLayers", () => {
  it("serializes and restores active diagnostic filters in stable order", () => {
    const layers = parseWorldGeometryAuditLayers("depth,grid,unknown");
    expect(layers).toEqual({ grid: true, collision: false, depth: true, labels: false });
    expect(serializeWorldGeometryAuditLayers(layers)).toBe("grid,depth");
    expect(parseWorldGeometryAuditLayers("")).toEqual({
      grid: false,
      collision: false,
      depth: false,
      labels: false
    });
  });

  it("cycles to the next zone containing geometry issues", () => {
    const zoneIds = ["home", "lobby", "banquet"] as const;
    expect(nextWorldGeometryIssueZone(zoneIds, { home: 2, banquet: 1 }, "home")).toBe("banquet");
    expect(nextWorldGeometryIssueZone(zoneIds, { home: 2 }, "home")).toBe("home");
    expect(nextWorldGeometryIssueZone(zoneIds, {}, "lobby")).toBeNull();
  });
});

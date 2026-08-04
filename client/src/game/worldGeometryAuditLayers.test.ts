import { describe, expect, it } from "vitest";
import {
  nextWorldGeometryIssueZone,
  parseWorldGeometryAuditLayers,
  serializeWorldGeometryAuditLayers
} from "./worldGeometryAuditLayers";

describe("worldGeometryAuditLayers", () => {
  it("serializes and restores active diagnostic filters in stable order", () => {
    const layers = parseWorldGeometryAuditLayers("depth,grid,unknown");
    expect(layers).toEqual({ grid: true, collision: false, depth: true, heatmap: false, labels: false });
    expect(serializeWorldGeometryAuditLayers(layers)).toBe("grid,depth");
    expect(parseWorldGeometryAuditLayers("")).toEqual({
      grid: false,
      collision: false,
      depth: false,
      heatmap: false,
      labels: false
    });
  });

  it("cycles to the next zone containing geometry issues", () => {
    const zoneIds = ["home", "lobby", "banquet"] as const;
    expect(nextWorldGeometryIssueZone(zoneIds, {
      home: { blocking: 0, warning: 2 },
      lobby: { blocking: 1, warning: 0 },
      banquet: { blocking: 0, warning: 1 }
    }, "home")).toBe("lobby");
    expect(nextWorldGeometryIssueZone(zoneIds, { home: { blocking: 0, warning: 2 } }, "home")).toBe("home");
    expect(nextWorldGeometryIssueZone(zoneIds, {}, "lobby")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { placeWorldOverlayInsideViewport } from "./worldOverlayPlacement";

describe("world overlay placement", () => {
  it("keeps a visible world label anchored to its original point", () => {
    expect(placeWorldOverlayInsideViewport({
      rect: { x: 120, y: 180, width: 120, height: 90 },
      camera: { x: -60, y: -90, zoom: 1 },
      viewport: { width: 390, height: 520 }
    })).toEqual({
      rect: { x: 120, y: 180, width: 120, height: 90 },
      shiftedEdges: []
    });
  });

  it("moves a clipped label just inside the viewport while preserving its size", () => {
    expect(placeWorldOverlayInsideViewport({
      rect: { x: 90, y: 180, width: 120, height: 90 },
      camera: { x: -270, y: -152, zoom: 1 },
      viewport: { width: 390, height: 748 }
    })).toEqual({
      rect: { x: 278, y: 180, width: 120, height: 90 },
      shiftedEdges: ["left"]
    });
  });

  it("clamps both axes and accounts for map zoom", () => {
    expect(placeWorldOverlayInsideViewport({
      rect: { x: 420, y: 500, width: 120, height: 90 },
      camera: { x: -20, y: -30, zoom: 0.8 },
      viewport: { width: 320, height: 400 },
      inset: 10
    })).toEqual({
      rect: { x: 293, y: 435, width: 120, height: 90 },
      shiftedEdges: ["right", "bottom"]
    });
  });
});

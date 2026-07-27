import { describe, expect, it } from "vitest";
import { portalAudioMixAt, portalAudioRangePx } from "./portalAudio";
import { portalEntryTileSize, type WorldPortal } from "./world";

const portal: WorldPortal = {
  id: "test-portal",
  label: "테스트 포털",
  to: "neighborhood",
  x: 0,
  y: 0,
  width: 90,
  height: 30,
  approach: { x: 300, y: 300 },
  entryTiles: [
    { x: 270, y: 300 },
    { x: 300, y: 300 },
    { x: 330, y: 300 }
  ],
  facing: "up",
  spawn: { x: 0, y: 0 }
};

describe("portalAudioMixAt", () => {
  it("uses the nearest entry tile and grows smoothly toward the portal", () => {
    expect(portalAudioMixAt({ x: 300, y: 300 }, [portal])).toEqual({
      intensity: 1,
      pan: 0,
      destination: "neighborhood"
    });

    const halfway = portalAudioMixAt({ x: 300, y: 300 + portalAudioRangePx / 2 }, [portal]);
    expect(halfway?.intensity).toBeCloseTo(0.25);
    expect(halfway?.pan).toBeCloseTo(0);

    expect(portalAudioMixAt({ x: 300, y: 300 + portalAudioRangePx }, [portal])).toBeNull();
  });

  it("pans toward the portal and clamps distant horizontal positions", () => {
    const portalOnRight = portalAudioMixAt({ x: 300 - portalEntryTileSize * 4, y: 300 }, [portal]);
    expect(portalOnRight?.pan).toBeGreaterThan(0);

    const portalOnLeft = portalAudioMixAt({ x: 300 + portalEntryTileSize * 4, y: 300 }, [portal]);
    expect(portalOnLeft?.pan).toBeLessThan(0);

    const closeVerticalPortal: WorldPortal = {
      ...portal,
      entryTiles: [{ x: 500, y: 300 }]
    };
    expect(portalAudioMixAt({ x: 300, y: 300 }, [closeVerticalPortal])?.pan).toBe(1);
  });

  it("selects the closest tile across multiple portals", () => {
    const closerPortal: WorldPortal = {
      ...portal,
      id: "closer-portal",
      to: "subway-station",
      entryTiles: [{ x: 180, y: 300 }]
    };

    const mix = portalAudioMixAt({ x: 150, y: 300 }, [portal, closerPortal]);
    expect(mix?.intensity).toBeCloseTo((1 - 30 / portalAudioRangePx) ** 2);
    expect(mix?.pan).toBeGreaterThan(0);
    expect(mix?.destination).toBe("subway-station");
  });
});

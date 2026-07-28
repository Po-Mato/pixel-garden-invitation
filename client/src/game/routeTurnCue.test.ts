import { describe, expect, it } from "vitest";
import { routeTurnCueOneTileAhead } from "./routeTurnCue";

describe("route turn cue", () => {
  it("announces the outgoing direction one tile before a corner", () => {
    expect(routeTurnCueOneTileAhead(
      { x: 15, y: 15 },
      [{ x: 45, y: 15 }, { x: 45, y: 45 }, { x: 45, y: 75 }]
    )).toEqual({
      corner: { x: 45, y: 15 },
      direction: "down",
      message: "다음 타일에서 아래쪽으로 이동해요"
    });
  });

  it("does not announce a straight segment or an incomplete path", () => {
    expect(routeTurnCueOneTileAhead(
      { x: 15, y: 15 },
      [{ x: 45, y: 15 }, { x: 75, y: 15 }]
    )).toBeNull();
    expect(routeTurnCueOneTileAhead({ x: 15, y: 15 }, [{ x: 45, y: 15 }])).toBeNull();
  });
});

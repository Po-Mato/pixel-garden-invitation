import { describe, expect, it } from "vitest";
import { liteRenderFrameIntervalMs, shouldProcessGameFrame } from "./renderCadence";

describe("render cadence", () => {
  it("표준 기기는 모든 애니메이션 프레임을 처리한다", () => {
    expect(shouldProcessGameFrame("standard", 100, 101)).toBe(true);
  });

  it("저사양 기기는 초당 30프레임 간격으로 처리한다", () => {
    expect(shouldProcessGameFrame("lite", 100, 100 + liteRenderFrameIntervalMs - 1)).toBe(false);
    expect(shouldProcessGameFrame("lite", 100, 100 + liteRenderFrameIntervalMs)).toBe(true);
  });
});

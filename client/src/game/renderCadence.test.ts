import { describe, expect, it } from "vitest";
import { shouldProcessGameFrame } from "./renderCadence";

describe("render cadence", () => {
  it("표준 기기는 모든 애니메이션 프레임을 처리한다", () => {
    expect(shouldProcessGameFrame(60, 100, 101)).toBe(true);
  });

  it("저사양 기기는 지정된 초당 프레임 간격으로 처리한다", () => {
    expect(shouldProcessGameFrame(24, 100, 100 + 1_000 / 24 - 1)).toBe(false);
    expect(shouldProcessGameFrame(24, 100, 100 + 1_000 / 24)).toBe(true);
  });
});

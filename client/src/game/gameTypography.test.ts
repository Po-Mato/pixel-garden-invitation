import { describe, expect, it } from "vitest";
import { requiresExtendedGameTypography } from "./gameTypography";

describe("requiresExtendedGameTypography", () => {
  it("keeps the measured wedding route on the critical font set", () => {
    expect(requiresExtendedGameTypography([
      "오시는 길",
      "하객 김승재",
      "예식 보기 · 마음 전하실 곳"
    ])).toBe(false);
  });

  it("loads the extended font map for rare Korean glyphs", () => {
    expect(requiresExtendedGameTypography(["힣"])).toBe(true);
  });

  it("normalizes decomposed Korean names before checking coverage", () => {
    expect(requiresExtendedGameTypography(["하객".normalize("NFD")])).toBe(false);
  });
});

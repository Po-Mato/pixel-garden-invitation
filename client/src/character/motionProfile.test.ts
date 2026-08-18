import { guestCharacterPresets } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { resolveCharacterMotionProfile } from "./motionProfile";

describe("character material motion profiles", () => {
  it("assigns every approved guest to one restrained material response", () => {
    expect(Object.fromEntries(guestCharacterPresets.map((preset) => [
      preset.id,
      resolveCharacterMotionProfile({ presetId: preset.id })
    ]))).toEqual({
      "feminine-long-wave-dress": "flowing",
      "feminine-formal-hanbok": "hanbok",
      "masculine-navy-suit": "tailored",
      "masculine-charcoal-blazer": "tailored",
      "feminine-sage-bolero-dress": "skirt",
      "feminine-champagne-navy-skirt": "skirt",
      "feminine-lavender-jacket-dress": "flowing",
      "feminine-teal-modern-hanbok": "hanbok",
      "masculine-beige-summer-suit": "tailored",
      "masculine-charcoal-burgundy-tie": "skirt",
      "masculine-green-blazer-cream-pants": "tailored",
      "masculine-blue-modern-hanbok": "hanbok"
    });
  });

  it("falls back through the approved default preset", () => {
    expect(resolveCharacterMotionProfile({ presetId: "missing" })).toBe("flowing");
  });
});

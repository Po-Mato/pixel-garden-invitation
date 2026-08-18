import { resolveGuestPreset, type CharacterAppearance } from "@wedding-game/shared";

export type CharacterMotionProfile = "flowing" | "hanbok" | "skirt" | "tailored";

const motionProfileByPreset = {
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
} as const satisfies Record<string, CharacterMotionProfile>;

export function resolveCharacterMotionProfile(appearance: CharacterAppearance): CharacterMotionProfile {
  return motionProfileByPreset[resolveGuestPreset(appearance).id as keyof typeof motionProfileByPreset] ?? "tailored";
}

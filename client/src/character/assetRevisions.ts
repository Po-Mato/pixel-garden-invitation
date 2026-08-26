export const defaultGuestAssetRevision = "guest02-12-neutral-integrity-v18";
export const guest01AssetRevision = "guest01-stable-feet-v17";
export const guest03AssetRevision = "guest02-12-neutral-integrity-v18";
export const strictVisualGuestAssetRevision = "guest04-12-optical-direction-rig-v19";

export const guestAssetRevisions: Readonly<Partial<Record<string, string>>> = {
  "feminine-long-wave-dress": guest01AssetRevision,
  "feminine-formal-hanbok": defaultGuestAssetRevision,
  "masculine-navy-suit": guest03AssetRevision,
  "masculine-charcoal-blazer": strictVisualGuestAssetRevision,
  "feminine-sage-bolero-dress": defaultGuestAssetRevision,
  "feminine-champagne-navy-skirt": strictVisualGuestAssetRevision,
  "feminine-lavender-jacket-dress": strictVisualGuestAssetRevision,
  "feminine-teal-modern-hanbok": strictVisualGuestAssetRevision,
  "masculine-beige-summer-suit": strictVisualGuestAssetRevision,
  "masculine-charcoal-burgundy-tie": strictVisualGuestAssetRevision,
  "masculine-green-blazer-cream-pants": strictVisualGuestAssetRevision,
  "masculine-blue-modern-hanbok": strictVisualGuestAssetRevision,
};

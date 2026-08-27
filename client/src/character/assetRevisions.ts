export const defaultGuestAssetRevision = "guest02-12-neutral-integrity-v18";
export const guest01AssetRevision = "guest01-stable-feet-v17";
export const shoulderContinuousGuestAssetRevision =
  "guest03-12-continuous-shoulder-v20";

export const guestAssetRevisions: Readonly<Partial<Record<string, string>>> = {
  "feminine-long-wave-dress": guest01AssetRevision,
  "feminine-formal-hanbok": defaultGuestAssetRevision,
  "masculine-navy-suit": shoulderContinuousGuestAssetRevision,
  "masculine-charcoal-blazer": shoulderContinuousGuestAssetRevision,
  "feminine-sage-bolero-dress": defaultGuestAssetRevision,
  "feminine-champagne-navy-skirt": shoulderContinuousGuestAssetRevision,
  "feminine-lavender-jacket-dress": shoulderContinuousGuestAssetRevision,
  "feminine-teal-modern-hanbok": shoulderContinuousGuestAssetRevision,
  "masculine-beige-summer-suit": shoulderContinuousGuestAssetRevision,
  "masculine-charcoal-burgundy-tie": shoulderContinuousGuestAssetRevision,
  "masculine-green-blazer-cream-pants": shoulderContinuousGuestAssetRevision,
  "masculine-blue-modern-hanbok": shoulderContinuousGuestAssetRevision,
};

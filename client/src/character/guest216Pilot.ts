import type { CharacterDisplayMode, ResolvedCharacterLayer } from './assets';

// Persistent preset IDs intentionally retain historical names; catalog labels changed.
export const guest216PilotIds: Readonly<Record<string, string>> = {
  'feminine-long-wave-dress': 'guest-01',
  'feminine-formal-hanbok': 'guest-02',
  'masculine-navy-suit': 'guest-03',
  'masculine-charcoal-blazer': 'guest-04',
  'feminine-sage-bolero-dress': 'guest-05',
  'feminine-champagne-navy-skirt': 'guest-06',
  'feminine-lavender-jacket-dress': 'guest-07',
  'feminine-teal-modern-hanbok': 'guest-08',
  'masculine-beige-summer-suit': 'guest-09',
  'masculine-charcoal-burgundy-tie': 'guest-10',
  'masculine-green-blazer-cream-pants': 'guest-11',
  'masculine-blue-modern-hanbok': 'guest-12'
};

export function resolveGuest216PilotLayer(presetId: string, enabled: boolean, displayMode: CharacterDisplayMode = 'preview', runtimeStaging = false): ResolvedCharacterLayer | undefined {
  const id = Object.hasOwn(guest216PilotIds, presetId) ? guest216PilotIds[presetId] : undefined;
  if (!enabled || !id) return undefined;
  const runtime = runtimeStaging && displayMode === 'world';
  const walkUrl = `/__guest216-pilot/${id}${runtime ? '-runtime' : ''}.png?v=three-head-216-v1`;
  return {
    slot: 'base', walkUrl, fallbackWalkUrl: walkUrl,
    sourceSize: runtime ? { width: 96, height: 144 } : { width: 192, height: 288 },
    displaySize: {
      world: { width: 48, height: 72 },
      preview: { width: 96, height: 144 },
      thumbnail: { width: 48, height: 72 }
    }
  };
}

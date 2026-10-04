import { defaultCharacterAppearance, resolveGuestPreset, guestCharacterPresets, guestPresetFrame } from '@wedding-game/shared';
import type { CharacterDisplayMode, ResolvedCharacterLayer } from './assets';

import { coupleStyleRevision } from "./assetRevisions";

// Keep the revision dependency-free so the Vite PWA config can import it.
export { coupleStyleRevision } from "./assetRevisions";
const presetIds = new Set(guestCharacterPresets.map(preset => preset.id));

function packageUrl(path: string, baseUrl: string) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}characters/generated/couple-style-v1/${path}?v=${coupleStyleRevision}`;
}

export function resolveCoupleStylePortraitUrl(presetId: string, baseUrl: string): string | undefined {
  if (!presetIds.has(presetId)) return undefined;
  return packageUrl(`portraits/${presetId}.png`, baseUrl);
}

export function resolveCoupleStyleLayer(
  presetId: string,
  baseUrl: string,
  displayMode: CharacterDisplayMode
): ResolvedCharacterLayer | undefined {
  if (!presetIds.has(presetId)) return undefined;
  const preview = displayMode !== 'world';
  const prefix = preview ? 'preview/' : '';
  const walkUrl = packageUrl(`${prefix}${presetId}__walk.png`, baseUrl);
  const idleUrl = packageUrl(`${prefix}${presetId}__idle.png`, baseUrl);
  return {
    slot: 'base', walkUrl, idleUrl,
    fallbackWalkUrl: packageUrl(`${prefix}${resolveGuestPreset(defaultCharacterAppearance).id}__walk.png`, baseUrl),
    fallbackIdleUrl: packageUrl(`${prefix}${resolveGuestPreset(defaultCharacterAppearance).id}__idle.png`, baseUrl),
    sourceSize: preview ? guestPresetFrame.selectionPreview.source : guestPresetFrame.source,
    // The world-only foot-anchored CSS applies 7/6 exactly once.
    displaySize: guestPresetFrame.display
  };
}

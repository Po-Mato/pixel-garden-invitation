import type { WorldZoneId } from "@wedding-game/shared";
import { preloadImage, type ImagePreloadPriority } from "../performance/imagePreloader";
import { warmPwaAssetCache } from "../pwa/pwaClient";
import { gardenWorld, getWorldZone } from "./world";
import { resolveWorldMapAsset, resolveWorldVisual } from "./worldVisuals";

export function resolveWorldZoneAssetUrls(
  zoneId: WorldZoneId,
  baseUrl = import.meta.env.BASE_URL
) {
  const zone = getWorldZone(gardenWorld, zoneId);
  const urls = [
    resolveWorldVisual(zoneId, baseUrl).backgroundUrl,
    ...zone.decorations.flatMap((decoration) => (
      decoration.asset ? [resolveWorldMapAsset(zoneId, decoration.asset, baseUrl)] : []
    ))
  ];

  return [...new Set(urls)];
}

export function preloadWorldZoneAssets(
  zoneId: WorldZoneId,
  priority: ImagePreloadPriority = "low"
) {
  const urls = resolveWorldZoneAssetUrls(zoneId);
  return Promise.all(urls.map((url) => preloadImage(url, priority))).then((results) => {
    warmPwaAssetCache(urls);
    return results;
  });
}

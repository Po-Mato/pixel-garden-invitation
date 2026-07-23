import type { WorldZoneId } from "@wedding-game/shared";
import { preloadImage, type ImagePreloadPriority } from "../performance/imagePreloader";
import { currentNetworkMode } from "../performance/networkQuality";
import { warmPwaAssetCache } from "../pwa/pwaClient";
import { gardenWorld, getWorldZone, type GardenWorld } from "./world";
import { resolveWorldMapAsset, resolveWorldVisual } from "./worldVisuals";

export type WorldAssetDetail = "background" | "all";

export function resolveWorldZoneAssetUrls(
  zoneId: WorldZoneId,
  baseUrl = import.meta.env.BASE_URL,
  detail: WorldAssetDetail = "all"
) {
  const zone = getWorldZone(gardenWorld, zoneId);
  const urls = [
    resolveWorldVisual(zoneId, baseUrl).backgroundUrl,
    ...(detail === "all" ? zone.decorations.flatMap((decoration) => (
      decoration.asset ? [resolveWorldMapAsset(zoneId, decoration.asset, baseUrl)] : []
    )) : [])
  ];

  return [...new Set(urls)];
}

export function preloadWorldZoneAssets(
  zoneId: WorldZoneId,
  priority: ImagePreloadPriority = "low"
) {
  const economy = currentNetworkMode() === "economy";
  const detail: WorldAssetDetail = economy && priority === "low" ? "background" : "all";
  const urls = resolveWorldZoneAssetUrls(zoneId, import.meta.env.BASE_URL, detail);
  const load = economy
    ? urls.reduce<Promise<boolean[]>>(async (pending, url, index) => {
        const results = await pending;
        const loaded = await preloadImage(url, index === 0 ? priority : "low");
        return [...results, loaded];
      }, Promise.resolve([]))
    : Promise.all(urls.map((url) => preloadImage(url, priority)));

  return load.then((results) => {
    warmPwaAssetCache(urls.filter((_url, index) => results[index]));
    return results;
  });
}

export function nextWorldZoneToward(
  from: WorldZoneId,
  target: WorldZoneId,
  world: GardenWorld = gardenWorld
): WorldZoneId | null {
  if (from === target) return null;
  const visited = new Set<WorldZoneId>([from]);
  const queue = getWorldZone(world, from).portals.map((portal) => ({
    zoneId: portal.to,
    firstStep: portal.to
  }));

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current.zoneId)) continue;
    if (current.zoneId === target) return current.firstStep;
    visited.add(current.zoneId);
    getWorldZone(world, current.zoneId).portals.forEach((portal) => {
      if (!visited.has(portal.to)) queue.push({ zoneId: portal.to, firstStep: current.firstStep });
    });
  }

  return null;
}

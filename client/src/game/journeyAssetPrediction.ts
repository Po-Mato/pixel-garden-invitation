import type { CharacterAppearance, WorldZoneId } from "@wedding-game/shared";
import type { NetworkMode } from "../performance/networkQuality";
import type { DevicePerformanceMode } from "../performance/DevicePerformanceContext";

export type JourneyAssetPrediction = {
  zoneId: WorldZoneId;
  detail: "background" | "all";
  priority: "low" | "high";
  preloadGuestPortraits: boolean;
};

export function journeyAssetPrediction({
  nextZoneId,
  networkMode,
  performanceMode
}: {
  nextZoneId: WorldZoneId | null;
  networkMode: NetworkMode;
  performanceMode: DevicePerformanceMode;
}): JourneyAssetPrediction | null {
  if (!nextZoneId) return null;
  const constrained = networkMode === "economy" || performanceMode === "lite";
  return {
    zoneId: nextZoneId,
    detail: constrained ? "background" : "all",
    priority: constrained ? "low" : "high",
    preloadGuestPortraits: !constrained
  };
}

export function uniquePredictedAppearances(
  appearances: readonly CharacterAppearance[],
  limit = 4
): CharacterAppearance[] {
  const seen = new Set<string>();
  return appearances.filter((appearance) => {
    const key = JSON.stringify(appearance);
    if (seen.has(key) || seen.size >= limit) return false;
    seen.add(key);
    return true;
  });
}

import type { PwaZoneCacheSnapshot } from "./pwaClient";

export const offlineMapPreferencesStorageKey = "wedding-game:offline-map-preferences:v1";
export const offlineMapRetentionPolicies = ["7-days", "30-days", "manual"] as const;
export type OfflineMapRetentionPolicy = (typeof offlineMapRetentionPolicies)[number];

export type OfflineMapPreferences = {
  retention: OfflineMapRetentionPolicy;
  wifiAutoRefresh: boolean;
};

export type NetworkConnectionSnapshot = {
  type?: string;
  effectiveType?: string;
  saveData?: boolean;
};

type PreferencesStorage = Pick<Storage, "getItem" | "setItem">;

export const defaultOfflineMapPreferences: OfflineMapPreferences = {
  retention: "30-days",
  wifiAutoRefresh: true
};

const offlineMapEstimatedBackgroundBytes = 320 * 1024;
const offlineMapEstimatedDecorationBytes = 48 * 1024;

export function estimatedOfflineAssetBytes(url: string) {
  const path = url.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
  if (path.endsWith("/background.webp")) return offlineMapEstimatedBackgroundBytes;
  if (path.endsWith(".webp")) return 220 * 1024;
  if (path.endsWith(".png")) return offlineMapEstimatedDecorationBytes;
  return 32 * 1024;
}

export function estimatedOfflineAssetGroupBytes(urls: readonly string[]) {
  return [...new Set(urls)].reduce((sum, url) => sum + estimatedOfflineAssetBytes(url), 0);
}

export function scheduledOfflineZoneDeletionAt(
  cache: Pick<PwaZoneCacheSnapshot, "state" | "cachedAt">,
  zoneId: string,
  currentZoneId: string | undefined,
  preferences: OfflineMapPreferences
): number | null {
  if (
    zoneId === currentZoneId
    || preferences.retention === "manual"
    || (cache.state !== "ready" && cache.state !== "outdated")
    || cache.cachedAt <= 0
  ) return null;
  const retentionDays = preferences.retention === "7-days" ? 7 : 30;
  return cache.cachedAt + retentionDays * 24 * 60 * 60 * 1_000;
}

function browserStorage(): PreferencesStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeOfflineMapPreferences(value: unknown): OfflineMapPreferences {
  if (!value || typeof value !== "object") return defaultOfflineMapPreferences;
  const candidate = value as Partial<OfflineMapPreferences>;
  return {
    retention: offlineMapRetentionPolicies.includes(candidate.retention as OfflineMapRetentionPolicy)
      ? candidate.retention as OfflineMapRetentionPolicy
      : defaultOfflineMapPreferences.retention,
    wifiAutoRefresh: candidate.wifiAutoRefresh !== false
  };
}

export function loadOfflineMapPreferences(
  storage: PreferencesStorage | null = browserStorage()
): OfflineMapPreferences {
  try {
    const stored = storage?.getItem(offlineMapPreferencesStorageKey);
    return stored ? normalizeOfflineMapPreferences(JSON.parse(stored)) : defaultOfflineMapPreferences;
  } catch {
    return defaultOfflineMapPreferences;
  }
}

export function saveOfflineMapPreferences(
  preferences: OfflineMapPreferences,
  storage: PreferencesStorage | null = browserStorage()
) {
  try {
    storage?.setItem(offlineMapPreferencesStorageKey, JSON.stringify(normalizeOfflineMapPreferences(preferences)));
    return storage !== null;
  } catch {
    return false;
  }
}

export function expiredOfflineZoneIds(
  zoneCaches: Readonly<Record<string, PwaZoneCacheSnapshot>>,
  currentZoneId: string | undefined,
  preferences: OfflineMapPreferences,
  now = Date.now()
) {
  if (preferences.retention === "manual") return [];
  const maxAge = (preferences.retention === "7-days" ? 7 : 30) * 24 * 60 * 60 * 1_000;
  return Object.entries(zoneCaches).flatMap(([zoneId, cache]) => (
    zoneId !== currentZoneId
    && (cache.state === "ready" || cache.state === "outdated")
    && cache.cachedAt > 0
    && now - cache.cachedAt > maxAge
      ? [zoneId]
      : []
  ));
}

export function isWifiConnection(connection: NetworkConnectionSnapshot | null | undefined) {
  return Boolean(connection && !connection.saveData && connection.type === "wifi");
}

export function shouldAutoRefreshOfflineMaps(
  preferences: OfflineMapPreferences,
  online: boolean,
  connection: NetworkConnectionSnapshot | null | undefined
) {
  return preferences.wifiAutoRefresh && online && isWifiConnection(connection);
}

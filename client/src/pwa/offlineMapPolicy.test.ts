import { describe, expect, it, vi } from "vitest";
import {
  expiredOfflineZoneIds,
  estimatedOfflineAssetGroupBytes,
  loadOfflineMapPreferences,
  offlineDownloadWithinDataLimit,
  saveOfflineMapPreferences,
  scheduledOfflineZoneDeletionAt,
  shouldAutoRefreshOfflineMaps
} from "./offlineMapPolicy";

describe("offline map policy", () => {
  it("removes only old saved zones and protects the current zone", () => {
    const now = Date.UTC(2026, 6, 29);
    const old = now - 31 * 24 * 60 * 60 * 1_000;
    const caches = {
      home: { state: "ready" as const, completed: 1, total: 1, bytes: 10, cachedAt: old },
      lobby: { state: "outdated" as const, completed: 1, total: 1, bytes: 10, cachedAt: old },
      banquet: { state: "ready" as const, completed: 1, total: 1, bytes: 10, cachedAt: now }
    };
    expect(expiredOfflineZoneIds(caches, "home", { retention: "30-days", wifiAutoRefresh: true, dataLimitMb: 50 }, now))
      .toEqual(["lobby"]);
    expect(expiredOfflineZoneIds(caches, "home", { retention: "manual", wifiAutoRefresh: true, dataLimitMb: 50 }, now))
      .toEqual([]);
  });

  it("auto refreshes only on explicit Wi-Fi without data saver", () => {
    const preferences = { retention: "30-days" as const, wifiAutoRefresh: true, dataLimitMb: 50 as const };
    expect(shouldAutoRefreshOfflineMaps(preferences, true, { type: "wifi" })).toBe(true);
    expect(shouldAutoRefreshOfflineMaps(preferences, true, { type: "cellular", effectiveType: "4g" })).toBe(false);
    expect(shouldAutoRefreshOfflineMaps(preferences, true, { type: "wifi", saveData: true })).toBe(false);
  });

  it("estimates map assets and schedules deletion from the saved time", () => {
    expect(estimatedOfflineAssetGroupBytes([
      "/assets/maps/home/background.webp",
      "/assets/maps/home/table.png",
      "/assets/maps/home/table.png"
    ])).toBe(368 * 1024);
    const cachedAt = Date.UTC(2026, 6, 29);
    const cache = { state: "ready" as const, cachedAt };
    expect(scheduledOfflineZoneDeletionAt(
      cache,
      "lobby",
      "home",
      { retention: "7-days", wifiAutoRefresh: true, dataLimitMb: 50 }
    )).toBe(cachedAt + 7 * 24 * 60 * 60 * 1_000);
    expect(scheduledOfflineZoneDeletionAt(
      cache,
      "home",
      "home",
      { retention: "7-days", wifiAutoRefresh: true, dataLimitMb: 50 }
    )).toBeNull();
  });

  it("persists normalized preferences", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value))
    };
    expect(saveOfflineMapPreferences({ retention: "7-days", wifiAutoRefresh: false, dataLimitMb: 20 }, storage)).toBe(true);
    expect(loadOfflineMapPreferences(storage)).toEqual({ retention: "7-days", wifiAutoRefresh: false, dataLimitMb: 20 });
  });

  it("enforces the selected download data budget", () => {
    const preferences = { retention: "30-days" as const, wifiAutoRefresh: true, dataLimitMb: 20 as const };
    expect(offlineDownloadWithinDataLimit(19 * 1024 * 1024, preferences)).toBe(true);
    expect(offlineDownloadWithinDataLimit(21 * 1024 * 1024, preferences)).toBe(false);
    expect(offlineDownloadWithinDataLimit(200 * 1024 * 1024, { ...preferences, dataLimitMb: 0 })).toBe(true);
  });
});

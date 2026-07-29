import { describe, expect, it, vi } from "vitest";
import {
  estimatedOfflineDownloadSeconds,
  formatOfflineDownloadDuration,
  measureOfflineAssetGroups
} from "./offlineAssetMeasurement";

describe("offlineAssetMeasurement", () => {
  it("uses server content lengths and only falls back for unreported files", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => ({
      ok: true,
      headers: new Headers(String(url).endsWith("background.webp")
        ? { "content-length": "400000" }
        : {})
    }));
    const result = await measureOfflineAssetGroups({
      home: ["/maps/home/background.webp", "/maps/home/overlay.png"],
      lobby: ["/maps/home/background.webp"]
    }, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.home).toEqual({ bytes: 400000 + 48 * 1024, measuredFiles: 1, totalFiles: 2 });
    expect(result.lobby).toEqual({ bytes: 400000, measuredFiles: 1, totalFiles: 1 });
  });

  it("estimates transfer time from the current downlink", () => {
    expect(estimatedOfflineDownloadSeconds(1_000_000, { downlink: 8 })).toBe(2);
    expect(estimatedOfflineDownloadSeconds(1_000_000, { effectiveType: "3g" }))
      .toBeGreaterThan(estimatedOfflineDownloadSeconds(1_000_000, { effectiveType: "4g" }));
    expect(formatOfflineDownloadDuration(65)).toBe("약 1분 5초");
  });
});

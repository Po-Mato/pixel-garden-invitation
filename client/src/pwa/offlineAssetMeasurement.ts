import { estimatedOfflineAssetBytes, type NetworkConnectionSnapshot } from "./offlineMapPolicy";

export type OfflineAssetGroupMeasurement = {
  bytes: number;
  measuredFiles: number;
  totalFiles: number;
};

type HeadFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "headers">>;

function positiveContentLength(headers: Headers) {
  const value = Number(headers.get("content-length"));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function measureOfflineAssetGroups(
  groups: Readonly<Record<string, readonly string[]>>,
  fetcher: HeadFetcher = fetch,
  concurrency = 4
): Promise<Record<string, OfflineAssetGroupMeasurement>> {
  const urls = [...new Set(Object.values(groups).flat())];
  const sizes = new Map<string, number | null>();
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), urls.length) }, async () => {
    while (cursor < urls.length) {
      const url = urls[cursor++]!;
      try {
        const response = await fetcher(url, { method: "HEAD", cache: "no-store" });
        sizes.set(url, response.ok ? positiveContentLength(response.headers) : null);
      } catch {
        sizes.set(url, null);
      }
    }
  });
  await Promise.all(workers);

  return Object.fromEntries(Object.entries(groups).map(([zoneId, groupUrls]) => {
    const uniqueUrls = [...new Set(groupUrls)];
    const measuredFiles = uniqueUrls.filter((url) => sizes.get(url) !== null).length;
    const bytes = uniqueUrls.reduce((total, url) => total + (
      sizes.get(url) ?? estimatedOfflineAssetBytes(url)
    ), 0);
    return [zoneId, { bytes, measuredFiles, totalFiles: uniqueUrls.length }];
  }));
}

export function estimatedOfflineDownloadSeconds(
  bytes: number,
  connection: NetworkConnectionSnapshot | null | undefined
) {
  const downlink = connection?.downlink && connection.downlink > 0
    ? connection.downlink
    : connection?.effectiveType === "slow-2g" ? 0.08
      : connection?.effectiveType === "2g" ? 0.25
        : connection?.effectiveType === "3g" ? 1.5
          : connection?.effectiveType === "4g" ? 8 : 3.5;
  const transferSeconds = bytes * 8 / (downlink * 1_000_000);
  return Math.max(1, Math.ceil(transferSeconds * 1.18 + 0.6));
}

export function formatOfflineDownloadDuration(seconds: number) {
  if (seconds < 60) return `약 ${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `약 ${minutes}분 ${remainder}초` : `약 ${minutes}분`;
}

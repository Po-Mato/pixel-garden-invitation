import { useEffect, useMemo, useState } from "react";
import { Check, CloudDownload, HardDrive, LoaderCircle, MapPinned, RefreshCw, Trash2 } from "lucide-react";
import type { WorldZoneId } from "@wedding-game/shared";
import { gardenWorld } from "../game/world";
import { resolveWorldZoneAssetUrls } from "../game/worldAssetPreloader";
import {
  getPwaClientSnapshot,
  inspectOfflineZoneAssets,
  prepareOfflineZoneAssets,
  removeOfflineZoneAssets,
  startPwaClient,
  subscribePwaClient,
  type PwaClientSnapshot
} from "../pwa/pwaClient";

type OfflineMapDownloadCenterProps = {
  currentZoneId?: WorldZoneId;
};

function formatBytes(bytes: number) {
  if (bytes <= 0) return "용량 확인 전";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function OfflineMapDownloadCenter({ currentZoneId }: OfflineMapDownloadCenterProps) {
  const [client, setClient] = useState<PwaClientSnapshot>(getPwaClientSnapshot);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const groups = useMemo(() => Object.fromEntries(gardenWorld.zones.map((zone) => [
    zone.id,
    resolveWorldZoneAssetUrls(zone.id)
  ])), []);
  const zones = useMemo(() => [...gardenWorld.zones].sort((left, right) => (
    left.id === currentZoneId ? -1 : right.id === currentZoneId ? 1 : 0
  )), [currentZoneId]);
  const savedBytes = Object.values(client.zoneCaches)
    .filter(({ state }) => state === "ready")
    .reduce((sum, cache) => sum + cache.bytes, 0);

  const refreshStorage = () => {
    if (!navigator.storage?.estimate) return;
    void navigator.storage.estimate().then((estimate) => {
      setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
    }).catch(() => undefined);
  };

  useEffect(() => {
    const unsubscribe = subscribePwaClient(setClient);
    void startPwaClient().then(() => inspectOfflineZoneAssets(groups));
    refreshStorage();
    return unsubscribe;
  }, [groups]);

  useEffect(() => {
    refreshStorage();
  }, [client.zoneCaches]);

  return (
    <section className="offline-map-download" aria-labelledby="offline-map-download-title">
      <header>
        <CloudDownload aria-hidden="true" />
        <div><strong id="offline-map-download-title">오프라인 지도</strong><small>저장됨 {formatBytes(savedBytes)}</small></div>
      </header>
      {storage?.quota ? (
        <div className="offline-map-download__storage">
          <HardDrive aria-hidden="true" />
          <span>기기 저장 공간 {formatBytes(storage.usage)} / {formatBytes(storage.quota)}</span>
          <progress max={storage.quota} value={storage.usage} aria-label="기기 저장 공간 사용량" />
        </div>
      ) : null}
      <div className="offline-map-download__zones">
        {zones.map((zone) => {
          const cache = client.zoneCaches[zone.id] ?? {
            state: "idle" as const,
            completed: 0,
            total: groups[zone.id]?.length ?? 0,
            bytes: 0
          };
          const ready = cache.state === "ready";
          const preparing = cache.state === "preparing";
          const percent = cache.total > 0 ? Math.round((cache.completed / cache.total) * 100) : 0;
          return (
            <article key={zone.id} data-state={cache.state}>
              <MapPinned aria-hidden="true" />
              <span>
                <strong>{zone.label}{zone.id === currentZoneId ? " · 현재" : ""}</strong>
                <small>{preparing ? `${percent}% 저장 중` : ready ? formatBytes(cache.bytes) : cache.state === "error" ? "저장 실패" : "저장 안 됨"}</small>
              </span>
              {preparing ? <LoaderCircle className="offline-map-download__spinner" aria-label={`${zone.label} 저장 중`} /> : null}
              {ready ? (
                <button
                  type="button"
                  aria-label={`${zone.label} 오프라인 지도 삭제`}
                  title="저장 파일 삭제"
                  onClick={() => removeOfflineZoneAssets(zone.id, groups[zone.id] ?? [])}
                ><Trash2 aria-hidden="true" /></button>
              ) : (
                <button
                  type="button"
                  disabled={preparing || !client.supported}
                  aria-label={`${zone.label} 오프라인 지도 ${cache.state === "error" ? "다시 저장" : "저장"}`}
                  title={cache.state === "error" ? "다시 저장" : "오프라인 저장"}
                  onClick={() => prepareOfflineZoneAssets(zone.id, groups[zone.id] ?? [])}
                >{cache.state === "error" ? <RefreshCw aria-hidden="true" /> : ready ? <Check aria-hidden="true" /> : <CloudDownload aria-hidden="true" />}</button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

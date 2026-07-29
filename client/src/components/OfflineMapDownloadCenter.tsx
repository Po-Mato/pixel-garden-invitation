import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, CloudDownload, HardDrive, LoaderCircle, MapPinned, PackageCheck, RefreshCw, Trash2, Wifi } from "lucide-react";
import type { WorldZoneId } from "@wedding-game/shared";
import { gardenWorld } from "../game/world";
import { resolveWorldZoneAssetUrls } from "../game/worldAssetPreloader";
import {
  applyPwaUpdate,
  checkForPwaUpdate,
  getPwaClientSnapshot,
  inspectOfflineZoneAssets,
  prepareOfflineJourneyAssets,
  prepareOfflineZoneAssets,
  removeOfflineZoneAssets,
  removeOfflineJourneyAssets,
  startPwaClient,
  subscribePwaClient,
  type PwaClientSnapshot
} from "../pwa/pwaClient";
import {
  expiredOfflineZoneIds,
  estimatedOfflineAssetGroupBytes,
  loadOfflineMapPreferences,
  saveOfflineMapPreferences,
  scheduledOfflineZoneDeletionAt,
  shouldAutoRefreshOfflineMaps,
  type NetworkConnectionSnapshot,
  type OfflineMapPreferences
} from "../pwa/offlineMapPolicy";

type OfflineMapDownloadCenterProps = {
  currentZoneId?: WorldZoneId;
};

function formatBytes(bytes: number) {
  if (bytes <= 0) return "용량 확인 전";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDeletionDate(timestamp: number) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(timestamp));
}

export function OfflineMapDownloadCenter({ currentZoneId }: OfflineMapDownloadCenterProps) {
  const [client, setClient] = useState<PwaClientSnapshot>(getPwaClientSnapshot);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [preferences, setPreferences] = useState(loadOfflineMapPreferences);
  const [automationStatus, setAutomationStatus] = useState("저장된 지도 상태를 확인하고 있어요.");
  const cleanupSignatureRef = useRef("");
  const refreshSignatureRef = useRef("");
  const groups = useMemo(() => Object.fromEntries(gardenWorld.zones.map((zone) => [
    zone.id,
    resolveWorldZoneAssetUrls(zone.id)
  ])), []);
  const zones = useMemo(() => [...gardenWorld.zones].sort((left, right) => (
    left.id === currentZoneId ? -1 : right.id === currentZoneId ? 1 : 0
  )), [currentZoneId]);
  const savedBytes = Object.values(client.zoneCaches)
    .filter(({ state }) => state === "ready" || state === "outdated")
    .reduce((sum, cache) => sum + cache.bytes, 0);
  const zoneStates = gardenWorld.zones.map(({ id }) => client.zoneCaches[id]?.state ?? "idle");
  const journeyReady = zoneStates.every((state) => state === "ready");
  const journeyPreparing = zoneStates.some((state) => state === "preparing");
  const journeyOutdated = zoneStates.filter((state) => state === "outdated").length;
  const journeySaved = zoneStates.filter((state) => state === "ready" || state === "outdated").length;
  const estimatedBytesByZone = useMemo(() => Object.fromEntries(Object.entries(groups).map(([zoneId, urls]) => [
    zoneId,
    estimatedOfflineAssetGroupBytes(urls)
  ])), [groups]);
  const estimatedJourneyBytes = Object.values(estimatedBytesByZone).reduce((sum, bytes) => sum + bytes, 0);

  const refreshStorage = () => {
    if (!navigator.storage?.estimate) return;
    void navigator.storage.estimate().then((estimate) => {
      setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
    }).catch(() => undefined);
  };

  useEffect(() => {
    const unsubscribe = subscribePwaClient(setClient);
    void startPwaClient().then(() => {
      inspectOfflineZoneAssets(groups);
      void checkForPwaUpdate();
    });
    refreshStorage();
    return unsubscribe;
  }, [groups]);

  useEffect(() => {
    refreshStorage();
  }, [client.zoneCaches]);

  useEffect(() => {
    saveOfflineMapPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    const expiredZoneIds = expiredOfflineZoneIds(client.zoneCaches, currentZoneId, preferences);
    const signature = expiredZoneIds.join("|");
    if (!signature || cleanupSignatureRef.current === signature) return;
    cleanupSignatureRef.current = signature;
    expiredZoneIds.forEach((zoneId) => removeOfflineZoneAssets(zoneId, groups[zoneId] ?? []));
    setAutomationStatus(`${expiredZoneIds.length}개 오래된 지도를 자동 정리했어요.`);
  }, [client.zoneCaches, currentZoneId, groups, preferences]);

  useEffect(() => {
    type NetworkInformationLike = NetworkConnectionSnapshot & {
      addEventListener?: (type: "change", listener: () => void) => void;
      removeEventListener?: (type: "change", listener: () => void) => void;
    };
    const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
    const refreshOutdated = () => {
      const outdatedGroups = Object.fromEntries(Object.entries(groups).filter(([zoneId]) => (
        client.zoneCaches[zoneId]?.state === "outdated"
      )));
      const zoneIds = Object.keys(outdatedGroups);
      if (!shouldAutoRefreshOfflineMaps(preferences, navigator.onLine, connection)) {
        setAutomationStatus(preferences.wifiAutoRefresh
          ? connection ? "Wi-Fi 연결을 기다리고 있어요." : "이 브라우저에서는 Wi-Fi 유형을 확인할 수 없어요."
          : "Wi-Fi 자동 갱신을 사용하지 않아요.");
        return;
      }
      if (zoneIds.length === 0) {
        setAutomationStatus("Wi-Fi 연결됨 · 저장된 지도는 최신 상태예요.");
        return;
      }
      const signature = zoneIds.join("|");
      if (refreshSignatureRef.current === signature) return;
      refreshSignatureRef.current = signature;
      prepareOfflineJourneyAssets(outdatedGroups);
      setAutomationStatus(`Wi-Fi에서 ${zoneIds.length}개 지도를 자동 갱신하고 있어요.`);
    };
    refreshOutdated();
    window.addEventListener("online", refreshOutdated);
    connection?.addEventListener?.("change", refreshOutdated);
    return () => {
      window.removeEventListener("online", refreshOutdated);
      connection?.removeEventListener?.("change", refreshOutdated);
    };
  }, [client.zoneCaches, groups, preferences]);

  const updatePreferences = (patch: Partial<OfflineMapPreferences>) => {
    cleanupSignatureRef.current = "";
    refreshSignatureRef.current = "";
    setPreferences((current) => ({ ...current, ...patch }));
  };

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
      <fieldset className="offline-map-download__automation">
        <legend><Clock3 aria-hidden="true" />자동 관리</legend>
        <div role="group" aria-label="오프라인 지도 자동 정리 시점">
          {([[
            "7-days", "7일"
          ], [
            "30-days", "30일"
          ], [
            "manual", "직접"
          ]] as const).map(([retention, label]) => (
            <button
              key={retention}
              type="button"
              aria-pressed={preferences.retention === retention}
              onClick={() => updatePreferences({ retention })}
            >{label}</button>
          ))}
        </div>
        <label>
          <input
            type="checkbox"
            checked={preferences.wifiAutoRefresh}
            onChange={(event) => updatePreferences({ wifiAutoRefresh: event.target.checked })}
          />
          <Wifi aria-hidden="true" />Wi-Fi 연결 시 오래된 지도 자동 갱신
        </label>
        <p aria-live="polite">{automationStatus}</p>
      </fieldset>
      {client.updateAvailable ? (
        <div className="offline-map-download__update" role="status">
          <RefreshCw aria-hidden="true" />
          <span><strong>새 지도 버전이 있어요</strong><small>저장된 여정은 앱 갱신 후 필요한 구역만 다시 받을 수 있어요.</small></span>
          <button
            type="button"
            disabled={applyingUpdate}
            onClick={() => {
              setApplyingUpdate(true);
              void applyPwaUpdate().then((applied) => { if (!applied) setApplyingUpdate(false); });
            }}
          >{applyingUpdate ? "적용 중" : "업데이트"}</button>
        </div>
      ) : null}
      <section className="offline-map-download__journey" aria-label="전체 여정 오프라인 저장">
        <PackageCheck aria-hidden="true" />
        <span>
          <strong>전체 여정 한 번에 저장</strong>
          <small>{journeyPreparing
            ? `${journeySaved}/${gardenWorld.zones.length}개 구역 저장 중`
            : journeyReady ? "모든 구역을 최신 상태로 저장했어요"
              : journeyOutdated > 0 ? `${journeyOutdated}개 구역 업데이트 필요 · 예상 ${formatBytes(estimatedJourneyBytes)}`
                : `${journeySaved}/${gardenWorld.zones.length}개 구역 저장됨 · 예상 ${formatBytes(estimatedJourneyBytes)}`}</small>
        </span>
        {journeyReady ? (
          <button
            type="button"
            aria-label="전체 여정 오프라인 지도 삭제"
            title="전체 저장 삭제"
            onClick={() => removeOfflineJourneyAssets(groups)}
          ><Trash2 aria-hidden="true" /></button>
        ) : (
          <button
            type="button"
            disabled={journeyPreparing || !client.supported}
            aria-label={journeyOutdated > 0 ? "전체 여정 오프라인 지도 업데이트" : "전체 여정 오프라인 지도 저장"}
            title={journeyOutdated > 0 ? "전체 지도 업데이트" : "전체 지도 저장"}
            onClick={() => prepareOfflineJourneyAssets(groups)}
          >{journeyPreparing ? <LoaderCircle className="offline-map-download__spinner" aria-hidden="true" /> : <CloudDownload aria-hidden="true" />}</button>
        )}
      </section>
      <div className="offline-map-download__zones">
        {zones.map((zone) => {
          const cache = client.zoneCaches[zone.id] ?? {
            state: "idle" as const,
            completed: 0,
            total: groups[zone.id]?.length ?? 0,
            bytes: 0,
            cachedAt: 0
          };
          const ready = cache.state === "ready";
          const outdated = cache.state === "outdated";
          const preparing = cache.state === "preparing";
          const percent = cache.total > 0 ? Math.round((cache.completed / cache.total) * 100) : 0;
          const estimatedBytes = estimatedBytesByZone[zone.id] ?? 0;
          const deletionAt = scheduledOfflineZoneDeletionAt(cache, zone.id, currentZoneId, preferences);
          const retentionLabel = zone.id === currentZoneId
            ? "현재 지도 보호"
            : preferences.retention === "manual"
              ? "직접 삭제"
              : deletionAt ? `${formatDeletionDate(deletionAt)} 자동 삭제 예정` : null;
          return (
            <article key={zone.id} data-state={cache.state}>
              <MapPinned aria-hidden="true" />
              <span>
                <strong>{zone.label}{zone.id === currentZoneId ? " · 현재" : ""}</strong>
                <small>{preparing ? `${percent}% 저장 중 · 예상 ${formatBytes(estimatedBytes)}`
                  : ready ? `${formatBytes(cache.bytes)} · ${retentionLabel}`
                    : outdated ? `${formatBytes(cache.bytes)} · 업데이트 필요 · ${retentionLabel}`
                      : cache.state === "error" ? `저장 실패 · 예상 ${formatBytes(estimatedBytes)}`
                        : `저장 안 됨 · 예상 ${formatBytes(estimatedBytes)}`}</small>
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
                  aria-label={`${zone.label} 오프라인 지도 ${outdated ? "업데이트" : cache.state === "error" ? "다시 저장" : "저장"}`}
                  title={outdated ? "지도 업데이트" : cache.state === "error" ? "다시 저장" : "오프라인 저장"}
                  onClick={() => prepareOfflineZoneAssets(zone.id, groups[zone.id] ?? [])}
                >{outdated || cache.state === "error" ? <RefreshCw aria-hidden="true" /> : ready ? <Check aria-hidden="true" /> : <CloudDownload aria-hidden="true" />}</button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

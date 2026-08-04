import { MapPinned } from "lucide-react";
import type { WorldZoneId } from "@wedding-game/shared";
import type { WorldZone } from "../game/world";
import {
  worldGeometryAuditLayerKeys,
  type WorldGeometryAuditLayerKey,
  type WorldGeometryAuditLayers
} from "../game/worldGeometryAuditLayers";

type WorldGeometryAuditControlsProps = {
  zones: WorldZone[];
  activeZoneId: WorldZoneId;
  enabled: boolean;
  layers: WorldGeometryAuditLayers;
  onEnabledChange: (enabled: boolean) => void;
  onLayerChange: (layer: WorldGeometryAuditLayerKey, enabled: boolean) => void;
  onZoneChange: (zoneId: WorldZoneId) => void;
};

const layerLabels: Record<WorldGeometryAuditLayerKey, { short: string; accessible: string }> = {
  grid: { short: "GRID", accessible: "이동 격자" },
  collision: { short: "HIT", accessible: "충돌 영역" },
  depth: { short: "DEPTH", accessible: "전경 깊이선" },
  labels: { short: "ID", accessible: "전경 식별자" }
};

export function WorldGeometryAuditControls({
  zones,
  activeZoneId,
  enabled,
  layers,
  onEnabledChange,
  onLayerChange,
  onZoneChange
}: WorldGeometryAuditControlsProps) {
  return (
    <aside
      className="world-geometry-audit-controls"
      data-testid="world-geometry-audit-controls"
      data-enabled={enabled || undefined}
      aria-label="지도 진단 도구"
    >
      <button
        type="button"
        className="world-geometry-audit-toggle"
        aria-label={enabled ? "지도 진단 끄기" : "지도 진단 켜기"}
        aria-pressed={enabled}
        onClick={() => onEnabledChange(!enabled)}
      >
        <MapPinned aria-hidden="true" />
        <span>{enabled ? "진단 ON" : "진단 OFF"}</span>
      </button>
      {enabled ? (
        <>
          <label className="world-geometry-audit-zone">
            <span>ZONE</span>
            <select
              aria-label="진단 구역 즉시 이동"
              value={activeZoneId}
              onChange={(event) => onZoneChange(event.target.value as WorldZoneId)}
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.journeyIndex + 1}. {zone.label}
                </option>
              ))}
            </select>
            <small>{zones.length} MAPS</small>
          </label>
          <div className="world-geometry-audit-layers" aria-label="진단 표시 필터">
            {worldGeometryAuditLayerKeys.map((layer) => (
              <button
                key={layer}
                type="button"
                aria-label={`${layerLabels[layer].accessible} ${layers[layer] ? "숨기기" : "표시"}`}
                aria-pressed={layers[layer]}
                onClick={() => onLayerChange(layer, !layers[layer])}
              >
                {layerLabels[layer].short}
              </button>
            ))}
            <small aria-label="구역 단축키">KEY 1–0 · [ ]</small>
          </div>
        </>
      ) : null}
    </aside>
  );
}

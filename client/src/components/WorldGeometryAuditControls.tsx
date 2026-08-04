import { MapPinned } from "lucide-react";
import type { WorldZoneId } from "@wedding-game/shared";
import type { WorldZone } from "../game/world";

type WorldGeometryAuditControlsProps = {
  zones: WorldZone[];
  activeZoneId: WorldZoneId;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onZoneChange: (zoneId: WorldZoneId) => void;
};

export function WorldGeometryAuditControls({
  zones,
  activeZoneId,
  enabled,
  onEnabledChange,
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
      ) : null}
    </aside>
  );
}

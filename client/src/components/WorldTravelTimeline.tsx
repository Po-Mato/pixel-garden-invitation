import { Footprints, MapPin, Route } from "lucide-react";
import type { WorldZoneId } from "@wedding-game/shared";
import type { WorldZone } from "../game/world";
import {
  worldTravelTimelineStops,
  type WorldTravelHistory
} from "../game/worldTravelHistory";

type WorldTravelTimelineProps = {
  zones: readonly WorldZone[];
  history: WorldTravelHistory;
  activeZoneId: WorldZoneId;
  disabled?: boolean;
  onSelectZone: (zoneId: WorldZoneId) => void;
};

export function WorldTravelTimeline({
  zones,
  history,
  activeZoneId,
  disabled = false,
  onSelectZone
}: WorldTravelTimelineProps) {
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  const stops = worldTravelTimelineStops(history, 7);
  return (
    <section className="world-travel-timeline" aria-label="최근 방문 여정">
      <header>
        <span><Route aria-hidden="true" /> 방문 타임라인</span>
        <strong>{history.visitedZoneIds.length}/{zones.length}</strong>
      </header>
      <ol>
        {stops.map((stop, index) => {
          const zone = zoneById.get(stop.zoneId);
          if (!zone) return null;
          return (
            <li key={`${stop.zoneId}-${stop.visitedAt ?? index}`} data-current={stop.zoneId === activeZoneId || undefined}>
              <button
                type="button"
                disabled={disabled || stop.zoneId === activeZoneId}
                aria-label={`${zone.label}${stop.zoneId === activeZoneId ? ", 현재 위치" : " 다시 이동"}`}
                onClick={() => onSelectZone(stop.zoneId)}
              >
                {index === stops.length - 1 ? <MapPin aria-hidden="true" /> : <Footprints aria-hidden="true" />}
                <span><strong>{zone.label}</strong><small>{stop.method === "portal" ? "포털 이동" : stop.method === "journey" ? "여정 이동" : "시작 지점"}</small></span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

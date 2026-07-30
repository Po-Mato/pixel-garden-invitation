import { useMemo } from "react";
import { gridTileSize } from "../game/movement";
import { auditWorldGeometry } from "../game/worldGeometryAudit";
import type { WorldZone } from "../game/world";

type WorldGeometryAuditOverlayProps = {
  zone: WorldZone;
  enabled: boolean;
};

export function WorldGeometryAuditOverlay({ zone, enabled }: WorldGeometryAuditOverlayProps) {
  const audit = useMemo(() => auditWorldGeometry(zone), [zone]);
  if (!enabled) return null;

  return (
    <div
      className="world-geometry-audit"
      data-testid="world-geometry-audit"
      data-zone={zone.id}
      data-issue-count={audit.issues.length}
      aria-hidden="true"
    >
      {audit.tiles.map((tile) => (
        <i
          key={`${tile.column}-${tile.row}`}
          className={`world-geometry-audit__tile world-geometry-audit__tile--${tile.state}`}
          style={{
            left: tile.x - gridTileSize / 2,
            top: tile.y - gridTileSize / 2,
            width: gridTileSize,
            height: gridTileSize
          }}
        />
      ))}
      <span className="world-geometry-audit__summary">
        이동 {audit.reachableCount} · 충돌 {audit.blockedCount} · 단절 {audit.unreachableCount}
      </span>
    </div>
  );
}

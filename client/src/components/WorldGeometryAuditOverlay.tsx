import { useMemo } from "react";
import { gridTileSize } from "../game/movement";
import { auditWorldGeometry } from "../game/worldGeometryAudit";
import { worldForegroundPlacements, type WorldZone } from "../game/world";

type WorldGeometryAuditOverlayProps = {
  zone: WorldZone;
  enabled: boolean;
};

export function WorldGeometryAuditOverlay({ zone, enabled }: WorldGeometryAuditOverlayProps) {
  const audit = useMemo(() => auditWorldGeometry(zone), [zone]);
  const foregrounds = worldForegroundPlacements[zone.id];
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
      {zone.blocked.map((collision, index) => (
        <i
          key={`collision-${index}`}
          className="world-geometry-audit__collision"
          data-collision-index={index}
          style={{
            left: collision.x,
            top: collision.y,
            width: collision.width,
            height: collision.height
          }}
        />
      ))}
      {foregrounds.map((placement) => (
        <div
          key={placement.decorationId}
          className="world-geometry-audit__foreground"
          data-decoration-id={placement.decorationId}
          data-depth-mode={placement.depthMode}
          style={{
            left: placement.x,
            top: placement.y,
            width: placement.width,
            height: placement.height
          }}
        >
          <i
            className="world-geometry-audit__depth"
            data-depth-y={placement.depthY}
            style={{ top: placement.depthY - placement.y }}
          />
          <small>{placement.decorationId}</small>
        </div>
      ))}
      <span className="world-geometry-audit__summary">
        <strong>MAP DIAGNOSTICS</strong>
        <em>이동 {audit.reachableCount} · 충돌 타일 {audit.blockedCount} · 단절 {audit.unreachableCount}</em>
        <small>청록 전경 · 금색 충돌 · 분홍 깊이선</small>
      </span>
    </div>
  );
}

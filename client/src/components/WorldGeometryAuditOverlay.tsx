import { useMemo } from "react";
import { gridTileSize } from "../game/movement";
import { auditWorldGeometry } from "../game/worldGeometryAudit";
import { worldForegroundPlacements, type WorldZone } from "../game/world";
import { recommendedForegroundDepthY } from "../game/worldForegroundDepthRecommendations";
import {
  defaultWorldGeometryAuditLayers,
  type WorldGeometryAuditLayers
} from "../game/worldGeometryAuditLayers";

type WorldGeometryAuditOverlayProps = {
  zone: WorldZone;
  enabled: boolean;
  layers?: WorldGeometryAuditLayers;
};

export function WorldGeometryAuditOverlay({
  zone,
  enabled,
  layers = defaultWorldGeometryAuditLayers
}: WorldGeometryAuditOverlayProps) {
  const audit = useMemo(() => auditWorldGeometry(zone), [zone]);
  const foregrounds = worldForegroundPlacements[zone.id];
  if (!enabled) return null;

  return (
    <div
      className="world-geometry-audit"
      data-testid="world-geometry-audit"
      data-zone={zone.id}
      data-issue-count={audit.issues.length}
      data-grid={layers.grid}
      data-collision={layers.collision}
      data-depth={layers.depth}
      data-labels={layers.labels}
      aria-hidden="true"
    >
      {layers.grid ? audit.tiles.map((tile) => (
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
      )) : null}
      {layers.collision ? zone.blocked.map((collision, index) => (
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
      )) : null}
      {layers.depth || layers.labels ? foregrounds.map((placement) => {
        const recommendedDepthY = recommendedForegroundDepthY(zone.id, placement.decorationId);
        return (
          <div
            key={placement.decorationId}
            className={`world-geometry-audit__foreground${layers.depth ? "" : " world-geometry-audit__foreground--label-only"}`}
            data-decoration-id={placement.decorationId}
            data-depth-mode={placement.depthMode}
            style={{
              left: placement.x,
              top: placement.y,
              width: placement.width,
              height: placement.height
            }}
          >
            {layers.depth ? (
              <>
                <i
                  className="world-geometry-audit__depth"
                  data-depth-y={placement.depthY}
                  style={{ top: placement.depthY - placement.y }}
                />
                {recommendedDepthY !== null && recommendedDepthY !== placement.depthY ? (
                  <i
                    className="world-geometry-audit__depth world-geometry-audit__depth--recommended"
                    data-recommended-depth-y={recommendedDepthY}
                    style={{ top: recommendedDepthY - placement.y }}
                  />
                ) : null}
              </>
            ) : null}
            {layers.labels ? <small>{placement.decorationId}</small> : null}
          </div>
        );
      }) : null}
      <span className="world-geometry-audit__summary">
        <strong>MAP DIAGNOSTICS</strong>
        <em>이동 {audit.reachableCount} · 충돌 타일 {audit.blockedCount} · 단절 {audit.unreachableCount}</em>
        <small className={audit.issues.length > 0 ? "world-geometry-audit__summary-issue" : undefined}>
          {audit.issues[0] ?? "분홍 현재 · 보라 점선 추천 · 금색 충돌"}
        </small>
      </span>
    </div>
  );
}

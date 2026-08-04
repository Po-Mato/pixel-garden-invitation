import { useMemo } from "react";
import { gridTileSize } from "../game/movement";
import { auditWorldGeometry } from "../game/worldGeometryAudit";
import { evaluateWorldGeometryAuditPolicy } from "../game/worldGeometryAuditPolicy";
import { worldForegroundPlacements, type WorldZone } from "../game/world";
import {
  foregroundGeometryDeltaIntensity,
  foregroundRecommendationReviewsForZone,
  type ForegroundRecommendationDecision
} from "../game/worldForegroundRecommendations";
import {
  defaultWorldGeometryAuditLayers,
  type WorldGeometryAuditLayers
} from "../game/worldGeometryAuditLayers";

function unionRect(
  left: { x: number; y: number; width: number; height: number } | null | undefined,
  right: { x: number; y: number; width: number; height: number } | null | undefined
) {
  if (!left) return right ?? null;
  if (!right) return left;
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  return {
    x,
    y,
    width: Math.max(left.x + left.width, right.x + right.width) - x,
    height: Math.max(left.y + left.height, right.y + right.height) - y
  };
}

type WorldGeometryAuditOverlayProps = {
  zone: WorldZone;
  enabled: boolean;
  layers?: WorldGeometryAuditLayers;
  recommendationDecisions?: Partial<Record<string, ForegroundRecommendationDecision>>;
};

export function WorldGeometryAuditOverlay({
  zone,
  enabled,
  layers = defaultWorldGeometryAuditLayers,
  recommendationDecisions = {}
}: WorldGeometryAuditOverlayProps) {
  const audit = useMemo(() => auditWorldGeometry(zone), [zone]);
  const policy = useMemo(() => evaluateWorldGeometryAuditPolicy(audit), [audit]);
  const foregrounds = worldForegroundPlacements[zone.id];
  const recommendationReviews = useMemo(() => foregroundRecommendationReviewsForZone(zone.id), [zone.id]);
  const recommendationById = new Map(
    recommendationReviews.map((review) => [review.decorationId, review])
  );
  if (!enabled) return null;

  return (
    <div
      className="world-geometry-audit"
      data-testid="world-geometry-audit"
      data-zone={zone.id}
      data-issue-count={audit.issues.length}
      data-blocking-count={audit.severityCounts.blocking}
      data-warning-count={audit.severityCounts.warning}
      data-policy-status={policy.status}
      data-grid={layers.grid}
      data-collision={layers.collision}
      data-depth={layers.depth}
      data-heatmap={layers.heatmap}
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
      {layers.collision ? recommendationReviews.flatMap((review) => {
        if (!review.collisionChanged) return [];
        const decision = recommendationDecisions[review.key] ?? "pending";
        return [
          review.current.collision ? (
            <i
              key={`${review.key}-current-collision`}
              className="world-geometry-audit__foreground-collision world-geometry-audit__foreground-collision--current"
              data-decoration-id={review.decorationId}
              data-collision-state="current"
              style={{
                left: review.current.collision.x,
                top: review.current.collision.y,
                width: review.current.collision.width,
                height: review.current.collision.height
              }}
            />
          ) : null,
          review.recommended.collision ? (
            <i
              key={`${review.key}-recommended-collision`}
              className="world-geometry-audit__foreground-collision world-geometry-audit__foreground-collision--recommended"
              data-decoration-id={review.decorationId}
              data-collision-state="recommended"
              data-review-decision={decision}
              style={{
                left: review.recommended.collision.x,
                top: review.recommended.collision.y,
                width: review.recommended.collision.width,
                height: review.recommended.collision.height
              }}
            />
          ) : null
        ].filter(Boolean);
      }) : null}
      {layers.heatmap ? recommendationReviews.flatMap((review) => {
        const intensity = foregroundGeometryDeltaIntensity(review);
        const placement = foregrounds.find((candidate) => candidate.decorationId === review.decorationId);
        const collisionDelta = review.collisionChanged
          ? unionRect(review.current.collision, review.recommended.collision)
          : null;
        return [
          collisionDelta ? (
            <i
              key={`${review.key}-collision-heatmap`}
              className="world-geometry-audit__heatmap world-geometry-audit__heatmap--collision"
              data-decoration-id={review.decorationId}
              data-delta-intensity={intensity}
              style={{ left: collisionDelta.x, top: collisionDelta.y, width: collisionDelta.width, height: collisionDelta.height }}
            />
          ) : null,
          review.depthChanged && placement ? (
            <i
              key={`${review.key}-depth-heatmap`}
              className="world-geometry-audit__heatmap world-geometry-audit__heatmap--depth"
              data-decoration-id={review.decorationId}
              data-delta-intensity={intensity}
              style={{
                left: placement.x,
                top: Math.min(review.current.depthY, review.recommended.depthY) - 2,
                width: placement.width,
                height: Math.max(5, Math.abs(review.current.depthY - review.recommended.depthY) + 4)
              }}
            />
          ) : null
        ].filter(Boolean);
      }) : null}
      {layers.depth || layers.labels ? foregrounds.map((placement) => {
        const review = recommendationById.get(placement.decorationId);
        const recommendedDepthY = review?.recommended.depthY ?? null;
        const decision = review ? recommendationDecisions[review.key] ?? "pending" : null;
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
                    data-review-decision={decision}
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
        <small
          className={audit.findings.length > 0 ? `world-geometry-audit__summary-issue world-geometry-audit__summary-issue--${audit.findings[0].severity}` : undefined}
        >
          {audit.findings[0]?.message ?? "깊이 분홍/보라 · 충돌 청록/보라 · 차이 히트 Δ"}
        </small>
      </span>
    </div>
  );
}

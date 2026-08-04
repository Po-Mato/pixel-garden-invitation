import { useState } from "react";
import { MapPinned } from "lucide-react";
import type { WorldZoneId } from "@wedding-game/shared";
import type { WorldZone } from "../game/world";
import type { WorldGeometryAuditSeverityCounts } from "../game/worldGeometryAudit";
import {
  worldGeometryAuditLayerKeys,
  type WorldGeometryAuditLayerKey,
  type WorldGeometryAuditLayers
} from "../game/worldGeometryAuditLayers";
import type {
  ForegroundRecommendationDecision,
  WorldForegroundRecommendationReview
} from "../game/worldForegroundRecommendations";

type WorldGeometryAuditControlsProps = {
  zones: WorldZone[];
  activeZoneId: WorldZoneId;
  enabled: boolean;
  issueCounts: Partial<Record<WorldZoneId, WorldGeometryAuditSeverityCounts>>;
  layers: WorldGeometryAuditLayers;
  copyStatus: "idle" | "copied" | "error";
  patchStatus: "idle" | "saved" | "error";
  bundleStatus: "idle" | "capturing" | "saved" | "error";
  recommendations: WorldForegroundRecommendationReview[];
  recommendationDecisions: Partial<Record<string, ForegroundRecommendationDecision>>;
  onDownloadBundle: () => void;
  onDownloadPatch: () => void;
  onOpenBundleViewer: () => void;
  onCopyLink: () => void;
  onEnabledChange: (enabled: boolean) => void;
  onLayerChange: (layer: WorldGeometryAuditLayerKey, enabled: boolean) => void;
  onNextIssue: () => void;
  onRecommendationDecision: (key: string, decision: ForegroundRecommendationDecision) => void;
  onZoneChange: (zoneId: WorldZoneId) => void;
};

const layerLabels: Record<WorldGeometryAuditLayerKey, { short: string; accessible: string }> = {
  grid: { short: "GRID", accessible: "이동 격자" },
  collision: { short: "HIT", accessible: "충돌 영역" },
  depth: { short: "DEPTH", accessible: "전경 깊이선" },
  heatmap: { short: "Δ", accessible: "추천 차이 히트맵" },
  labels: { short: "ID", accessible: "전경 식별자" }
};

export function WorldGeometryAuditControls({
  zones,
  activeZoneId,
  enabled,
  issueCounts,
  layers,
  copyStatus,
  patchStatus,
  bundleStatus,
  recommendations,
  recommendationDecisions,
  onDownloadBundle,
  onDownloadPatch,
  onOpenBundleViewer,
  onCopyLink,
  onEnabledChange,
  onLayerChange,
  onNextIssue,
  onRecommendationDecision,
  onZoneChange
}: WorldGeometryAuditControlsProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const issueTotal = zones.reduce((total, zone) => (
    total + (issueCounts[zone.id]?.blocking ?? 0) + (issueCounts[zone.id]?.warning ?? 0)
  ), 0);
  const blockingTotal = zones.reduce((total, zone) => total + (issueCounts[zone.id]?.blocking ?? 0), 0);
  const warningTotal = zones.reduce((total, zone) => total + (issueCounts[zone.id]?.warning ?? 0), 0);
  const acceptedTotal = Object.values(recommendationDecisions)
    .filter((decision) => decision === "accepted").length;
  const decidedInZone = recommendations.filter((recommendation) => (
    recommendationDecisions[recommendation.key] === "accepted"
    || recommendationDecisions[recommendation.key] === "rejected"
  )).length;
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
                  {(issueCounts[zone.id]?.blocking ?? 0) > 0 ? ` · B${issueCounts[zone.id]?.blocking}` : ""}
                  {(issueCounts[zone.id]?.warning ?? 0) > 0 ? ` · W${issueCounts[zone.id]?.warning}` : ""}
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
          <div className="world-geometry-audit-actions">
            <button
              type="button"
              className="world-geometry-audit-issues"
              aria-label={issueTotal > 0
                ? `다음 진단 오류 구역으로 이동, 차단 ${blockingTotal}건 경고 ${warningTotal}건`
                : "진단 오류 없음"}
              disabled={issueTotal === 0}
              onClick={onNextIssue}
            >
              <span>{blockingTotal > 0 ? "BLOCK" : "WARN"}</span>{" "}
              {issueTotal > 0 ? `${blockingTotal}/${warningTotal} · NEXT` : "0 · CLEAR"}
            </button>
            <button
              type="button"
              className="world-geometry-audit-copy"
              aria-label="현재 진단 링크 복사"
              onClick={onCopyLink}
            >
              {copyStatus === "copied" ? "COPIED" : copyStatus === "error" ? "RETRY" : "COPY URL"}
            </button>
            <button
              type="button"
              className="world-geometry-audit-review-toggle"
              aria-label="전경 추천 검토 열기"
              aria-expanded={reviewOpen}
              onClick={() => setReviewOpen((current) => !current)}
            >
              REVIEW {decidedInZone}/{recommendations.length}
            </button>
            <button
              type="button"
              className="world-geometry-audit-bundle"
              aria-label="현재 화면 진단 번들 저장"
              disabled={bundleStatus === "capturing"}
              onClick={onDownloadBundle}
            >
              {bundleStatus === "capturing"
                ? "PACKING"
                : bundleStatus === "saved" ? "BUNDLE ✓" : bundleStatus === "error" ? "BUNDLE !" : "BUNDLE"}
            </button>
          </div>
          {reviewOpen ? (
            <section className="world-geometry-audit-review" aria-label="현재 구역 전경 추천 검토">
              <header>
                <span>RECOMMENDATION QUEUE</span>
                <div className="world-geometry-audit-review__tools">
                  <button type="button" aria-label="진단 번들 뷰어 열기" onClick={onOpenBundleViewer}>VIEW</button>
                  <button
                    type="button"
                    aria-label={`승인 추천 JSON patch 저장, ${acceptedTotal}개 선택`}
                    disabled={acceptedTotal === 0}
                    onClick={onDownloadPatch}
                  >
                    {patchStatus === "saved" ? "PATCH ✓" : patchStatus === "error" ? "PATCH !" : `PATCH ${acceptedTotal}`}
                  </button>
                </div>
              </header>
              {recommendations.length > 0 ? (
                <ul>
                  {recommendations.map((recommendation) => {
                    const decision = recommendationDecisions[recommendation.key] ?? "pending";
                    return (
                      <li key={recommendation.key} data-decision={decision}>
                        <span>
                          <strong title={recommendation.decorationId}>{recommendation.decorationId}</strong>
                          <small>
                            {recommendation.depthChanged
                              ? `D ${recommendation.current.depthY}→${recommendation.recommended.depthY}`
                              : "D KEEP"}
                            {" · "}{recommendation.collisionChanged ? "H CHANGE" : "H KEEP"}
                          </small>
                        </span>
                        <button
                          type="button"
                          aria-label={`${recommendation.decorationId} 추천 승인`}
                          aria-pressed={decision === "accepted"}
                          onClick={() => onRecommendationDecision(
                            recommendation.key,
                            decision === "accepted" ? "pending" : "accepted"
                          )}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          aria-label={`${recommendation.decorationId} 추천 거절`}
                          aria-pressed={decision === "rejected"}
                          onClick={() => onRecommendationDecision(
                            recommendation.key,
                            decision === "rejected" ? "pending" : "rejected"
                          )}
                        >
                          R
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p>NO GEOMETRY CHANGES</p>}
            </section>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}

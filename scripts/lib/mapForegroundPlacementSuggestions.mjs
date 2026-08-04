function round(value) {
  return Math.round(value * 100) / 100;
}

export function clampRectToBounds(rect, bounds) {
  const left = Math.max(bounds.x, rect.x);
  const top = Math.max(bounds.y, rect.y);
  const right = Math.min(bounds.x + bounds.width, rect.x + rect.width);
  const bottom = Math.min(bounds.y + bounds.height, rect.y + rect.height);
  return {
    x: round(left),
    y: round(top),
    width: round(Math.max(0, right - left)),
    height: round(Math.max(0, bottom - top))
  };
}

function sameRect(left, right) {
  return Boolean(left && right && ["x", "y", "width", "height"].every((key) => left[key] === right[key]));
}

export function recommendForegroundPlacementGeometry(metric, {
  depthPadding = 0,
  collisionPadding = 4
} = {}) {
  const { placement, visibleBounds } = metric;
  const placementBounds = {
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height
  };
  const placementBottom = placement.y + placement.height;
  const visibleBottom = visibleBounds.y + visibleBounds.height;
  const recommendedDepthY = placement.depthMode === "floor"
    ? round(Math.min(placementBottom, visibleBottom + depthPadding))
    : placement.depthY;
  const collisionTop = visibleBounds.y - collisionPadding;
  const collisionBottom = Math.max(visibleBottom + collisionPadding, recommendedDepthY);
  const recommendedCollision = placement.depthMode === "floor"
    ? clampRectToBounds({
        x: visibleBounds.x - collisionPadding,
        y: collisionTop,
        width: visibleBounds.width + collisionPadding * 2,
        height: collisionBottom - collisionTop
      }, placementBounds)
    : placement.collision ?? null;

  return {
    zoneId: metric.zoneId,
    decorationId: placement.decorationId,
    depthMode: placement.depthMode,
    visibleBounds,
    placementBounds,
    current: {
      depthY: placement.depthY,
      collision: placement.collision ?? null
    },
    recommended: {
      depthY: recommendedDepthY,
      collision: recommendedCollision
    },
    depthDelta: round(recommendedDepthY - placement.depthY),
    depthAction: recommendedDepthY === placement.depthY ? "keep" : "review-update",
    collisionAction: placement.depthMode === "overhead"
      ? placement.collision === undefined ? "not-applicable" : "keep"
      : placement.collision === undefined
        ? "optional-add"
        : sameRect(placement.collision, recommendedCollision) ? "keep" : "review-update",
    reason: placement.depthMode === "floor"
      ? "보이는 알파 픽셀의 하단을 기준으로 바닥 깊이선을 맞춘 제안"
      : "머리 위 전경은 의미 기반 수동 깊이값을 유지하는 제안"
  };
}

export function buildMapForegroundPlacementSuggestions(audit, options = {}) {
  const suggestions = audit.metrics.map((metric) => recommendForegroundPlacementGeometry(metric, options));
  return {
    version: 1,
    zoneCount: audit.zoneIds.length,
    instanceCount: audit.instanceCount,
    reviewCount: suggestions.filter((suggestion) => (
      suggestion.depthAction !== "keep" || suggestion.collisionAction === "review-update"
    )).length,
    note: "읽기 전용 제안입니다. 배치 계약은 자동 수정하지 않습니다.",
    suggestions
  };
}

function escapeJsonPointerSegment(segment) {
  return String(segment).replaceAll("~", "~0").replaceAll("/", "~1");
}

function unescapeJsonPointerSegment(segment) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

export function buildForegroundPlacementJsonPatch(contract, suggestions, {
  includeOptionalCollisions = false
} = {}) {
  const suggestionById = new Map(suggestions.map((suggestion) => [suggestion.decorationId, suggestion]));
  const operations = [];
  for (const [zoneId, placements] of Object.entries(contract.zones)) {
    placements.forEach((placement, index) => {
      const suggestion = suggestionById.get(placement.decorationId);
      if (!suggestion || suggestion.zoneId !== zoneId) return;
      const basePath = `/zones/${escapeJsonPointerSegment(zoneId)}/${index}`;
      if (suggestion.depthAction === "review-update") {
        operations.push({ op: "replace", path: `${basePath}/depthY`, value: suggestion.recommended.depthY });
      }
      if (suggestion.collisionAction === "review-update") {
        operations.push({ op: "replace", path: `${basePath}/collision`, value: suggestion.recommended.collision });
      } else if (includeOptionalCollisions && suggestion.collisionAction === "optional-add") {
        operations.push({ op: "add", path: `${basePath}/collision`, value: suggestion.recommended.collision });
      }
    });
  }
  return operations;
}

export function applyForegroundPlacementJsonPatch(contract, operations) {
  const nextContract = structuredClone(contract);
  for (const operation of operations) {
    if (operation.op !== "add" && operation.op !== "replace" && operation.op !== "remove") {
      throw new Error(`지원하지 않는 전경 JSON patch 연산: ${operation.op}`);
    }
    const segments = operation.path.split("/").slice(1).map(unescapeJsonPointerSegment);
    if (segments.length === 0) throw new Error("전경 JSON patch 경로가 비어 있습니다");
    let target = nextContract;
    for (const segment of segments.slice(0, -1)) {
      if (target?.[segment] === undefined) throw new Error(`전경 JSON patch 경로가 없습니다: ${operation.path}`);
      target = target[segment];
    }
    const property = segments.at(-1);
    if ((operation.op === "replace" || operation.op === "remove") && target?.[property] === undefined) {
      throw new Error(`교체할 전경 JSON patch 값이 없습니다: ${operation.path}`);
    }
    if (operation.op === "remove") delete target[property];
    else target[property] = structuredClone(operation.value);
  }
  return nextContract;
}

export function buildForegroundPlacementPatchPreview(contract, suggestions, options = {}) {
  const operations = buildForegroundPlacementJsonPatch(contract, suggestions, options);
  return {
    version: 1,
    target: "client/src/game/worldForegroundPlacements.json",
    operationCount: operations.length,
    includesOptionalCollisions: options.includeOptionalCollisions === true,
    operations,
    proposedContract: applyForegroundPlacementJsonPatch(contract, operations)
  };
}

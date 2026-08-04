export const worldGeometryAuditLayerKeys = ["grid", "collision", "depth", "labels"] as const;

export type WorldGeometryAuditLayerKey = typeof worldGeometryAuditLayerKeys[number];
export type WorldGeometryAuditLayers = Record<WorldGeometryAuditLayerKey, boolean>;

export const defaultWorldGeometryAuditLayers: WorldGeometryAuditLayers = {
  grid: true,
  collision: true,
  depth: true,
  labels: true
};

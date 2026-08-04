export const worldGeometryAuditHeatmapModes = ["color", "pattern", "contrast"] as const;

export type WorldGeometryAuditHeatmapMode = typeof worldGeometryAuditHeatmapModes[number];

export const defaultWorldGeometryAuditHeatmapMode: WorldGeometryAuditHeatmapMode = "color";

export function parseWorldGeometryAuditHeatmapMode(value: string | null): WorldGeometryAuditHeatmapMode {
  return worldGeometryAuditHeatmapModes.includes(value as WorldGeometryAuditHeatmapMode)
    ? value as WorldGeometryAuditHeatmapMode
    : defaultWorldGeometryAuditHeatmapMode;
}

import type { WorldZoneId } from "@wedding-game/shared";

export const worldGeometryAuditLayerKeys = ["grid", "collision", "depth", "labels"] as const;

export type WorldGeometryAuditLayerKey = typeof worldGeometryAuditLayerKeys[number];
export type WorldGeometryAuditLayers = Record<WorldGeometryAuditLayerKey, boolean>;

export const defaultWorldGeometryAuditLayers: WorldGeometryAuditLayers = {
  grid: true,
  collision: true,
  depth: true,
  labels: true
};

export function parseWorldGeometryAuditLayers(value: string | null): WorldGeometryAuditLayers {
  if (value === null) return { ...defaultWorldGeometryAuditLayers };
  const enabled = new Set(value.split(",").filter((layer): layer is WorldGeometryAuditLayerKey => (
    worldGeometryAuditLayerKeys.includes(layer as WorldGeometryAuditLayerKey)
  )));
  return Object.fromEntries(worldGeometryAuditLayerKeys.map((layer) => [layer, enabled.has(layer)])) as WorldGeometryAuditLayers;
}

export function serializeWorldGeometryAuditLayers(layers: WorldGeometryAuditLayers): string {
  return worldGeometryAuditLayerKeys.filter((layer) => layers[layer]).join(",");
}

export function nextWorldGeometryIssueZone(
  zoneIds: readonly WorldZoneId[],
  issueCounts: Partial<Record<WorldZoneId, number>>,
  activeZoneId: WorldZoneId
): WorldZoneId | null {
  if (zoneIds.length === 0) return null;
  const activeIndex = Math.max(0, zoneIds.indexOf(activeZoneId));
  for (let offset = 1; offset <= zoneIds.length; offset += 1) {
    const zoneId = zoneIds[(activeIndex + offset) % zoneIds.length];
    if ((issueCounts[zoneId] ?? 0) > 0) return zoneId;
  }
  return null;
}

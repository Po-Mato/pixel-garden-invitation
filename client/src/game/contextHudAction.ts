import type { NpcId } from "./npcDialogue";
import { portalEntryRect, type Point, type Rect, type WorldPhotoSpot, type WorldPortal } from "./world";

export type ContextHudAction = {
  kind: "portal" | "photo" | "npc" | "quest";
  id: string;
  label: string;
  actionLabel: string;
  distance: number;
  progressLabel?: string;
};

export type ContextHudNpc = {
  id: NpcId;
  label: string;
  point: Point;
};

type ContextHudInput = {
  player: Point;
  portals: readonly WorldPortal[];
  photoSpots: readonly WorldPhotoSpot[];
  npcs: readonly ContextHudNpc[];
};

const portalRange = 120;
const npcRange = 110;

export function distanceFromPointToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

export function resolveContextHudAction({ player, portals, photoSpots, npcs }: ContextHudInput): ContextHudAction | null {
  const candidates: ContextHudAction[] = [];

  portals.forEach((portal) => {
    const distance = distanceFromPointToRect(player, portalEntryRect(portal));
    if (distance <= portalRange) {
      candidates.push({ kind: "portal", id: portal.id, label: portal.label, actionLabel: "이동", distance });
    }
  });
  photoSpots.forEach((photoSpot) => {
    const distance = distanceFromPointToRect(player, photoSpot);
    if (distance <= photoSpot.actionRadius + 48) {
      candidates.push({ kind: "photo", id: photoSpot.id, label: photoSpot.label, actionLabel: "촬영", distance });
    }
  });
  npcs.forEach((npc) => {
    const distance = Math.hypot(npc.point.x - player.x, npc.point.y - player.y);
    if (distance <= npcRange) {
      candidates.push({ kind: "npc", id: npc.id, label: npc.label, actionLabel: "대화", distance });
    }
  });

  return candidates.sort((left, right) => left.distance - right.distance)[0] ?? null;
}

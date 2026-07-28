import { portalEntryRect, type Point, type Rect, type WorldZone } from "./world";

export type WorldAccessibilityLandmark = {
  id: string;
  label: string;
  kindLabel: string;
  directionLabel: string;
  tileDistance: number;
  phrase: string;
};

function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function relativeWorldDirection(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) <= 24) return "현재 위치 근처";
  if (Math.abs(dx) > Math.abs(dy) * 1.4) return dx > 0 ? "오른쪽" : "왼쪽";
  if (Math.abs(dy) > Math.abs(dx) * 1.4) return dy > 0 ? "아래쪽" : "위쪽";
  return `${dy > 0 ? "아래" : "위"} ${dx > 0 ? "오른쪽" : "왼쪽"}`;
}

export function worldAccessibilityLandmarks(
  zone: WorldZone,
  player: Point,
  limit = 7
): WorldAccessibilityLandmark[] {
  const landmarks = [
    ...zone.spots.map((spot) => ({ id: spot.id, label: spot.label, kindLabel: "장소", point: rectCenter(spot) })),
    ...zone.photoSpots.map((spot) => ({ id: spot.id, label: spot.label, kindLabel: "포토존", point: rectCenter(spot) })),
    ...zone.portals.map((portal) => ({ id: portal.id, label: portal.label, kindLabel: "이동 포털", point: rectCenter(portalEntryRect(portal)) })),
    ...zone.npcs.map((npc) => ({ id: npc.id, label: npc.label, kindLabel: "안내 인물", point: { x: npc.x, y: npc.y } }))
  ];
  return landmarks
    .map((landmark) => {
      const distance = Math.hypot(landmark.point.x - player.x, landmark.point.y - player.y);
      const tileDistance = Math.max(0, Math.round(distance / 30));
      const directionLabel = relativeWorldDirection(player, landmark.point);
      return {
        ...landmark,
        directionLabel,
        tileDistance,
        phrase: `${landmark.kindLabel} ${landmark.label}, ${directionLabel}, 약 ${tileDistance}칸`
      };
    })
    .sort((left, right) => left.tileDistance - right.tileDistance)
    .slice(0, limit);
}

export function nearestWorldLandmark(zone: WorldZone, player: Point) {
  return worldAccessibilityLandmarks(zone, player, 1)[0] ?? null;
}

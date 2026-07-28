import type { RoomGuest, WorldZoneId } from "@wedding-game/shared";
import type { Point } from "./world";

export type CompanionCandidate = Pick<RoomGuest, "guestId" | "nickname" | "x" | "y" | "zoneId" | "appearance">;

export function companionCandidates(
  guests: readonly CompanionCandidate[],
  zoneId: WorldZoneId,
  position: Point,
  limit = 3
): CompanionCandidate[] {
  return guests
    .filter((guest) => guest.zoneId === zoneId)
    .sort((left, right) => (
      Math.hypot(left.x - position.x, left.y - position.y)
      - Math.hypot(right.x - position.x, right.y - position.y)
    ))
    .slice(0, limit);
}

export function companionFollowPath<PointType>(
  path: readonly PointType[],
  trailingTiles = 2
): PointType[] {
  return path.slice(0, Math.max(0, path.length - trailingTiles));
}

export function nearbyPhotoCompanions(
  guests: readonly CompanionCandidate[],
  zoneId: WorldZoneId,
  position: Point,
  radius = 180,
  limit = 2
): CompanionCandidate[] {
  return companionCandidates(guests, zoneId, position, guests.length)
    .filter((guest) => Math.hypot(guest.x - position.x, guest.y - position.y) <= radius)
    .slice(0, limit);
}

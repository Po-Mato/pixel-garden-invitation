import type { RoomGuest, WorldZoneId } from "@wedding-game/shared";
import type { Point } from "./world";

export const realtimeIdentityStorageKey = "wedding-game:realtime-identity:v1";
export const companionSessionStorageKey = "wedding-game:companion-session:v1";
const companionSessionMaxAgeMs = 12 * 60 * 60 * 1000;

type CompanionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type CompanionRole = "leader" | "follower";

export type CompanionSession = {
  companionGuestId: string;
  companionNickname: string;
  role: CompanionRole;
  updatedAt: string;
};

export type CompanionInviteLink = {
  targetGuestId: string;
  zoneId: WorldZoneId;
};

function browserStorage(): CompanionStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function validIdentity(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{12,64}$/.test(value);
}

function createIdentity() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replaceAll("-", "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 18)}`.slice(0, 32);
}

export function loadRealtimeIdentity(
  storage: CompanionStorage | null = browserStorage(),
  factory: () => string = createIdentity
) {
  try {
    const stored = storage?.getItem(realtimeIdentityStorageKey);
    if (validIdentity(stored)) return stored;
    const created = factory();
    if (!validIdentity(created)) return "local-wedding-guest";
    storage?.setItem(realtimeIdentityStorageKey, created);
    return created;
  } catch {
    return "local-wedding-guest";
  }
}

export function saveCompanionSession(
  session: Omit<CompanionSession, "updatedAt">,
  storage: CompanionStorage | null = browserStorage(),
  updatedAt = new Date().toISOString()
) {
  try {
    storage?.setItem(companionSessionStorageKey, JSON.stringify({ ...session, updatedAt }));
    return storage !== null;
  } catch {
    return false;
  }
}

export function loadCompanionSession(
  storage: CompanionStorage | null = browserStorage(),
  now = Date.now()
): CompanionSession | null {
  try {
    const parsed = JSON.parse(storage?.getItem(companionSessionStorageKey) ?? "null") as Partial<CompanionSession> | null;
    if (
      !parsed
      || typeof parsed.companionGuestId !== "string"
      || !parsed.companionGuestId.startsWith("guest_")
      || typeof parsed.companionNickname !== "string"
      || !parsed.companionNickname.trim()
      || (parsed.role !== "leader" && parsed.role !== "follower")
      || typeof parsed.updatedAt !== "string"
    ) return null;
    const updatedAt = Date.parse(parsed.updatedAt);
    if (!Number.isFinite(updatedAt) || now - updatedAt > companionSessionMaxAgeMs) return null;
    return {
      companionGuestId: parsed.companionGuestId,
      companionNickname: parsed.companionNickname.trim().slice(0, 20),
      role: parsed.role,
      updatedAt: parsed.updatedAt
    };
  } catch {
    return null;
  }
}

export function clearCompanionSession(storage: CompanionStorage | null = browserStorage()) {
  try {
    storage?.removeItem(companionSessionStorageKey);
  } catch {
    // Storage cleanup is best effort.
  }
}

export function createCompanionInviteUrl(currentUrl: string, identity: string, zoneId: WorldZoneId) {
  const url = new URL(currentUrl);
  url.searchParams.delete("admin");
  url.searchParams.delete("view");
  url.searchParams.set("together", identity);
  url.searchParams.set("togetherZone", zoneId);
  url.hash = "";
  return url.toString();
}

export function parseCompanionInviteUrl(currentUrl: string): CompanionInviteLink | null {
  const url = new URL(currentUrl);
  const identity = url.searchParams.get("together");
  const zoneId = url.searchParams.get("togetherZone");
  const validZones = new Set<WorldZoneId>([
    "home", "neighborhood", "subway-station", "subway-train", "venue-exterior",
    "lobby", "bridal-room", "ceremony-hall", "banquet", "restroom"
  ]);
  if (!validIdentity(identity) || !validZones.has(zoneId as WorldZoneId)) return null;
  return { targetGuestId: `guest_${identity}`, zoneId: zoneId as WorldZoneId };
}

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

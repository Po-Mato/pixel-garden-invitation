import type { RoomGuest, WorldZoneId } from "@wedding-game/shared";
import type { Point } from "./world";

export const realtimeIdentityStorageKey = "wedding-game:realtime-identity:v1";
export const companionSessionStorageKey = "wedding-game:companion-session:v1";
export const companionInviteLifetimeMs = 10 * 60 * 1000;
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
  expiresAt: number;
  inviteCode: string;
};

export type CompanionInviteInspection =
  | { status: "valid"; invite: CompanionInviteLink }
  | { status: "expired"; expiresAt: number }
  | { status: "invalid" };

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

const companionInviteCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createCompanionInviteCode(random: () => number = Math.random) {
  return Array.from({ length: 6 }, () => companionInviteCodeAlphabet[
    Math.min(companionInviteCodeAlphabet.length - 1, Math.max(0, Math.floor(random() * companionInviteCodeAlphabet.length)))
  ]).join("");
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

export function createCompanionInviteUrl(
  currentUrl: string,
  identity: string,
  zoneId: WorldZoneId,
  expiresAt = Date.now() + companionInviteLifetimeMs,
  inviteCode = createCompanionInviteCode()
) {
  const url = new URL(currentUrl);
  url.searchParams.delete("admin");
  url.searchParams.delete("view");
  url.searchParams.set("together", identity);
  url.searchParams.set("togetherZone", zoneId);
  url.searchParams.set("togetherExpires", String(Math.floor(expiresAt)));
  url.searchParams.set("togetherCode", inviteCode);
  url.hash = "";
  return url.toString();
}

export function inspectCompanionInviteUrl(
  currentUrl: string,
  now = Date.now()
): CompanionInviteInspection {
  const url = new URL(currentUrl);
  const identity = url.searchParams.get("together");
  const zoneId = url.searchParams.get("togetherZone");
  const expiresAt = Number(url.searchParams.get("togetherExpires"));
  const inviteCode = url.searchParams.get("togetherCode");
  const validZones = new Set<WorldZoneId>([
    "home", "neighborhood", "subway-station", "subway-train", "venue-exterior",
    "lobby", "bridal-room", "ceremony-hall", "banquet", "restroom"
  ]);
  if (
    !validIdentity(identity)
    || !validZones.has(zoneId as WorldZoneId)
    || !Number.isSafeInteger(expiresAt)
    || expiresAt <= 0
    || typeof inviteCode !== "string"
    || !/^[A-HJ-NP-Z2-9]{6}$/.test(inviteCode)
  ) return { status: "invalid" };
  if (expiresAt <= now) return { status: "expired", expiresAt };
  return {
    status: "valid",
    invite: { targetGuestId: `guest_${identity}`, zoneId: zoneId as WorldZoneId, expiresAt, inviteCode }
  };
}

export function parseCompanionInviteUrl(currentUrl: string, now = Date.now()): CompanionInviteLink | null {
  const inspection = inspectCompanionInviteUrl(currentUrl, now);
  return inspection.status === "valid" ? inspection.invite : null;
}

export function companionInviteRemainingLabel(expiresAt: number, now = Date.now()) {
  const remaining = Math.max(0, expiresAt - now);
  if (remaining === 0) return "만료됨";
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

export function appendCompanionTrailPoint(
  points: readonly Point[],
  next: Point,
  minimumDistance = 12,
  limit = 14
): Point[] {
  const previous = points.at(-1);
  if (previous && Math.hypot(next.x - previous.x, next.y - previous.y) < minimumDistance) {
    return [...points];
  }
  return [...points, { x: next.x, y: next.y }].slice(-Math.max(2, limit));
}

export function companionRendezvousPoint(player: Point, companion: Point): Point {
  return {
    x: (player.x + companion.x) / 2,
    y: (player.y + companion.y) / 2
  };
}

export function companionRendezvousReplanPoint(
  currentPoint: Point,
  player: Point,
  companion: Point,
  tileSize = 30,
  thresholdTiles = 4
): Point | null {
  const nextPoint = companionRendezvousPoint(player, companion);
  return Math.hypot(nextPoint.x - currentPoint.x, nextPoint.y - currentPoint.y)
    >= Math.max(1, tileSize) * Math.max(1, thresholdTiles)
    ? nextPoint
    : null;
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

export type CompanionArrivalEstimate = {
  locationLabel: string;
  distanceTiles: number | null;
  etaLabel: string;
};

export function companionArrivalEstimate(
  playerPosition: Point,
  playerZoneId: WorldZoneId,
  companion: Pick<CompanionCandidate, "x" | "y" | "zoneId"> | null,
  companionZoneLabel: string,
  tileSize = 24,
  millisecondsPerTile = 260
): CompanionArrivalEstimate {
  if (!companion) {
    return { locationLabel: "위치 확인 중", distanceTiles: null, etaLabel: "재접속 대기" };
  }
  if (companion.zoneId !== playerZoneId) {
    return { locationLabel: companionZoneLabel, distanceTiles: null, etaLabel: "포털 이동 필요" };
  }
  const deltaX = companion.x - playerPosition.x;
  const deltaY = companion.y - playerPosition.y;
  const distanceTiles = Math.ceil(Math.hypot(deltaX, deltaY) / Math.max(1, tileSize));
  const direction = Math.abs(deltaX) >= Math.abs(deltaY)
    ? deltaX >= 0 ? "오른쪽" : "왼쪽"
    : deltaY >= 0 ? "아래쪽" : "위쪽";
  if (distanceTiles <= 1) {
    return { locationLabel: `${companionZoneLabel} · 바로 옆`, distanceTiles, etaLabel: "도착" };
  }
  const seconds = Math.max(5, Math.ceil((distanceTiles * millisecondsPerTile / 1_000) / 5) * 5);
  return {
    locationLabel: `${companionZoneLabel} · ${direction} 약 ${distanceTiles}칸`,
    distanceTiles,
    etaLabel: `약 ${seconds}초`
  };
}

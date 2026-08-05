import type { Direction, WorldZoneId } from "@wedding-game/shared";
import { isBlocked } from "./geometry";
import { snapToGrid } from "./movement";
import { gardenWorld, getWorldZone, type Point } from "./world";

export const worldSessionStorageKey = "wedding-game:world-session:v1";

export type WorldSession = {
  version: 1;
  zoneId: WorldZoneId;
  position: Point;
  direction: Direction;
  guideCheckpointId: string | null;
  updatedAt: string;
};

type WorldSessionStorage = Pick<Storage, "getItem" | "setItem">;

const directions = new Set<Direction>(["up", "down", "left", "right"]);
const legacyHomeSpawn = { x: 285, y: 555 } as const;

function browserStorage(): WorldSessionStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function validZoneId(value: unknown): value is WorldZoneId {
  return typeof value === "string" && gardenWorld.zones.some((zone) => zone.id === value);
}

export function loadWorldSession(
  storage: WorldSessionStorage | null = browserStorage()
): WorldSession | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(worldSessionStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorldSession>;
    if (
      !validZoneId(parsed.zoneId)
      || !parsed.position
      || !Number.isFinite(parsed.position.x)
      || !Number.isFinite(parsed.position.y)
      || !directions.has(parsed.direction as Direction)
    ) {
      return null;
    }
    const zone = getWorldZone(gardenWorld, parsed.zoneId);
    const savedPosition = parsed.zoneId === "home"
      && parsed.position.x === legacyHomeSpawn.x
      && parsed.position.y === legacyHomeSpawn.y
      ? zone.spawn
      : parsed.position;
    const position = snapToGrid(savedPosition, zone);
    if (isBlocked(position, zone)) return null;

    return {
      version: 1,
      zoneId: parsed.zoneId,
      position,
      direction: parsed.direction as Direction,
      guideCheckpointId: typeof parsed.guideCheckpointId === "string" ? parsed.guideCheckpointId : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString()
    };
  } catch {
    return null;
  }
}

export function saveWorldSession(
  session: Omit<WorldSession, "version" | "updatedAt">,
  storage: WorldSessionStorage | null = browserStorage(),
  updatedAt = new Date().toISOString()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(worldSessionStorageKey, JSON.stringify({ version: 1, ...session, updatedAt }));
    return true;
  } catch {
    return false;
  }
}

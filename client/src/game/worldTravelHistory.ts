import type { WorldZoneId } from "@wedding-game/shared";

export type WorldTravelMethod = "portal" | "journey";

export type WorldTravelRecord = {
  id: string;
  from: WorldZoneId;
  to: WorldZoneId;
  portalId?: string;
  method: WorldTravelMethod;
  visitedAt: string;
};

export type WorldTravelHistory = {
  version: 1;
  visitedZoneIds: WorldZoneId[];
  records: WorldTravelRecord[];
};

type TravelHistoryStorage = Pick<Storage, "getItem" | "setItem">;

export const worldTravelHistoryStorageKey = "wedding-world-travel-history:v1";
const maximumTravelRecords = 12;

function defaultHistory(initialZoneId: WorldZoneId): WorldTravelHistory {
  return { version: 1, visitedZoneIds: [initialZoneId], records: [] };
}

function defaultStorage(): TravelHistoryStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadWorldTravelHistory(
  initialZoneId: WorldZoneId,
  storage: TravelHistoryStorage | null = defaultStorage()
): WorldTravelHistory {
  try {
    const parsed = JSON.parse(storage?.getItem(worldTravelHistoryStorageKey) ?? "null") as Partial<WorldTravelHistory> | null;
    if (parsed?.version !== 1 || !Array.isArray(parsed.visitedZoneIds) || !Array.isArray(parsed.records)) {
      return defaultHistory(initialZoneId);
    }
    return {
      version: 1,
      visitedZoneIds: Array.from(new Set([initialZoneId, ...parsed.visitedZoneIds])).slice(-20),
      records: parsed.records.filter((record): record is WorldTravelRecord => Boolean(
        record && typeof record.id === "string" && typeof record.from === "string"
        && typeof record.to === "string" && typeof record.visitedAt === "string"
      )).slice(-maximumTravelRecords)
    };
  } catch {
    return defaultHistory(initialZoneId);
  }
}

export function recordWorldTravel(
  history: WorldTravelHistory,
  input: Omit<WorldTravelRecord, "id" | "visitedAt"> & { visitedAt?: string },
  storage: TravelHistoryStorage | null = defaultStorage()
): WorldTravelHistory {
  const visitedAt = input.visitedAt ?? new Date().toISOString();
  const record: WorldTravelRecord = {
    ...input,
    id: `${input.from}:${input.to}:${visitedAt}`,
    visitedAt
  };
  const next = {
    version: 1 as const,
    visitedZoneIds: Array.from(new Set([...history.visitedZoneIds, input.from, input.to])),
    records: [...history.records, record].slice(-maximumTravelRecords)
  };
  try {
    storage?.setItem(worldTravelHistoryStorageKey, JSON.stringify(next));
  } catch {
    // The in-memory history still works when storage is unavailable.
  }
  return next;
}

export function isFirstWorldVisit(history: WorldTravelHistory, zoneId: WorldZoneId): boolean {
  return !history.visitedZoneIds.includes(zoneId);
}

export function recentWorldTravelRecords(history: WorldTravelHistory, limit = 3): WorldTravelRecord[] {
  return history.records.slice(-Math.max(0, limit)).reverse();
}

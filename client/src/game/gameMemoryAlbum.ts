import type { WorldZoneId } from "@wedding-game/shared";

export const gameMemoryAlbumStorageKey = "wedding-game:memory-album:v1";

export type GameMemoryKind = "collectible" | "companion" | "celebration";

export type GameMemoryEntry = {
  id: string;
  kind: GameMemoryKind;
  title: string;
  detail: string;
  zoneId: WorldZoneId;
  createdAt: string;
};

export type GameMemoryAlbum = {
  version: 1;
  entries: GameMemoryEntry[];
};

type MemoryStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): MemoryStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isEntry(value: unknown): value is GameMemoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<GameMemoryEntry>;
  return typeof entry.id === "string"
    && (entry.kind === "collectible" || entry.kind === "companion" || entry.kind === "celebration")
    && typeof entry.title === "string"
    && typeof entry.detail === "string"
    && typeof entry.zoneId === "string"
    && typeof entry.createdAt === "string";
}

export function loadGameMemoryAlbum(
  storage: MemoryStorage | null = browserStorage()
): GameMemoryAlbum {
  try {
    const parsed = JSON.parse(storage?.getItem(gameMemoryAlbumStorageKey) ?? "null") as Partial<GameMemoryAlbum> | null;
    if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) return { version: 1, entries: [] };
    return { version: 1, entries: parsed.entries.filter(isEntry).slice(0, 60) };
  } catch {
    return { version: 1, entries: [] };
  }
}

export function recordGameMemory(
  input: Omit<GameMemoryEntry, "id" | "createdAt"> & { id?: string; createdAt?: string },
  storage: MemoryStorage | null = browserStorage()
): GameMemoryAlbum {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const entry: GameMemoryEntry = {
    id: input.id ?? `${input.kind}:${input.zoneId}:${createdAt}`,
    kind: input.kind,
    title: input.title.slice(0, 40),
    detail: input.detail.slice(0, 100),
    zoneId: input.zoneId,
    createdAt
  };
  const current = loadGameMemoryAlbum(storage);
  const entries = [entry, ...current.entries.filter(({ id }) => id !== entry.id)].slice(0, 60);
  const album = { version: 1 as const, entries };
  try {
    storage?.setItem(gameMemoryAlbumStorageKey, JSON.stringify(album));
  } catch {
    return current;
  }
  return album;
}

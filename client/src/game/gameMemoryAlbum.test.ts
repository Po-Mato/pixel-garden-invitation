import { describe, expect, it } from "vitest";
import { gameMemoryAlbumStorageKey, loadGameMemoryAlbum, recordGameMemory } from "./gameMemoryAlbum";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    values
  };
}

describe("gameMemoryAlbum", () => {
  it("records newest memories first and replaces duplicate ids", () => {
    const storage = memoryStorage();
    recordGameMemory({ id: "collect", kind: "collectible", title: "꽃잎", detail: "첫 기록", zoneId: "home", createdAt: "2026-01-01T00:00:00.000Z" }, storage);
    recordGameMemory({ id: "collect", kind: "collectible", title: "꽃잎", detail: "갱신", zoneId: "home", createdAt: "2026-01-02T00:00:00.000Z" }, storage);

    expect(loadGameMemoryAlbum(storage).entries).toEqual([expect.objectContaining({ id: "collect", detail: "갱신" })]);
    expect(storage.values.has(gameMemoryAlbumStorageKey)).toBe(true);
  });

  it("ignores malformed saved entries", () => {
    const storage = memoryStorage();
    storage.setItem(gameMemoryAlbumStorageKey, JSON.stringify({ version: 1, entries: [{ id: 1 }] }));
    expect(loadGameMemoryAlbum(storage).entries).toEqual([]);
  });
});

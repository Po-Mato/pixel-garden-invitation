import { describe, expect, it } from "vitest";
import { loadWorldSession, saveWorldSession, worldSessionStorageKey } from "./worldSession";

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    read: () => value
  };
}

describe("worldSession", () => {
  it("saves and restores the current map, tile and guidance", () => {
    const storage = memoryStorage();
    expect(saveWorldSession({
      zoneId: "home",
      position: { x: 315, y: 435 },
      direction: "left",
      guideCheckpointId: "gallery"
    }, storage, "2026-07-28T10:00:00.000Z")).toBe(true);

    expect(loadWorldSession(storage)).toMatchObject({
      zoneId: "home",
      direction: "left",
      guideCheckpointId: "gallery"
    });
    expect(JSON.parse(storage.read()!)).toMatchObject({ version: 1 });
  });

  it("rejects unknown maps and blocked positions", () => {
    expect(loadWorldSession(memoryStorage(JSON.stringify({
      version: 1,
      zoneId: "unknown",
      position: { x: 30, y: 30 },
      direction: "down"
    })))).toBeNull();
    expect(loadWorldSession(memoryStorage(JSON.stringify({
      version: 1,
      zoneId: "home",
      position: { x: -999, y: -999 },
      direction: "down"
    })))).toBeNull();
    expect(loadWorldSession(memoryStorage(JSON.stringify({
      version: 1,
      zoneId: "home",
      position: { x: "315", y: 435 },
      direction: "down"
    })))).toBeNull();
  });

  it("moves the legacy home start tile to the centered safe start", () => {
    expect(loadWorldSession(memoryStorage(JSON.stringify({
      version: 1,
      zoneId: "home",
      position: { x: 285, y: 555 },
      direction: "down"
    })))).toMatchObject({
      position: { x: 285, y: 375 }
    });
  });

  it("uses a versioned storage key", () => {
    expect(worldSessionStorageKey).toContain(":v1");
  });
});

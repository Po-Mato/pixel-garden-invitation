import { describe, expect, it } from "vitest";
import {
  completeJourneyCheckpoint,
  createEmptyJourneyProgress,
  journeyCheckpointForInteraction,
  journeyCheckpointForZone,
  journeyProgressStorageKey,
  loadJourneyProgress,
  nextJourneyCheckpoint,
  saveJourneyProgress
} from "./journeyProgress";

function createMemoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set(journeyProgressStorageKey, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }
  };
}

describe("journey progress", () => {
  it("returns the first incomplete destination in canonical journey order", () => {
    expect(nextJourneyCheckpoint(createEmptyJourneyProgress())?.id).toBe("directions");
    expect(nextJourneyCheckpoint({
      version: 1,
      completedIds: ["directions", "gallery"],
      updatedAt: null
    })?.id).toBe("bride");
    expect(nextJourneyCheckpoint({
      version: 1,
      completedIds: ["directions", "gallery", "bride", "ceremony", "guestbook"],
      updatedAt: null
    })).toBeNull();
  });

  it("persists checkpoints in the canonical journey order", () => {
    const storage = createMemoryStorage();
    let progress = createEmptyJourneyProgress();

    progress = completeJourneyCheckpoint(progress, "guestbook", "2026-07-23T01:00:00.000Z").progress;
    progress = completeJourneyCheckpoint(progress, "directions", "2026-07-23T01:01:00.000Z").progress;

    expect(saveJourneyProgress(progress, storage)).toBe(true);
    expect(loadJourneyProgress(storage)).toEqual({
      version: 1,
      completedIds: ["directions", "guestbook"],
      updatedAt: "2026-07-23T01:01:00.000Z"
    });
  });

  it("ignores malformed and unknown saved values", () => {
    const storage = createMemoryStorage(JSON.stringify({
      version: 999,
      completedIds: ["gallery", "unknown", 4],
      updatedAt: 10
    }));

    expect(loadJourneyProgress(storage)).toEqual({
      version: 1,
      completedIds: ["gallery"],
      updatedAt: null
    });
    expect(loadJourneyProgress(createMemoryStorage("not-json"))).toEqual(createEmptyJourneyProgress());
  });

  it("reports a single completion transition and keeps duplicates stable", () => {
    let progress = createEmptyJourneyProgress();
    for (const checkpoint of ["directions", "gallery", "bride", "ceremony"] as const) {
      progress = completeJourneyCheckpoint(progress, checkpoint).progress;
    }

    const completed = completeJourneyCheckpoint(progress, "guestbook");
    const duplicate = completeJourneyCheckpoint(completed.progress, "guestbook");

    expect(completed.changed).toBe(true);
    expect(completed.journeyCompleted).toBe(true);
    expect(duplicate.changed).toBe(false);
    expect(duplicate.progress).toBe(completed.progress);
  });

  it("maps only physical world interactions to their checkpoint", () => {
    expect(journeyCheckpointForInteraction("home", "directions")).toBe("directions");
    expect(journeyCheckpointForInteraction("lobby", "gallery")).toBe("gallery");
    expect(journeyCheckpointForInteraction("bridal-room", "couple")).toBe("bride");
    expect(journeyCheckpointForInteraction("banquet", "guestbook")).toBe("guestbook");
    expect(journeyCheckpointForInteraction("ceremony-hall", "couple")).toBeNull();
    expect(journeyCheckpointForInteraction("home", "rsvp")).toBeNull();
    expect(journeyCheckpointForZone("ceremony-hall")).toBe("ceremony");
    expect(journeyCheckpointForZone("lobby")).toBeNull();
  });
});

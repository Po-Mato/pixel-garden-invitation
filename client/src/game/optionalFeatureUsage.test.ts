import { describe, expect, it } from "vitest";
import {
  emptyOptionalFeatureUsage,
  loadOptionalFeatureUsage,
  optionalFeatureSummary,
  recordOptionalFeatureUse
} from "./optionalFeatureUsage";

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; }
  };
}

describe("optional feature usage", () => {
  it("keeps optional tools quiet before the guest uses one", () => {
    expect(loadOptionalFeatureUsage(memoryStorage())).toEqual(emptyOptionalFeatureUsage);
    expect(optionalFeatureSummary(emptyOptionalFeatureUsage)).toBe("사진·수집·같이 걷기는 필요할 때만");
  });

  it("remembers the most recently used tool for the next visit", () => {
    const storage = memoryStorage();
    recordOptionalFeatureUse("collection", storage, new Date("2026-08-03T01:00:00.000Z"));
    const recent = recordOptionalFeatureUse("photo-album", storage, new Date("2026-08-03T02:00:00.000Z"));

    expect(recent).toEqual({
      version: 1,
      recentId: "photo-album",
      usedIds: ["photo-album", "collection"],
      updatedAt: "2026-08-03T02:00:00.000Z"
    });
    expect(loadOptionalFeatureUsage(storage)).toEqual(recent);
    expect(optionalFeatureSummary(recent)).toBe("최근 사용 · 포토앨범");
  });

  it("ignores malformed stored identifiers", () => {
    expect(loadOptionalFeatureUsage(memoryStorage(JSON.stringify({
      version: 1,
      recentId: "unknown",
      usedIds: ["unknown", "companion"]
    })))).toMatchObject({ recentId: "companion", usedIds: ["companion"] });
  });
});

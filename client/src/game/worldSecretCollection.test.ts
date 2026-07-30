import { describe, expect, it, vi } from "vitest";
import {
  discoverWorldSecret,
  equipWorldSecretReward,
  loadWorldSecretCollection,
  worldSecretCollectionStorageKey
} from "./worldSecretCollection";

describe("worldSecretCollection", () => {
  it("새 오브젝트를 한 번만 발견 처리하고 첫 업적을 연다", () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    const first = discoverWorldSecret(loadWorldSecretCollection(storage), "first-invitation", storage);
    const repeated = discoverWorldSecret(first.collection, "first-invitation", storage);

    expect(first.isNew).toBe(true);
    expect(first.newAchievements.map(({ id }) => id)).toEqual(["first-discovery"]);
    expect(repeated.isNew).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith(worldSecretCollectionStorageKey, expect.any(String));
  });

  it("다섯 번째와 열 번째 발견에서 단계 업적을 연다", () => {
    let collection = loadWorldSecretCollection(null);
    const unlocked: string[] = [];
    for (let index = 1; index <= 10; index += 1) {
      const result = discoverWorldSecret(collection, `secret-${index}`, null);
      collection = result.collection;
      unlocked.push(...result.newAchievements.map(({ id }) => id));
    }
    expect(unlocked).toEqual(["first-discovery", "garden-explorer", "wedding-archivist"]);
    expect(collection.discoveredIds).toHaveLength(10);
    const equipped = equipWorldSecretReward(collection, "wedding-memory-crown", null);
    expect(equipped.equippedRewardId).toBe("wedding-memory-crown");
  });

  it("열지 못한 보상은 착용하지 않고 열린 보상만 저장한다", () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    const first = discoverWorldSecret(loadWorldSecretCollection(storage), "first-invitation", storage).collection;
    expect(equipWorldSecretReward(first, "wedding-memory-crown", storage)).toBe(first);
    expect(equipWorldSecretReward(first, "memory-petal-pin", storage).equippedRewardId).toBe("memory-petal-pin");
  });

  it("깨진 저장값은 빈 수집 상태로 복구한다", () => {
    expect(loadWorldSecretCollection({ getItem: () => "{", setItem: vi.fn() })).toEqual({
      version: 1,
      discoveredIds: [],
      unlockedAchievementIds: [],
      equippedRewardId: "none"
    });
  });
});

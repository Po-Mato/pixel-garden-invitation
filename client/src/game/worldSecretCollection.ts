export type WorldSecretAchievementId = "first-discovery" | "garden-explorer" | "wedding-archivist";

export type WorldSecretRewardId = "memory-petal-pin" | "garden-lantern-aura" | "wedding-memory-crown";

export type WorldSecretCollection = {
  version: 1;
  discoveredIds: string[];
  unlockedAchievementIds: WorldSecretAchievementId[];
  equippedRewardId: WorldSecretRewardId | "none";
};

export type WorldSecretAchievement = {
  id: WorldSecretAchievementId;
  label: string;
  requirement: number;
  rewardId: WorldSecretRewardId;
  rewardLabel: string;
};

type WorldSecretStorage = Pick<Storage, "getItem" | "setItem">;

export const worldSecretCollectionStorageKey = "wedding-world-secrets:v1";

export const worldSecretAchievements: readonly WorldSecretAchievement[] = [
  { id: "first-discovery", label: "첫 비밀 발견", requirement: 1, rewardId: "memory-petal-pin", rewardLabel: "추억 꽃잎 핀" },
  { id: "garden-explorer", label: "정원 탐험가", requirement: 5, rewardId: "garden-lantern-aura", rewardLabel: "정원 등불 오라" },
  { id: "wedding-archivist", label: "웨딩 아키비스트", requirement: 10, rewardId: "wedding-memory-crown", rewardLabel: "웨딩 추억 화관" }
];

const validRewardIds = new Set<WorldSecretRewardId>(worldSecretAchievements.map(({ rewardId }) => rewardId));

function defaultCollection(): WorldSecretCollection {
  return { version: 1, discoveredIds: [], unlockedAchievementIds: [], equippedRewardId: "none" };
}

function browserStorage(): WorldSecretStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function achievementsForCount(count: number): WorldSecretAchievementId[] {
  return worldSecretAchievements
    .filter(({ requirement }) => count >= requirement)
    .map(({ id }) => id);
}

export function loadWorldSecretCollection(
  storage: WorldSecretStorage | null = browserStorage()
): WorldSecretCollection {
  try {
    const parsed = JSON.parse(storage?.getItem(worldSecretCollectionStorageKey) ?? "null") as Partial<WorldSecretCollection> | null;
    if (parsed?.version !== 1 || !Array.isArray(parsed.discoveredIds)) return defaultCollection();
    const discoveredIds = Array.from(new Set(parsed.discoveredIds.filter((id): id is string => typeof id === "string")));
    const unlockedAchievementIds = achievementsForCount(discoveredIds.length);
    const equippedRewardId = validRewardIds.has(parsed.equippedRewardId as WorldSecretRewardId)
      && worldSecretAchievements.some(({ id, rewardId }) => rewardId === parsed.equippedRewardId && unlockedAchievementIds.includes(id))
      ? parsed.equippedRewardId as WorldSecretRewardId
      : "none";
    return {
      version: 1,
      discoveredIds,
      unlockedAchievementIds,
      equippedRewardId
    };
  } catch {
    return defaultCollection();
  }
}

export function discoverWorldSecret(
  collection: WorldSecretCollection,
  secretId: string,
  storage: WorldSecretStorage | null = browserStorage()
): { collection: WorldSecretCollection; isNew: boolean; newAchievements: WorldSecretAchievement[] } {
  if (collection.discoveredIds.includes(secretId)) {
    return { collection, isNew: false, newAchievements: [] };
  }
  const discoveredIds = [...collection.discoveredIds, secretId];
  const unlockedAchievementIds = achievementsForCount(discoveredIds.length);
  const previousAchievements = new Set(collection.unlockedAchievementIds);
  const next: WorldSecretCollection = { ...collection, version: 1, discoveredIds, unlockedAchievementIds };
  try {
    storage?.setItem(worldSecretCollectionStorageKey, JSON.stringify(next));
  } catch {
    // Discovery remains available in memory when browser storage is unavailable.
  }
  return {
    collection: next,
    isNew: true,
    newAchievements: worldSecretAchievements.filter(({ id }) => (
      unlockedAchievementIds.includes(id) && !previousAchievements.has(id)
    ))
  };
}

export function equipWorldSecretReward(
  collection: WorldSecretCollection,
  rewardId: WorldSecretRewardId | "none",
  storage: WorldSecretStorage | null = browserStorage()
): WorldSecretCollection {
  const achievement = worldSecretAchievements.find((entry) => entry.rewardId === rewardId);
  if (rewardId !== "none" && (!achievement || !collection.unlockedAchievementIds.includes(achievement.id))) {
    return collection;
  }
  const next = { ...collection, equippedRewardId: rewardId };
  try {
    storage?.setItem(worldSecretCollectionStorageKey, JSON.stringify(next));
  } catch {
    // The equipped reward still applies for the current session.
  }
  return next;
}

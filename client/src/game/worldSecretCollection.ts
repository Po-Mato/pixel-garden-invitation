export type WorldSecretAchievementId = "first-discovery" | "garden-explorer" | "wedding-archivist";

export type WorldSecretCollection = {
  version: 1;
  discoveredIds: string[];
  unlockedAchievementIds: WorldSecretAchievementId[];
};

export type WorldSecretAchievement = {
  id: WorldSecretAchievementId;
  label: string;
  requirement: number;
};

type WorldSecretStorage = Pick<Storage, "getItem" | "setItem">;

export const worldSecretCollectionStorageKey = "wedding-world-secrets:v1";

export const worldSecretAchievements: readonly WorldSecretAchievement[] = [
  { id: "first-discovery", label: "첫 비밀 발견", requirement: 1 },
  { id: "garden-explorer", label: "정원 탐험가", requirement: 5 },
  { id: "wedding-archivist", label: "웨딩 아키비스트", requirement: 10 }
];

function defaultCollection(): WorldSecretCollection {
  return { version: 1, discoveredIds: [], unlockedAchievementIds: [] };
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
    return {
      version: 1,
      discoveredIds,
      unlockedAchievementIds: achievementsForCount(discoveredIds.length)
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
  const next: WorldSecretCollection = { version: 1, discoveredIds, unlockedAchievementIds };
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

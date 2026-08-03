export const optionalFeatureIds = [
  "collection",
  "companion",
  "photo-album",
  "game-memory"
] as const;

export type OptionalFeatureId = typeof optionalFeatureIds[number];

export type OptionalFeatureUsage = {
  version: 1;
  recentId: OptionalFeatureId | null;
  usedIds: OptionalFeatureId[];
  updatedAt: string | null;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const optionalFeatureUsageStorageKey = "wedding:optional-feature-usage:v1";

export const optionalFeatureLabels: Record<OptionalFeatureId, string> = {
  collection: "축하 아이템 지도",
  companion: "같이 걷기",
  "photo-album": "포토앨범",
  "game-memory": "게임 추억"
};

export const emptyOptionalFeatureUsage: OptionalFeatureUsage = {
  version: 1,
  recentId: null,
  usedIds: [],
  updatedAt: null
};

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isOptionalFeatureId(value: unknown): value is OptionalFeatureId {
  return typeof value === "string" && optionalFeatureIds.includes(value as OptionalFeatureId);
}

export function loadOptionalFeatureUsage(
  storage: StorageLike | null = browserStorage()
): OptionalFeatureUsage {
  try {
    const raw = storage?.getItem(optionalFeatureUsageStorageKey);
    if (!raw) return emptyOptionalFeatureUsage;
    const parsed = JSON.parse(raw) as Partial<OptionalFeatureUsage>;
    const usedIds = Array.isArray(parsed.usedIds)
      ? parsed.usedIds
        .filter(isOptionalFeatureId)
        .filter((id, index, ids) => ids.indexOf(id) === index)
      : [];
    const recentId = isOptionalFeatureId(parsed.recentId) ? parsed.recentId : usedIds[0] ?? null;
    return {
      version: 1,
      recentId,
      usedIds,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null
    };
  } catch {
    return emptyOptionalFeatureUsage;
  }
}

export function recordOptionalFeatureUse(
  id: OptionalFeatureId,
  storage: StorageLike | null = browserStorage(),
  now = new Date()
): OptionalFeatureUsage {
  const current = loadOptionalFeatureUsage(storage);
  const next: OptionalFeatureUsage = {
    version: 1,
    recentId: id,
    usedIds: [id, ...current.usedIds.filter((candidate) => candidate !== id)],
    updatedAt: now.toISOString()
  };
  try {
    storage?.setItem(optionalFeatureUsageStorageKey, JSON.stringify(next));
  } catch {
    // Personalization is optional and must never block the invitation.
  }
  return next;
}

export function optionalFeatureSummary(usage: OptionalFeatureUsage): string {
  return usage.recentId
    ? `최근 사용 · ${optionalFeatureLabels[usage.recentId]}`
    : "사진·수집·같이 걷기는 필요할 때만";
}

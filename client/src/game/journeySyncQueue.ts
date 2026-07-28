import {
  journeyCheckpointIds,
  mergeJourneyProgress,
  type JourneyProgress
} from "./journeyProgress";

export const journeySyncQueueStorageKey = "wedding-game:journey-sync-queue:v1";

export type JourneySyncQueueEntry = {
  version: 1;
  scope: string;
  progress: JourneyProgress;
  queuedAt: string;
  attempts: number;
};

type JourneySyncQueueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): JourneySyncQueueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function normalizeProgress(value: unknown): JourneyProgress | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<JourneyProgress>;
  return {
    version: 1,
    completedIds: Array.isArray(candidate.completedIds)
      ? journeyCheckpointIds.filter((id) => candidate.completedIds?.includes(id))
      : [],
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null
  };
}

export function loadJourneySyncQueue(
  scope: string,
  storage: JourneySyncQueueStorage | null = browserStorage()
): JourneySyncQueueEntry | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(journeySyncQueueStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JourneySyncQueueEntry>;
    const progress = normalizeProgress(parsed.progress);
    if (!progress || parsed.scope !== scope || typeof parsed.queuedAt !== "string") return null;
    return {
      version: 1,
      scope,
      progress,
      queuedAt: parsed.queuedAt,
      attempts: Number.isInteger(parsed.attempts) && Number(parsed.attempts) >= 0
        ? Number(parsed.attempts)
        : 0
    };
  } catch {
    return null;
  }
}

export function queueJourneyProgress(
  scope: string,
  progress: JourneyProgress,
  storage: JourneySyncQueueStorage | null = browserStorage(),
  queuedAt = new Date().toISOString()
): JourneySyncQueueEntry | null {
  if (!storage) return null;
  const current = loadJourneySyncQueue(scope, storage);
  const entry: JourneySyncQueueEntry = {
    version: 1,
    scope,
    progress: current ? mergeJourneyProgress(current.progress, progress) : progress,
    queuedAt,
    attempts: current?.attempts ?? 0
  };
  try {
    storage.setItem(journeySyncQueueStorageKey, JSON.stringify(entry));
    return entry;
  } catch {
    return null;
  }
}

export function markJourneySyncAttemptFailed(
  scope: string,
  storage: JourneySyncQueueStorage | null = browserStorage()
): JourneySyncQueueEntry | null {
  const current = loadJourneySyncQueue(scope, storage);
  if (!storage || !current) return null;
  const failed = { ...current, attempts: current.attempts + 1 };
  try {
    storage.setItem(journeySyncQueueStorageKey, JSON.stringify(failed));
    return failed;
  } catch {
    return current;
  }
}

export function clearJourneySyncQueue(
  scope: string,
  expectedProgress: JourneyProgress,
  storage: JourneySyncQueueStorage | null = browserStorage()
): boolean {
  if (!storage) return false;
  const current = loadJourneySyncQueue(scope, storage);
  if (!current) return true;
  const expectedIds = expectedProgress.completedIds.join(",");
  const currentIds = current.progress.completedIds.join(",");
  if (expectedIds !== currentIds || expectedProgress.updatedAt !== current.progress.updatedAt) return false;
  try {
    storage.removeItem(journeySyncQueueStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function journeyProgressDiffers(left: JourneyProgress, right: JourneyProgress): boolean {
  return left.completedIds.join(",") !== right.completedIds.join(",");
}

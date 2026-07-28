import { journeyCheckpointIds, type JourneyCheckpointId } from "./journeyProgress";

export const journeyVisitLogStorageKey = "wedding-game:journey-visits:v1";

export type JourneyVisit = {
  checkpointId: JourneyCheckpointId;
  visitedAt: string;
};

type JourneyVisitStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): JourneyVisitStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadJourneyVisits(
  storage: JourneyVisitStorage | null = browserStorage()
): JourneyVisit[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(journeyVisitLogStorageKey) ?? "[]") as Partial<JourneyVisit>[];
    if (!Array.isArray(parsed)) return [];
    return journeyCheckpointIds.flatMap((checkpointId) => {
      const entry = parsed.find((candidate) => candidate.checkpointId === checkpointId);
      return entry && typeof entry.visitedAt === "string"
        ? [{ checkpointId, visitedAt: entry.visitedAt }]
        : [];
    });
  } catch {
    return [];
  }
}

export function recordJourneyVisit(
  checkpointId: JourneyCheckpointId,
  storage: JourneyVisitStorage | null = browserStorage(),
  visitedAt = new Date().toISOString()
): JourneyVisit[] {
  const visits = loadJourneyVisits(storage);
  if (visits.some((visit) => visit.checkpointId === checkpointId)) return visits;
  const next = journeyCheckpointIds.flatMap((id) => id === checkpointId
    ? [{ checkpointId: id, visitedAt }]
    : visits.filter((visit) => visit.checkpointId === id));
  try {
    storage?.setItem(journeyVisitLogStorageKey, JSON.stringify(next));
  } catch {
    return visits;
  }
  return next;
}

export function formatJourneyVisitTime(visitedAt: string): string {
  const value = Date.parse(visitedAt);
  if (!Number.isFinite(value)) return "방문 완료";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

export function journeyVisitDurationLabel(visits: readonly JourneyVisit[]): string {
  const times = visits.map((visit) => Date.parse(visit.visitedAt)).filter(Number.isFinite);
  if (times.length < 2) return "한 걸음씩 완성한 여정";
  const minutes = Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 60_000));
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분의 여정`
    : `${minutes}분의 여정`;
}

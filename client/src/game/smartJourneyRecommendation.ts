import type { JourneyCheckpointId, JourneyProgress } from "./journeyProgress";

export type SmartJourneyPhase = "arrival" | "greeting" | "ceremony-soon" | "ceremony" | "reception";

export type SmartJourneyRecommendation = {
  checkpointId: JourneyCheckpointId;
  phase: SmartJourneyPhase;
  eyebrow: string;
  reason: string;
};

type WeddingEventWindow = {
  startAt: string;
  endAt: string;
};

const phasePlans: Record<SmartJourneyPhase, {
  eyebrow: string;
  reason: string;
  checkpointIds: readonly JourneyCheckpointId[];
}> = {
  arrival: {
    eyebrow: "WEDDING DAY · ARRIVAL",
    reason: "도착 준비 시간에 맞춘 추천",
    checkpointIds: ["directions", "gallery", "bride", "ceremony", "guestbook"]
  },
  greeting: {
    eyebrow: "WEDDING DAY · GREETING",
    reason: "예식 전 인사 시간을 먼저 안내",
    checkpointIds: ["bride", "gallery", "ceremony", "guestbook", "directions"]
  },
  "ceremony-soon": {
    eyebrow: "WEDDING DAY · SOON",
    reason: "예식 시작이 가까워 예식홀을 우선 안내",
    checkpointIds: ["ceremony", "bride", "guestbook", "gallery", "directions"]
  },
  ceremony: {
    eyebrow: "WEDDING DAY · CEREMONY",
    reason: "현재 예식 시간에 맞춰 예식홀을 우선 안내",
    checkpointIds: ["ceremony", "guestbook", "bride", "gallery", "directions"]
  },
  reception: {
    eyebrow: "WEDDING DAY · RECEPTION",
    reason: "예식 후 연회와 축하 메시지를 우선 안내",
    checkpointIds: ["guestbook", "gallery", "bride", "ceremony", "directions"]
  }
};

export function smartJourneyRecommendation(
  progress: JourneyProgress,
  event: WeddingEventWindow,
  now = new Date()
): SmartJourneyRecommendation | null {
  const startAt = Date.parse(event.startAt);
  const endAt = Date.parse(event.endAt);
  const currentAt = now.getTime();
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) return null;

  const arrivalStartAt = startAt - 6 * 60 * 60 * 1000;
  const greetingStartAt = startAt - 90 * 60 * 1000;
  const ceremonySoonAt = startAt - 20 * 60 * 1000;
  const receptionEndAt = endAt + 4 * 60 * 60 * 1000;
  if (currentAt < arrivalStartAt || currentAt > receptionEndAt) return null;

  const phase: SmartJourneyPhase = currentAt < greetingStartAt
    ? "arrival"
    : currentAt < ceremonySoonAt
      ? "greeting"
      : currentAt < startAt
        ? "ceremony-soon"
        : currentAt < endAt ? "ceremony" : "reception";
  const plan = phasePlans[phase];
  const completed = new Set(progress.completedIds);
  const checkpointId = plan.checkpointIds.find((id) => !completed.has(id));
  return checkpointId ? { checkpointId, phase, eyebrow: plan.eyebrow, reason: plan.reason } : null;
}

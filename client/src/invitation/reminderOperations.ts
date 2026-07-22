import type {
  InvitationReminderEventRecord,
  InvitationReminderStage,
  RsvpAttendance,
  WeddingEvent
} from "@wedding-game/shared";
import type { AttendanceOperationEntry, AttendanceOperations } from "./attendanceOperations";

export type ReminderQueueStatus =
  | "unsent"
  | "unopened"
  | "unresponded"
  | "unsure"
  | "attending"
  | "sent"
  | "resolved";

export type ReminderQueueEntry = AttendanceOperationEntry & {
  status: ReminderQueueStatus;
  sentAt: string | null;
};

export type ReminderSchedule = {
  stage: InvitationReminderStage;
  label: string;
  shortLabel: string;
  description: string;
  scheduledAt: string | null;
  targetCount: number;
  pendingCount: number;
  completedCount: number;
};

export const reminderStageDefinitions: Record<InvitationReminderStage, {
  label: string;
  shortLabel: string;
  description: string;
  daysBefore: number | null;
}> = {
  d30: { label: "예식 30일 전", shortLabel: "30일 전", description: "미응답 하객에게 참석 답변을 정중히 요청합니다.", daysBefore: 30 },
  d14: { label: "예식 14일 전", shortLabel: "14일 전", description: "미열람·미응답·미정 하객을 다시 확인합니다.", daysBefore: 14 },
  d7: { label: "예식 7일 전", shortLabel: "7일 전", description: "답변 마감 전 최종 참석 여부를 확인합니다.", daysBefore: 7 },
  d1: { label: "예식 하루 전", shortLabel: "하루 전", description: "참석·미정 하객에게 시간과 장소를 다시 안내합니다.", daysBefore: 1 },
  manual: { label: "수동 재안내", shortLabel: "수동", description: "필요한 하객을 직접 선택해 안내합니다.", daysBefore: null }
};

function responseMatches(stage: InvitationReminderStage, attendance: RsvpAttendance | null): boolean {
  if (stage === "manual") return true;
  if (stage === "d1") return attendance === "yes" || attendance === "unsure";
  if (stage === "d30") return attendance === null;
  return attendance === null || attendance === "unsure";
}

function queueStatus(entry: AttendanceOperationEntry): ReminderQueueStatus {
  if (entry.response?.attendance === "yes") return "attending";
  if (entry.response?.attendance === "unsure") return "unsure";
  if (entry.link?.sendCount === 0) return "unsent";
  if (entry.link?.openCount === 0) return "unopened";
  return "unresponded";
}

function scheduleAt(event: WeddingEvent, daysBefore: number | null): string | null {
  if (daysBefore === null) return null;
  return new Date(Date.parse(event.startAt) - daysBefore * 24 * 60 * 60 * 1_000).toISOString();
}

export function buildReminderQueue(
  stage: InvitationReminderStage,
  operations: AttendanceOperations,
  events: readonly InvitationReminderEventRecord[]
): ReminderQueueEntry[] {
  const sentByLink = new Map<string, string>();
  events.forEach((item) => {
    if (item.stage === stage && !sentByLink.has(item.linkId)) sentByLink.set(item.linkId, item.sentAt);
  });
  return operations.entries.flatMap((entry) => {
    const link = entry.link;
    if (!link?.active || !responseMatches(stage, entry.response?.attendance ?? null)) return [];
    const sentAt = sentByLink.get(link.id) ?? null;
    return [{
      ...entry,
      status: sentAt ? "sent" : link.followUpCompletedAt && stage !== "d1" ? "resolved" : queueStatus(entry),
      sentAt
    }];
  });
}

export function buildReminderSchedules(
  event: WeddingEvent,
  operations: AttendanceOperations,
  events: readonly InvitationReminderEventRecord[]
): ReminderSchedule[] {
  return (["d30", "d14", "d7", "d1", "manual"] as const).map((stage) => {
    const definition = reminderStageDefinitions[stage];
    const queue = buildReminderQueue(stage, operations, events);
    const completedCount = queue.filter(({ status }) => status === "sent" || status === "resolved").length;
    return {
      stage,
      ...definition,
      scheduledAt: scheduleAt(event, definition.daysBefore),
      targetCount: queue.length,
      pendingCount: queue.length - completedCount,
      completedCount
    };
  });
}

export function recommendedReminderStage(event: WeddingEvent, now = new Date()): InvitationReminderStage {
  const eventTime = Date.parse(event.startAt);
  const daysUntil = (eventTime - now.getTime()) / (24 * 60 * 60 * 1_000);
  if (daysUntil <= 1) return "d1";
  if (daysUntil <= 7) return "d7";
  if (daysUntil <= 14) return "d14";
  return "d30";
}

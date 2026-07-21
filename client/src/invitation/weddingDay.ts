import type { WeddingEvent } from "@wedding-game/shared";

export type WeddingDayPhase = "before" | "in-progress" | "after";

export type WeddingDayStatus = {
  phase: WeddingDayPhase;
  headline: string;
  detail: string;
};

const minuteMs = 60_000;
const previewLeadMinutes = 45;

function zonedDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function countdownLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) return `예식까지 ${remainder}분`;
  if (remainder === 0) return `예식까지 ${hours}시간`;
  return `예식까지 ${hours}시간 ${remainder}분`;
}

export function getWeddingDayPreviewNow(event: WeddingEvent) {
  return new Date(Date.parse(event.startAt) - previewLeadMinutes * minuteMs);
}

export function getWeddingDayStatus(event: WeddingEvent, now = new Date()): WeddingDayStatus | null {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);

  if (
    Number.isNaN(start.getTime())
    || Number.isNaN(end.getTime())
    || zonedDateKey(now, event.timeZone) !== zonedDateKey(start, event.timeZone)
  ) {
    return null;
  }

  if (now < start) {
    const minutes = Math.max(1, Math.ceil((start.getTime() - now.getTime()) / minuteMs));
    return {
      phase: "before",
      headline: countdownLabel(minutes),
      detail: "교통과 주차 시간을 고려해 여유 있게 출발해주세요."
    };
  }

  if (now < end) {
    return {
      phase: "in-progress",
      headline: "예식이 진행 중이에요",
      detail: `${event.venue.hall}으로 바로 이동해주세요.`
    };
  }

  return {
    phase: "after",
    headline: "오늘 함께해 주셔서 감사합니다",
    detail: "두 사람의 새로운 시작을 축복해주신 마음을 오래 간직하겠습니다."
  };
}

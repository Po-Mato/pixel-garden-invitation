type WeddingEventWindow = {
  startAt: string;
  endAt: string;
};

export type WeddingJourneyTiming = {
  phase: "countdown" | "soon" | "ceremony" | "reception";
  label: string;
  detail: string;
  urgent: boolean;
  showFastCeremonyRoute: boolean;
};

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

function hoursAndMinutes(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.ceil(durationMs / minuteMs));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function formattedWeddingStart(startAt: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(startAt));
}

export function weddingJourneyTiming(
  event: WeddingEventWindow,
  now = new Date(),
  ceremonyCompleted = false
): WeddingJourneyTiming | null {
  const startAt = Date.parse(event.startAt);
  const endAt = Date.parse(event.endAt);
  const currentAt = now.getTime();
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return null;

  if (currentAt < startAt) {
    const remaining = startAt - currentAt;
    if (remaining >= dayMs) {
      return {
        phase: "countdown",
        label: `예식까지 D-${Math.ceil(remaining / dayMs)}`,
        detail: formattedWeddingStart(startAt),
        urgent: false,
        showFastCeremonyRoute: false
      };
    }
    const urgent = remaining <= 40 * minuteMs;
    return {
      phase: urgent ? "soon" : "countdown",
      label: `예식까지 ${hoursAndMinutes(remaining)}`,
      detail: urgent ? "예식홀 최단 경로를 바로 이용할 수 있어요" : "도착 시간을 확인해 주세요",
      urgent,
      showFastCeremonyRoute: urgent && !ceremonyCompleted
    };
  }

  if (currentAt < endAt) {
    const elapsedMinutes = Math.max(1, Math.floor((currentAt - startAt) / minuteMs));
    return {
      phase: "ceremony",
      label: `예식 시작 ${elapsedMinutes}분 경과`,
      detail: ceremonyCompleted ? "예식홀 방문을 확인했어요" : "늦지 않게 예식홀로 바로 안내할게요",
      urgent: !ceremonyCompleted,
      showFastCeremonyRoute: !ceremonyCompleted
    };
  }

  if (currentAt > endAt + 12 * hourMs) return null;

  return {
    phase: "reception",
    label: "예식 후 축하 시간",
    detail: "연회장과 축하 메시지를 이어서 둘러보세요",
    urgent: false,
    showFastCeremonyRoute: false
  };
}

import type { InvitationReminderStage, WeddingEvent } from "@wedding-game/shared";
import { formatEventDate, formatEventStartTime, formatVenueLabel } from "./calendarEvent";

function deadlineLabel(event: WeddingEvent): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: event.timeZone,
    month: "long",
    day: "numeric"
  }).format(new Date(event.rsvp.responseDeadline));
}

export function buildReminderMessage(
  stage: InvitationReminderStage,
  guestName: string,
  inviteUrl: string,
  event: WeddingEvent
): { title: string; text: string; url: string; copyText: string } {
  const names = `${event.couple.bride} · ${event.couple.groom}`;
  const deadline = deadlineLabel(event);
  const eventSummary = `${formatEventDate(event)} ${formatEventStartTime(event)}\n${formatVenueLabel(event)}`;
  const text = stage === "d1"
    ? `${guestName}님, 내일 ${names}의 결혼식이 진행됩니다.\n\n${eventSummary}\n\n조심히 오시고, 자세한 위치와 당일 안내는 아래 초대장에서 확인해 주세요.`
    : stage === "d7"
      ? `${guestName}님, 안녕하세요. ${names}의 결혼식 참석 답변 마감이 가까워져 다시 안내드립니다.\n\n${deadline}까지 참석 인원과 식사 여부를 알려주시면 감사하겠습니다.`
      : stage === "d14"
        ? `${guestName}님, 안녕하세요. ${names}의 결혼식 참석 여부를 아직 확인하지 못해 조심스럽게 다시 연락드립니다.\n\n${deadline}까지 아래 초대장에서 답변해 주시면 감사하겠습니다.`
        : stage === "manual"
          ? `${guestName}님, ${names}의 결혼식 안내를 다시 전해드립니다.\n\n${eventSummary}\n\n아래 개인 초대장에서 자세한 내용을 확인해 주세요.`
          : `${guestName}님, 안녕하세요. ${names}의 결혼식 참석 여부를 ${deadline}까지 알려주시면 감사하겠습니다.\n\n아래 개인 초대장에서 참석 인원과 식사 여부를 확인해 주세요.`;
  return {
    title: `${guestName}님께 드리는 결혼식 안내`,
    text,
    url: inviteUrl,
    copyText: `${text}\n${inviteUrl}`
  };
}

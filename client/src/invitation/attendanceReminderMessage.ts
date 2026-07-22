import { invitationContent } from "@wedding-game/shared";

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: invitationContent.event.timeZone,
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

export function buildAttendanceReminderMessage(guestName: string, inviteUrl: string): string {
  const { event } = invitationContent;
  return [
    `${guestName}님, 안녕하세요.`,
    `${event.couple.bride} · ${event.couple.groom}의 결혼식 참석 여부를 ${dateLabel(event.rsvp.responseDeadline)}까지 알려주시면 감사하겠습니다.`,
    `아래 개인 초대장에서 참석 인원과 식사 여부를 확인해 주세요.`,
    inviteUrl
  ].join("\n");
}

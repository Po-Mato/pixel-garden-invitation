import { invitationContent, type WeddingEvent } from "@wedding-game/shared";
import { formatEventDate, formatEventStartTime, formatVenueLabel } from "./calendarEvent";

export const inviteDeliveryTemplateIds = ["formal", "warm", "brief"] as const;
export type InviteDeliveryTemplateId = typeof inviteDeliveryTemplateIds[number];

export const inviteDeliveryTemplates: Array<{ id: InviteDeliveryTemplateId; label: string }> = [
  { id: "formal", label: "정중한 초대" },
  { id: "warm", label: "따뜻한 초대" },
  { id: "brief", label: "간단한 안내" }
];

function eventSummary(event: WeddingEvent): string {
  return `${formatEventDate(event)} ${formatEventStartTime(event)}\n${formatVenueLabel(event)}`;
}

export function buildInviteDeliveryMessage(
  templateId: InviteDeliveryTemplateId,
  guestName: string,
  url: string,
  event: WeddingEvent = invitationContent.event
): { title: string; text: string; url: string; copyText: string } {
  const names = `${event.couple.bride} · ${event.couple.groom}`;
  const summary = eventSummary(event);
  const text = templateId === "warm"
    ? `${guestName}님, 저희 두 사람이 함께 새로운 시작을 합니다. 소중한 날 함께 축복해 주세요.\n\n${names}\n${summary}`
    : templateId === "brief"
      ? `${guestName}님, ${names}의 결혼식에 초대합니다.\n${summary}`
      : `${guestName}님, ${names}의 결혼식에 정중히 초대합니다.\n\n${summary}\n\n아래 초대장에서 자세한 내용을 확인해 주세요.`;
  return {
    title: `${guestName}님께 드리는 결혼식 초대`,
    text,
    url,
    copyText: `${text}\n${url}`
  };
}

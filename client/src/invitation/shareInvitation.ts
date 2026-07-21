import type { WeddingEvent } from "@wedding-game/shared";
import {
  formatCoupleNames,
  formatEventDate,
  formatEventStartTime,
  formatVenueLabel
} from "./calendarEvent";

export const invitationPublicUrl = "https://po-mato.github.io/pixel-garden-invitation/";

export function normalizeInvitationShareUrl(value = invitationPublicUrl): string {
  const url = new URL(value, invitationPublicUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function buildInvitationShareData(
  event: WeddingEvent,
  url = invitationPublicUrl
): ShareData {
  return {
    title: event.title,
    text: [
      `${formatCoupleNames(event)}의 결혼식에 초대합니다.`,
      `${formatEventDate(event)} ${formatEventStartTime(event)}`,
      formatVenueLabel(event)
    ].join("\n"),
    url: normalizeInvitationShareUrl(url)
  };
}

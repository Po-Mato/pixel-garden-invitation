import type { EditableInvitationContent, WeddingEvent } from "@wedding-game/shared";
import {
  formatEventDate,
  formatEventStartTime,
  formatVenueLabel
} from "./calendarEvent";
import {
  defaultCoupleDisplayOrder,
  formatCoupleNames,
  formatWeddingTitle,
  type CoupleDisplayOrder
} from "./coupleOrder";

export const invitationPublicUrl = "https://po-mato.github.io/pixel-garden-invitation/";

export function normalizeInvitationShareUrl(value = invitationPublicUrl): string {
  const url = new URL(value, invitationPublicUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function buildInvitationShareData(
  event: WeddingEvent,
  url = invitationPublicUrl,
  order: CoupleDisplayOrder = defaultCoupleDisplayOrder,
  share?: EditableInvitationContent["share"]
): ShareData {
  const title = share
    ? resolveInvitationShareText(share.title, event, order)
    : formatWeddingTitle(event, order);
  const text = share
    ? resolveInvitationShareText(share.description, event, order)
    : [
        `${formatCoupleNames(event, order)}의 결혼식에 초대합니다.`,
        `${formatEventDate(event)} ${formatEventStartTime(event)}`,
        formatVenueLabel(event)
      ].join("\n");
  return {
    title,
    text,
    url: normalizeInvitationShareUrl(url)
  };
}

export function resolveInvitationShareText(
  template: string,
  event: WeddingEvent,
  order: CoupleDisplayOrder = defaultCoupleDisplayOrder
): string {
  return template.replaceAll("{names}", formatCoupleNames(event, order));
}

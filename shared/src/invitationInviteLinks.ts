import type { RsvpSide } from "./rsvp";

export const invitationInviteLinkSides = ["groom", "bride"] as const;
export const invitationInviteDeliveryChannels = ["kakao", "sms", "in_person", "other"] as const;

export type InvitationInviteLinkSide = RsvpSide;
export type InvitationInviteDeliveryChannel = typeof invitationInviteDeliveryChannels[number];

export type InvitationInviteLinkInput = {
  guestName: string;
  side: InvitationInviteLinkSide;
  groupLabel: string;
};

export type InvitationInviteLinkUpdate = Partial<InvitationInviteLinkInput> & {
  active?: boolean;
};

export type InvitationInviteDeliveryInput = {
  linkIds: string[];
  channel: InvitationInviteDeliveryChannel;
  note: string;
};

export type InvitationInviteLinkRecord = InvitationInviteLinkInput & {
  id: string;
  active: boolean;
  deliveryChannel: InvitationInviteDeliveryChannel | null;
  sendCount: number;
  firstSentAt: string | null;
  lastSentAt: string | null;
  deliveryNote: string;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  respondedAt: string | null;
  rsvpId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvitationInviteLinkCreated = {
  link: InvitationInviteLinkRecord;
  token: string;
};

export type InvitationInviteLinkSummary = {
  total: number;
  active: number;
  delivered: number;
  opened: number;
  responded: number;
};

export type InvitationInviteLinkAdminResult = {
  summary: InvitationInviteLinkSummary;
  links: InvitationInviteLinkRecord[];
};

export type InvitationInviteLinkCreateResult = InvitationInviteLinkAdminResult & {
  created: InvitationInviteLinkCreated[];
};

export type PublicInvitationInvite = InvitationInviteLinkInput;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizedText(value: unknown, maxLength: number, required: boolean): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if ((required && normalized.length === 0) || normalized.length > maxLength) return null;
  return normalized;
}

export function parseInvitationInviteLinkInput(value: unknown): InvitationInviteLinkInput | null {
  if (!isRecord(value)) return null;
  const guestName = normalizedText(value.guestName, 40, true);
  const groupLabel = normalizedText(value.groupLabel, 40, false);
  if (!guestName || groupLabel === null || !invitationInviteLinkSides.includes(value.side as InvitationInviteLinkSide)) {
    return null;
  }
  return { guestName, side: value.side as InvitationInviteLinkSide, groupLabel };
}

export function parseInvitationInviteLinkBatch(value: unknown): InvitationInviteLinkInput[] | null {
  if (!isRecord(value) || !Array.isArray(value.links) || value.links.length < 1 || value.links.length > 100) {
    return null;
  }
  const links = value.links.map(parseInvitationInviteLinkInput);
  return links.every((link): link is InvitationInviteLinkInput => link !== null) ? links : null;
}

export function parseInvitationInviteLinkUpdate(value: unknown): InvitationInviteLinkUpdate | null {
  if (!isRecord(value)) return null;
  const update: InvitationInviteLinkUpdate = {};
  if ("guestName" in value) {
    const guestName = normalizedText(value.guestName, 40, true);
    if (!guestName) return null;
    update.guestName = guestName;
  }
  if ("side" in value) {
    if (!invitationInviteLinkSides.includes(value.side as InvitationInviteLinkSide)) return null;
    update.side = value.side as InvitationInviteLinkSide;
  }
  if ("groupLabel" in value) {
    const groupLabel = normalizedText(value.groupLabel, 40, false);
    if (groupLabel === null) return null;
    update.groupLabel = groupLabel;
  }
  if ("active" in value) {
    if (typeof value.active !== "boolean") return null;
    update.active = value.active;
  }
  return Object.keys(update).length > 0 ? update : null;
}

export function parseInvitationInviteDeliveryInput(value: unknown): InvitationInviteDeliveryInput | null {
  if (!isRecord(value) || !Array.isArray(value.linkIds)) return null;
  const linkIds = [...new Set(value.linkIds)];
  if (
    linkIds.length < 1
    || linkIds.length > 100
    || !linkIds.every((linkId) => typeof linkId === "string" && /^invite_[0-9a-f-]+$/.test(linkId))
    || !invitationInviteDeliveryChannels.includes(value.channel as InvitationInviteDeliveryChannel)
  ) return null;
  const note = normalizedText(value.note ?? "", 200, false);
  if (note === null) return null;
  return { linkIds, channel: value.channel as InvitationInviteDeliveryChannel, note };
}

export function validInvitationInviteToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

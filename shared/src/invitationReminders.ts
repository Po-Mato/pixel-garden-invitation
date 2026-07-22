import {
  invitationInviteDeliveryChannels,
  type InvitationInviteDeliveryChannel,
  type InvitationInviteLinkSide
} from "./invitationInviteLinks";

export const invitationReminderStages = ["d30", "d14", "d7", "d1", "manual"] as const;

export type InvitationReminderStage = typeof invitationReminderStages[number];

export type InvitationReminderDeliveryInput = {
  linkIds: string[];
  stage: InvitationReminderStage;
  channel: InvitationInviteDeliveryChannel;
  note: string;
};

export type InvitationReminderEventRecord = {
  id: string;
  linkId: string;
  guestName: string;
  side: InvitationInviteLinkSide;
  groupLabel: string;
  stage: InvitationReminderStage;
  channel: InvitationInviteDeliveryChannel;
  note: string;
  sentAt: string;
};

export type InvitationReminderAdminResult = {
  summary: {
    totalSent: number;
    uniqueGuests: number;
    lastSentAt: string | null;
    byStage: Record<InvitationReminderStage, number>;
  };
  events: InvitationReminderEventRecord[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizedNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length <= 200 ? normalized : null;
}

export function parseInvitationReminderDeliveryInput(value: unknown): InvitationReminderDeliveryInput | null {
  if (!isRecord(value) || !Array.isArray(value.linkIds)) return null;
  const linkIds = [...new Set(value.linkIds)];
  const note = normalizedNote(value.note ?? "");
  if (
    linkIds.length < 1
    || linkIds.length > 100
    || !linkIds.every((linkId) => typeof linkId === "string" && /^invite_[0-9a-f-]+$/.test(linkId))
    || !invitationReminderStages.includes(value.stage as InvitationReminderStage)
    || !invitationInviteDeliveryChannels.includes(value.channel as InvitationInviteDeliveryChannel)
    || note === null
  ) return null;
  return {
    linkIds: linkIds as string[],
    stage: value.stage as InvitationReminderStage,
    channel: value.channel as InvitationInviteDeliveryChannel,
    note
  };
}

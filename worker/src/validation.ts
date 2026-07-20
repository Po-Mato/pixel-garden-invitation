import { parseRsvpSubmission, sanitizeText, type RsvpSubmission } from "@wedding-game/shared";

export type RsvpPayload = RsvpSubmission;

export type GuestbookPayload = {
  nickname: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseRsvpPayload(value: unknown, consentVersion = ""): RsvpPayload | null {
  return parseRsvpSubmission(value, consentVersion);
}

export function parseGuestbookPayload(value: unknown): GuestbookPayload | null {
  if (!isRecord(value)) return null;
  const nickname = sanitizeText(value.nickname, 16);
  const message = sanitizeText(value.message, 240);
  if (!nickname || !message) return null;
  return { nickname, message };
}

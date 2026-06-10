import { sanitizeText } from "@wedding-game/shared";

export type RsvpPayload = {
  guestName: string;
  attendance: "yes" | "no" | "unsure";
  partySize: number;
  note: string;
};

export type GuestbookPayload = {
  nickname: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseRsvpPayload(value: unknown): RsvpPayload | null {
  if (!isRecord(value)) return null;
  const guestName = sanitizeText(value.guestName, 30);
  const note = sanitizeText(value.note ?? "", 160);
  const attendance = value.attendance;
  const partySize = value.partySize;

  if (!guestName) return null;
  if (attendance !== "yes" && attendance !== "no" && attendance !== "unsure") return null;
  if (typeof partySize !== "number") return null;
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 10) return null;

  return { guestName, attendance, partySize, note };
}

export function parseGuestbookPayload(value: unknown): GuestbookPayload | null {
  if (!isRecord(value)) return null;
  const nickname = sanitizeText(value.nickname, 16);
  const message = sanitizeText(value.message, 240);
  if (!nickname || !message) return null;
  return { nickname, message };
}

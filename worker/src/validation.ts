import {
  parseGuestbookSubmission,
  parseRsvpSubmission,
  type GuestbookSubmission,
  type RsvpSubmission
} from "@wedding-game/shared";

export type RsvpPayload = RsvpSubmission;

export type GuestbookPayload = GuestbookSubmission;

export function parseRsvpPayload(value: unknown, consentVersion = ""): RsvpPayload | null {
  return parseRsvpSubmission(value, consentVersion);
}

export function parseGuestbookPayload(value: unknown): GuestbookPayload | null {
  return parseGuestbookSubmission(value);
}

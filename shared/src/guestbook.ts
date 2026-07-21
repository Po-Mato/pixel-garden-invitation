import { sanitizeText } from "./validation";

export type GuestbookSubmission = {
  nickname: string;
  message: string;
};

export type GuestbookMessage = GuestbookSubmission & {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type GuestbookOwnedMessage = GuestbookMessage & {
  isHidden: boolean;
};

export type GuestbookCredential = {
  guestbookId: string;
  editToken: string;
};

export type GuestbookCreateResult = {
  response: GuestbookOwnedMessage;
  credential: GuestbookCredential;
};

export type GuestbookPage = {
  messages: GuestbookMessage[];
  nextCursor: string | null;
};

export type GuestbookAdminSummary = {
  totalCount: number;
  visibleCount: number;
  hiddenCount: number;
  deleteAt: string;
};

export type GuestbookAdminResult = {
  summary: GuestbookAdminSummary;
  messages: GuestbookOwnedMessage[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseGuestbookSubmission(value: unknown): GuestbookSubmission | null {
  if (!isRecord(value)) return null;
  const nickname = sanitizeText(value.nickname, 16);
  const message = sanitizeText(value.message, 240);
  return nickname && message ? { nickname, message } : null;
}

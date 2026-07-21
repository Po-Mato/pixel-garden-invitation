import type { GuestbookCredential } from "@wedding-game/shared";

const credentialKey = (invitationId: string) => `wedding:guestbook:${invitationId}`;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return typeof window.localStorage?.getItem === "function" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function parseCredential(value: unknown): GuestbookCredential | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  return typeof record.guestbookId === "string"
    && record.guestbookId.length > 0
    && typeof record.editToken === "string"
    && record.editToken.length > 0
    ? { guestbookId: record.guestbookId, editToken: record.editToken }
    : null;
}

export function loadGuestbookCredential(invitationId: string): GuestbookCredential | null {
  const target = storage();
  if (!target) return null;
  try {
    const raw = target.getItem(credentialKey(invitationId));
    if (!raw) return null;
    const credential = parseCredential(JSON.parse(raw));
    if (!credential) target.removeItem(credentialKey(invitationId));
    return credential;
  } catch {
    try {
      target.removeItem(credentialKey(invitationId));
    } catch {
      // Storage permissions can change between operations.
    }
    return null;
  }
}

export function saveGuestbookCredential(invitationId: string, credential: GuestbookCredential): boolean {
  const target = storage();
  if (!target) return false;
  try {
    target.setItem(credentialKey(invitationId), JSON.stringify(credential));
    return true;
  } catch {
    return false;
  }
}

export function clearGuestbookCredential(invitationId: string): boolean {
  const target = storage();
  if (!target) return false;
  try {
    const key = credentialKey(invitationId);
    const existed = target.getItem(key) !== null;
    target.removeItem(key);
    return existed;
  } catch {
    return false;
  }
}

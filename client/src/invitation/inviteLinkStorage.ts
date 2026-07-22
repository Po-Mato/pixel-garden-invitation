import type { PublicInvitationInvite } from "@wedding-game/shared";

export type StoredInvitationInvite = {
  token: string;
  invite: PublicInvitationInvite;
};

function key(invitationId: string): string {
  return `wedding:invite-link:${invitationId}`;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function valid(value: unknown): value is StoredInvitationInvite {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<StoredInvitationInvite>;
  return typeof item.token === "string"
    && /^[A-Za-z0-9_-]{43}$/.test(item.token)
    && typeof item.invite?.guestName === "string"
    && (item.invite.side === "groom" || item.invite.side === "bride")
    && typeof item.invite.groupLabel === "string";
}

export function loadStoredInvitationInvite(invitationId: string): StoredInvitationInvite | null {
  const target = storage();
  if (!target) return null;
  try {
    const value: unknown = JSON.parse(target.getItem(key(invitationId)) ?? "null");
    if (valid(value)) return value;
    target.removeItem(key(invitationId));
  } catch {
    try { target.removeItem(key(invitationId)); } catch { /* unavailable storage */ }
  }
  return null;
}

export function saveStoredInvitationInvite(invitationId: string, value: StoredInvitationInvite): boolean {
  try {
    storage()?.setItem(key(invitationId), JSON.stringify(value));
    return storage() !== null;
  } catch {
    return false;
  }
}

export function clearStoredInvitationInvite(invitationId: string): void {
  try { storage()?.removeItem(key(invitationId)); } catch { /* unavailable storage */ }
}

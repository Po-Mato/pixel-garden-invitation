import type { InvitationInviteLinkCreated } from "@wedding-game/shared";

function key(invitationId: string): string {
  return `wedding:admin:invite-link-tokens:${invitationId}`;
}

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}

function validTokens(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && Object.entries(value).every(([id, token]) => (
    /^invite_[0-9a-f-]+$/.test(id) && typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)
  ));
}

export function loadAdminInviteLinkTokens(invitationId: string): Record<string, string> {
  const target = storage();
  if (!target) return {};
  try {
    const parsed: unknown = JSON.parse(target.getItem(key(invitationId)) ?? "{}");
    if (validTokens(parsed)) return parsed;
    target.removeItem(key(invitationId));
  } catch {
    try { target.removeItem(key(invitationId)); } catch { /* unavailable storage */ }
  }
  return {};
}

export function saveAdminInviteLinkTokens(
  invitationId: string,
  current: Record<string, string>,
  created: InvitationInviteLinkCreated[]
): Record<string, string> {
  const next = { ...current };
  for (const item of created) next[item.link.id] = item.token;
  try { storage()?.setItem(key(invitationId), JSON.stringify(next)); } catch { /* unavailable storage */ }
  return next;
}

export function removeAdminInviteLinkToken(
  invitationId: string,
  current: Record<string, string>,
  linkId: string
): Record<string, string> {
  const next = { ...current };
  delete next[linkId];
  try { storage()?.setItem(key(invitationId), JSON.stringify(next)); } catch { /* unavailable storage */ }
  return next;
}

export function clearAdminInviteLinkTokens(invitationId: string): void {
  try { storage()?.removeItem(key(invitationId)); } catch { /* unavailable storage */ }
}

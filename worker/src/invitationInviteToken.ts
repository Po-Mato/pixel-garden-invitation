import { validInvitationInviteToken } from "@wedding-game/shared";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hashInvitationInviteToken(token: string): Promise<string> {
  if (!validInvitationInviteToken(token)) throw new Error("invalid invite token");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64Url(new Uint8Array(digest));
}

export async function createInvitationInviteToken(): Promise<{ token: string; tokenHash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = base64Url(bytes);
  return { token, tokenHash: await hashInvitationInviteToken(token) };
}

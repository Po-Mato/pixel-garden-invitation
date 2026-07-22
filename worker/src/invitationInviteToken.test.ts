import { describe, expect, it, vi } from "vitest";
import { createInvitationInviteToken, hashInvitationInviteToken } from "./invitationInviteToken";

describe("invitation invite token", () => {
  it("creates a fixed-length opaque token and a different hash", async () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint8Array).fill(7);
      return array;
    });
    const credential = await createInvitationInviteToken();
    expect(credential.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(credential.tokenHash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(credential.tokenHash).not.toBe(credential.token);
    await expect(hashInvitationInviteToken(credential.token)).resolves.toBe(credential.tokenHash);
    vi.restoreAllMocks();
  });

  it("rejects malformed tokens before hashing", async () => {
    await expect(hashInvitationInviteToken("short")).rejects.toThrow("invalid invite token");
  });
});

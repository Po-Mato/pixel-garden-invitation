import { describe, expect, it } from "vitest";
import {
  createEditCredential,
  hashClientKey,
  hashEditToken,
  issueAdminToken,
  verifyAdminToken,
  verifyPassword
} from "./security";

describe("edit credentials", () => {
  it("stores only a stable hash for an unpredictable edit token", async () => {
    const first = await createEditCredential();
    const second = await createEditCredential();

    expect(first.editToken).not.toBe(second.editToken);
    expect(first.editToken).not.toBe(first.editTokenHash);
    await expect(hashEditToken(first.editToken)).resolves.toBe(first.editTokenHash);
  });
});

describe("password verification", () => {
  it("accepts the matching fixed-format PBKDF2 password hash", async () => {
    await expect(
      verifyPassword(
        "correct horse battery staple",
        "pbkdf2-sha256$210000$MTIzNDU2Nzg5MDEyMzQ1Ng$phubAHgXidq3Bl2dnyCVT5BhzrMiDhR5bKZqTmIWi2s"
      )
    ).resolves.toBe(true);
  });

  it("rejects incorrect passwords and malformed PBKDF2 values", async () => {
    await expect(
      verifyPassword(
        "incorrect password",
        "pbkdf2-sha256$210000$MTIzNDU2Nzg5MDEyMzQ1Ng$phubAHgXidq3Bl2dnyCVT5BhzrMiDhR5bKZqTmIWi2s"
      )
    ).resolves.toBe(false);
    await expect(verifyPassword("correct horse battery staple", "pbkdf2-sha256$1$salt$hash")).resolves.toBe(false);
  });
});

describe("admin tokens", () => {
  it("verifies a signed token for its invitation before expiration", async () => {
    const claims = { invitationId: "sample-garden", expiresAt: 2_000 };
    const token = await issueAdminToken(claims, "session-secret");

    await expect(verifyAdminToken(token, "session-secret", "sample-garden", 1_000)).resolves.toEqual(claims);
  });

  it("rejects changed, expired, and cross-invitation admin tokens", async () => {
    const token = await issueAdminToken({ invitationId: "sample-garden", expiresAt: 2_000 }, "session-secret");

    await expect(verifyAdminToken(`${token}x`, "session-secret", "sample-garden", 1_000)).resolves.toBeNull();
    await expect(verifyAdminToken(token, "session-secret", "other", 1_000)).resolves.toBeNull();
    await expect(verifyAdminToken(token, "session-secret", "sample-garden", 2_001)).resolves.toBeNull();
  });
});

describe("client key hashing", () => {
  it("creates a secret-bound stable hash", async () => {
    await expect(hashClientKey("127.0.0.1", "rate-limit-secret")).resolves.toBe(
      "a47GqOANCQyf_wgKayIetFiHSCBbv1HMniIOWqtwnjs"
    );
    await expect(hashClientKey("127.0.0.1", "another-secret")).resolves.not.toBe(
      "a47GqOANCQyf_wgKayIetFiHSCBbv1HMniIOWqtwnjs"
    );
  });
});

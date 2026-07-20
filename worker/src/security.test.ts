import { describe, expect, it } from "vitest";
import {
  createEditCredential,
  hashClientKey,
  hashEditToken,
  issueAdminToken,
  verifyAdminToken,
  verifyPassword
} from "./security";

const base64UrlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signRawAdminToken(payload: unknown, secret: string): Promise<string> {
  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = encodeBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload))));
  return `${encodedPayload}.${signature}`;
}

function alterUnusedBase64UrlPadBits(value: string): string {
  const lastCharacter = value.at(-1)!;
  const index = base64UrlAlphabet.indexOf(lastCharacter);
  return `${value.slice(0, -1)}${base64UrlAlphabet[(index & 0b111100) | 0b01]}`;
}

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

  it.each([
    "pbkdf2-sha256$210000",
    "pbkdf2-sha256$210000$$phubAHgXidq3Bl2dnyCVT5BhzrMiDhR5bKZqTmIWi2s",
    "pbkdf2-sha256$210000$MTIzNDU2Nzg5MDEyMzQ1Ng"
  ])("returns false for a PBKDF2 value with missing fields", async (encodedHash) => {
    await expect(verifyPassword("correct horse battery staple", encodedHash)).resolves.toBe(false);
  });

  it("returns false for runtime malformed inputs", async () => {
    await expect(verifyPassword("correct horse battery staple", null as unknown as string)).resolves.toBe(false);
    await expect(verifyPassword(null as unknown as string, "pbkdf2-sha256$210000$salt$hash")).resolves.toBe(false);
  });
});

describe("admin tokens", () => {
  it("verifies a signed token for its invitation before expiration", async () => {
    const claims = { invitationId: "sample-garden", expiresAt: 2_000 };
    const token = await issueAdminToken(claims, "session-secret");

    await expect(verifyAdminToken(token, "session-secret", "sample-garden", 1_000)).resolves.toEqual(claims);
  });

  it("issues a canonical token regardless of input claim property order", async () => {
    const canonical = await issueAdminToken({ invitationId: "sample-garden", expiresAt: 2_000 }, "session-secret");
    const reordered = await issueAdminToken({ expiresAt: 2_000, invitationId: "sample-garden" }, "session-secret");

    expect(reordered).toBe(canonical);
  });

  it("rejects changed, expired, and cross-invitation admin tokens", async () => {
    const token = await issueAdminToken({ invitationId: "sample-garden", expiresAt: 2_000 }, "session-secret");

    await expect(verifyAdminToken(`${token}x`, "session-secret", "sample-garden", 1_000)).resolves.toBeNull();
    await expect(verifyAdminToken(token, "session-secret", "other", 1_000)).resolves.toBeNull();
    await expect(verifyAdminToken(token, "session-secret", "sample-garden", 2_001)).resolves.toBeNull();
  });

  it("rejects a token at its exact expiration time", async () => {
    const token = await issueAdminToken({ invitationId: "sample-garden", expiresAt: 2_000 }, "session-secret");

    await expect(verifyAdminToken(token, "session-secret", "sample-garden", 2_000)).resolves.toBeNull();
  });

  it("rejects a non-canonical base64url signature with equivalent decoded bytes", async () => {
    const token = await issueAdminToken({ invitationId: "sample-garden", expiresAt: 2_000 }, "session-secret");
    const [payload, signature] = token.split(".");
    const altered = `${payload}.${alterUnusedBase64UrlPadBits(signature)}`;

    await expect(verifyAdminToken(altered, "session-secret", "sample-garden", 1_000)).resolves.toBeNull();
  });

  it("rejects a validly signed token with extra claims", async () => {
    const token = await signRawAdminToken(
      { invitationId: "sample-garden", expiresAt: 2_000, role: "owner" },
      "session-secret"
    );

    await expect(verifyAdminToken(token, "session-secret", "sample-garden", 1_000)).resolves.toBeNull();
  });

  it("returns null for runtime malformed inputs", async () => {
    await expect(verifyAdminToken(null as unknown as string, "session-secret", "sample-garden", 1_000)).resolves.toBeNull();
    await expect(verifyAdminToken("invalid", "session-secret", null as unknown as string, 1_000)).resolves.toBeNull();
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

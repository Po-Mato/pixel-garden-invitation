export type AdminClaims = {
  invitationId: string;
  expiresAt: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) return null;

  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return encodeBase64Url(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmacSha256(value: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function isAdminClaims(value: unknown): value is AdminClaims {
  if (typeof value !== "object" || value === null) return false;
  const claims = value as Record<string, unknown>;
  const ownKeys = Reflect.ownKeys(claims);
  if (ownKeys.length !== 2 || !ownKeys.includes("invitationId") || !ownKeys.includes("expiresAt")) return false;
  return typeof claims.invitationId === "string"
    && claims.invitationId.length > 0
    && typeof claims.expiresAt === "number"
    && Number.isSafeInteger(claims.expiresAt);
}

export async function createEditCredential(): Promise<{ editToken: string; editTokenHash: string }> {
  const editToken = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  return { editToken, editTokenHash: await hashEditToken(editToken) };
}

export async function hashEditToken(token: string): Promise<string> {
  return encodeBase64Url(await sha256(token));
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  if (typeof password !== "string" || typeof encodedHash !== "string") return false;

  const [algorithm, iterations, encodedSalt, encodedDerivedKey, ...extra] = encodedHash.split("$");
  if (
    algorithm !== "pbkdf2-sha256"
    || iterations !== "210000"
    || typeof encodedSalt !== "string"
    || typeof encodedDerivedKey !== "string"
    || extra.length > 0
  ) return false;

  const salt = decodeBase64Url(encodedSalt);
  const expectedDerivedKey = decodeBase64Url(encodedDerivedKey);
  if (!salt || salt.length !== 16 || !expectedDerivedKey || expectedDerivedKey.length !== 32) return false;

  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const derivedKey = new Uint8Array(await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: copyToArrayBuffer(salt), iterations: 210_000 },
      key,
      256
    ));
    return constantTimeEqual(derivedKey, expectedDerivedKey);
  } catch {
    return false;
  }
}

export async function issueAdminToken(claims: AdminClaims, secret: string): Promise<string> {
  if (!isAdminClaims(claims)) throw new TypeError("Invalid admin claims");

  const canonicalClaims = { invitationId: claims.invitationId, expiresAt: claims.expiresAt };
  const payload = encodeBase64Url(encoder.encode(JSON.stringify(canonicalClaims)));
  const signature = encodeBase64Url(await hmacSha256(payload, secret));
  return `${payload}.${signature}`;
}

export async function verifyAdminToken(
  token: string,
  secret: string,
  invitationId: string,
  now: number
): Promise<AdminClaims | null> {
  if (
    typeof token !== "string"
    || typeof secret !== "string"
    || typeof invitationId !== "string"
    || !Number.isSafeInteger(now)
  ) return null;

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [payload, encodedSignature] = parts;
  const receivedSignature = decodeBase64Url(encodedSignature);
  if (!receivedSignature) return null;

  try {
    const expectedSignature = await hmacSha256(payload, secret);
    if (!constantTimeEqual(expectedSignature, receivedSignature)) return null;

    const payloadBytes = decodeBase64Url(payload);
    if (!payloadBytes) return null;
    const claims: unknown = JSON.parse(decoder.decode(payloadBytes));
    if (!isAdminClaims(claims)) return null;
    if (claims.invitationId !== invitationId || claims.expiresAt <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function hashClientKey(clientKey: string, secret: string): Promise<string> {
  return encodeBase64Url(await hmacSha256(clientKey, secret));
}

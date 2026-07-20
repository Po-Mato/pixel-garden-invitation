import type { AdminSession, RsvpCredential } from "../api/weddingApi";

const credentialKey = (invitationId: string) => `wedding:rsvp:${invitationId}`;
const adminSessionKey = (invitationId: string) => `wedding:rsvp-admin:${invitationId}`;

type StorageKind = "localStorage" | "sessionStorage";

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window[kind];
    return typeof storage?.getItem === "function"
      && typeof storage.setItem === "function"
      && typeof storage.removeItem === "function"
      ? storage
      : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isEpochMilliseconds(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseCredential(value: unknown): RsvpCredential | null {
  return isRecord(value) && nonEmptyString(value.rsvpId) && nonEmptyString(value.editToken)
    ? { rsvpId: value.rsvpId, editToken: value.editToken }
    : null;
}

function parseAdminSession(value: unknown): AdminSession | null {
  return isRecord(value) && nonEmptyString(value.token) && isEpochMilliseconds(value.expiresAt)
    ? { token: value.token, expiresAt: value.expiresAt }
    : null;
}

function load<T>(kind: StorageKind, key: string, parse: (value: unknown) => T | null): T | null {
  const storage = getStorage(kind);
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = parse(JSON.parse(raw));
    if (!value) storage.removeItem(key);
    return value;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage permissions can change between operations.
    }
    return null;
  }
}

function save<T>(kind: StorageKind, key: string, value: T): boolean {
  const storage = getStorage(kind);
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function clear(kind: StorageKind, key: string): boolean {
  const storage = getStorage(kind);
  if (!storage) return false;
  try {
    const existed = storage.getItem(key) !== null;
    storage.removeItem(key);
    return existed;
  } catch {
    return false;
  }
}

export function loadRsvpCredential(invitationId: string): RsvpCredential | null {
  return load("localStorage", credentialKey(invitationId), parseCredential);
}

export function saveRsvpCredential(invitationId: string, credential: RsvpCredential): boolean {
  return save("localStorage", credentialKey(invitationId), {
    rsvpId: credential.rsvpId,
    editToken: credential.editToken
  });
}

export function clearRsvpCredential(invitationId: string): boolean {
  return clear("localStorage", credentialKey(invitationId));
}

export function loadAdminSession(invitationId: string): AdminSession | null {
  const key = adminSessionKey(invitationId);
  const session = load("sessionStorage", key, parseAdminSession);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    clear("sessionStorage", key);
    return null;
  }
  return session;
}

export function saveAdminSession(invitationId: string, session: AdminSession): boolean {
  return save("sessionStorage", adminSessionKey(invitationId), {
    token: session.token,
    expiresAt: session.expiresAt
  });
}

export function clearAdminSession(invitationId: string): boolean {
  return clear("sessionStorage", adminSessionKey(invitationId));
}

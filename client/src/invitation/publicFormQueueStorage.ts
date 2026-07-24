import type { GuestbookSubmission, RsvpSubmission } from "@wedding-game/shared";

const queueVersion = 1;
const queueLifetimeMs = 7 * 24 * 60 * 60 * 1000;

type QueueKind = "rsvp" | "guestbook";
type QueueStorage = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;

export type PublicFormQueueItem<T> = {
  value: T;
  queuedAt: string;
};

type StoredQueueItem<T> = PublicFormQueueItem<T> & {
  version: number;
  expiresAt: string;
};

function browserStorage(): QueueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function queueKey(invitationId: string, kind: QueueKind): string {
  return `wedding-garden:${invitationId}:send-queue:${kind}:v1`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRsvpSubmission(value: unknown): value is RsvpSubmission {
  if (!isRecord(value)) return false;
  return (value.side === "bride" || value.side === "groom")
    && typeof value.guestName === "string"
    && typeof value.phone === "string"
    && (value.attendance === "yes" || value.attendance === "no" || value.attendance === "unsure")
    && typeof value.partySize === "number"
    && (value.mealStatus === "yes" || value.mealStatus === "no" || value.mealStatus === "unsure" || value.mealStatus === "not_applicable")
    && typeof value.note === "string"
    && typeof value.consentVersion === "string";
}

function isGuestbookSubmission(value: unknown): value is GuestbookSubmission {
  return isRecord(value) && typeof value.nickname === "string" && typeof value.message === "string";
}

function removeItem(storage: QueueStorage, key: string): boolean {
  if (typeof storage.removeItem !== "function") return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function loadQueue<T>(
  invitationId: string,
  kind: QueueKind,
  validate: (value: unknown) => value is T,
  storage: QueueStorage | null = browserStorage(),
  now = Date.now()
): PublicFormQueueItem<T> | null {
  if (!storage) return null;
  const key = queueKey(invitationId, kind);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredQueueItem<unknown>;
    if (
      parsed.version !== queueVersion
      || typeof parsed.queuedAt !== "string"
      || typeof parsed.expiresAt !== "string"
      || Date.parse(parsed.expiresAt) <= now
      || !validate(parsed.value)
    ) {
      removeItem(storage, key);
      return null;
    }
    return { value: parsed.value, queuedAt: parsed.queuedAt };
  } catch {
    removeItem(storage, key);
    return null;
  }
}

function saveQueue<T>(
  invitationId: string,
  kind: QueueKind,
  value: T,
  storage: QueueStorage | null = browserStorage(),
  now = new Date()
): PublicFormQueueItem<T> | null {
  if (!storage) return null;
  const queuedAt = now.toISOString();
  const stored: StoredQueueItem<T> = {
    version: queueVersion,
    value,
    queuedAt,
    expiresAt: new Date(now.getTime() + queueLifetimeMs).toISOString()
  };
  try {
    storage.setItem(queueKey(invitationId, kind), JSON.stringify(stored));
    return { value, queuedAt };
  } catch {
    return null;
  }
}

function clearQueue(invitationId: string, kind: QueueKind, storage: QueueStorage | null = browserStorage()): boolean {
  return storage ? removeItem(storage, queueKey(invitationId, kind)) : false;
}

export function loadRsvpSendQueue(invitationId: string, storage?: QueueStorage | null, now?: number) {
  return loadQueue(invitationId, "rsvp", isRsvpSubmission, storage, now);
}

export function saveRsvpSendQueue(invitationId: string, value: RsvpSubmission, storage?: QueueStorage | null, now?: Date) {
  return saveQueue(invitationId, "rsvp", value, storage, now);
}

export function clearRsvpSendQueue(invitationId: string, storage?: QueueStorage | null): boolean {
  return clearQueue(invitationId, "rsvp", storage);
}

export function loadGuestbookSendQueue(invitationId: string, storage?: QueueStorage | null, now?: number) {
  return loadQueue(invitationId, "guestbook", isGuestbookSubmission, storage, now);
}

export function saveGuestbookSendQueue(invitationId: string, value: GuestbookSubmission, storage?: QueueStorage | null, now?: Date) {
  return saveQueue(invitationId, "guestbook", value, storage, now);
}

export function clearGuestbookSendQueue(invitationId: string, storage?: QueueStorage | null): boolean {
  return clearQueue(invitationId, "guestbook", storage);
}

import type {
  GuestbookSubmission,
  RsvpAttendance,
  RsvpMealStatus,
  RsvpSide,
  RsvpSubmission
} from "@wedding-game/shared";

const draftVersion = 1;
const draftLifetimeMs = 7 * 24 * 60 * 60 * 1000;

type DraftKind = "rsvp" | "guestbook";
type DraftStorage = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;

export type RsvpFormDraft = Omit<RsvpSubmission, "consentVersion"> & {
  consentVersion: string | null;
};

export type PublicFormDraft<T> = {
  value: T;
  savedAt: string;
};

type StoredDraft<T> = PublicFormDraft<T> & {
  version: number;
  expiresAt: string;
};

const rsvpSides = new Set<RsvpSide>(["bride", "groom"]);
const rsvpAttendance = new Set<RsvpAttendance>(["yes", "no", "unsure"]);
const rsvpMeals = new Set<RsvpMealStatus>(["yes", "no", "unsure", "not_applicable"]);

function browserStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function storageKey(invitationId: string, kind: DraftKind): string {
  return `wedding-garden:${invitationId}:draft:${kind}:v1`;
}

function removeDraft(storage: DraftStorage, key: string): boolean {
  if (typeof storage.removeItem !== "function") return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRsvpDraft(value: unknown): value is RsvpFormDraft {
  if (!isRecord(value)) return false;
  return rsvpSides.has(value.side as RsvpSide)
    && typeof value.guestName === "string"
    && typeof value.phone === "string"
    && rsvpAttendance.has(value.attendance as RsvpAttendance)
    && typeof value.partySize === "number"
    && rsvpMeals.has(value.mealStatus as RsvpMealStatus)
    && typeof value.note === "string"
    && (typeof value.consentVersion === "string" || value.consentVersion === null);
}

function isGuestbookDraft(value: unknown): value is GuestbookSubmission {
  return isRecord(value)
    && typeof value.nickname === "string"
    && typeof value.message === "string";
}

function loadDraft<T>(
  invitationId: string,
  kind: DraftKind,
  validate: (value: unknown) => value is T,
  storage: DraftStorage | null = browserStorage(),
  now = Date.now()
): PublicFormDraft<T> | null {
  if (!storage) return null;
  const key = storageKey(invitationId, kind);

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<unknown>;
    if (
      parsed.version !== draftVersion
      || typeof parsed.savedAt !== "string"
      || typeof parsed.expiresAt !== "string"
      || Date.parse(parsed.expiresAt) <= now
      || !validate(parsed.value)
    ) {
      removeDraft(storage, key);
      return null;
    }
    return { value: parsed.value, savedAt: parsed.savedAt };
  } catch {
    removeDraft(storage, key);
    return null;
  }
}

function saveDraft<T>(
  invitationId: string,
  kind: DraftKind,
  value: T,
  storage: DraftStorage | null = browserStorage(),
  now = new Date()
): PublicFormDraft<T> | null {
  if (!storage) return null;
  const savedAt = now.toISOString();
  const stored: StoredDraft<T> = {
    version: draftVersion,
    value,
    savedAt,
    expiresAt: new Date(now.getTime() + draftLifetimeMs).toISOString()
  };

  try {
    storage.setItem(storageKey(invitationId, kind), JSON.stringify(stored));
    return { value, savedAt };
  } catch {
    return null;
  }
}

export function loadRsvpFormDraft(
  invitationId: string,
  storage?: DraftStorage | null,
  now?: number
): PublicFormDraft<RsvpFormDraft> | null {
  return loadDraft(invitationId, "rsvp", isRsvpDraft, storage, now);
}

export function saveRsvpFormDraft(
  invitationId: string,
  value: RsvpFormDraft,
  storage?: DraftStorage | null,
  now?: Date
): PublicFormDraft<RsvpFormDraft> | null {
  return saveDraft(invitationId, "rsvp", value, storage, now);
}

export function clearRsvpFormDraft(invitationId: string, storage: DraftStorage | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    return removeDraft(storage, storageKey(invitationId, "rsvp"));
  } catch {
    return false;
  }
}

export function loadGuestbookFormDraft(
  invitationId: string,
  storage?: DraftStorage | null,
  now?: number
): PublicFormDraft<GuestbookSubmission> | null {
  return loadDraft(invitationId, "guestbook", isGuestbookDraft, storage, now);
}

export function saveGuestbookFormDraft(
  invitationId: string,
  value: GuestbookSubmission,
  storage?: DraftStorage | null,
  now?: Date
): PublicFormDraft<GuestbookSubmission> | null {
  return saveDraft(invitationId, "guestbook", value, storage, now);
}

export function clearGuestbookFormDraft(invitationId: string, storage: DraftStorage | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    return removeDraft(storage, storageKey(invitationId, "guestbook"));
  } catch {
    return false;
  }
}

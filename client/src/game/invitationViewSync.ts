import type { WorldZoneId } from "@wedding-game/shared";
import type { JourneyCheckpointId } from "./journeyProgress";

export const invitationViewSyncStorageKey = "wedding-game:view-sync:v1";

export type QuickInvitationSectionId = "top" | "couple" | "story" | "gallery" | "schedule" | "directions" | "rsvp" | "gift" | "contact" | "guestbook" | "share";

export type InvitationViewSync = {
  version: 1;
  source: "game" | "quick";
  zoneId: WorldZoneId | null;
  sectionId: QuickInvitationSectionId;
  checkpointId: JourneyCheckpointId | null;
  updatedAt: string;
};

type ViewSyncStorage = Pick<Storage, "getItem" | "setItem">;

const sectionIds = new Set<QuickInvitationSectionId>([
  "top", "couple", "story", "gallery", "schedule", "directions", "rsvp", "gift", "contact", "guestbook", "share"
]);

const zoneSection: Record<WorldZoneId, QuickInvitationSectionId> = {
  home: "directions",
  neighborhood: "directions",
  "subway-station": "directions",
  "subway-train": "directions",
  "venue-exterior": "directions",
  lobby: "gallery",
  "bridal-room": "couple",
  "ceremony-hall": "schedule",
  banquet: "guestbook",
  restroom: "directions"
};

const sectionCheckpoint: Partial<Record<QuickInvitationSectionId, JourneyCheckpointId>> = {
  directions: "directions",
  gallery: "gallery",
  couple: "bride",
  schedule: "ceremony",
  guestbook: "guestbook"
};

function browserStorage(): ViewSyncStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function save(sync: InvitationViewSync, storage: ViewSyncStorage | null): InvitationViewSync {
  try { storage?.setItem(invitationViewSyncStorageKey, JSON.stringify(sync)); } catch { /* no-op */ }
  return sync;
}

export function saveGameViewLocation(
  zoneId: WorldZoneId,
  checkpointId: JourneyCheckpointId | null = null,
  storage: ViewSyncStorage | null = browserStorage(),
  updatedAt = new Date().toISOString()
): InvitationViewSync {
  const sectionId = zoneSection[zoneId];
  return save({
    version: 1,
    source: "game",
    zoneId,
    sectionId,
    checkpointId: checkpointId ?? sectionCheckpoint[sectionId] ?? null,
    updatedAt
  }, storage);
}

export function saveQuickViewSection(
  sectionId: QuickInvitationSectionId,
  storage: ViewSyncStorage | null = browserStorage(),
  updatedAt = new Date().toISOString()
): InvitationViewSync {
  return save({
    version: 1,
    source: "quick",
    zoneId: null,
    sectionId,
    checkpointId: sectionCheckpoint[sectionId] ?? null,
    updatedAt
  }, storage);
}

export function loadInvitationViewSync(
  storage: ViewSyncStorage | null = browserStorage()
): InvitationViewSync | null {
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(invitationViewSyncStorageKey) ?? "null") as Partial<InvitationViewSync> | null;
    if (!parsed || (parsed.source !== "game" && parsed.source !== "quick") || !sectionIds.has(parsed.sectionId as QuickInvitationSectionId)) return null;
    return {
      version: 1,
      source: parsed.source,
      zoneId: typeof parsed.zoneId === "string" ? parsed.zoneId as WorldZoneId : null,
      sectionId: parsed.sectionId as QuickInvitationSectionId,
      checkpointId: typeof parsed.checkpointId === "string" ? parsed.checkpointId as JourneyCheckpointId : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString()
    };
  } catch {
    return null;
  }
}

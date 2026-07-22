export const guestAnnouncementTones = ["info", "important", "urgent"] as const;
export const guestAnnouncementActionKinds = ["none", "directions", "venue_phone", "external"] as const;

export type GuestAnnouncementTone = typeof guestAnnouncementTones[number];
export type GuestAnnouncementActionKind = typeof guestAnnouncementActionKinds[number];

export type GuestAnnouncementInput = {
  title: string;
  body: string;
  tone: GuestAnnouncementTone;
  active: boolean;
  pinned: boolean;
  startsAt: string | null;
  endsAt: string | null;
  actionKind: GuestAnnouncementActionKind;
  actionLabel: string;
  actionUrl: string | null;
  sortOrder: number;
};

export type GuestAnnouncementRecord = GuestAnnouncementInput & {
  id: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GuestFaqInput = {
  category: string;
  question: string;
  answer: string;
  active: boolean;
  featured: boolean;
  sortOrder: number;
};

export type GuestFaqRecord = GuestFaqInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type GuestInformationPublicResult = {
  announcements: GuestAnnouncementRecord[];
  faqs: GuestFaqRecord[];
  generatedAt: string;
};

export type GuestInformationAdminResult = GuestInformationPublicResult & {
  summary: {
    totalAnnouncements: number;
    activeAnnouncements: number;
    urgentAnnouncements: number;
    totalFaqs: number;
    activeFaqs: number;
    announcementViews: number;
  };
};

export type GuestInformationCreateInput =
  | { kind: "announcement"; input: GuestAnnouncementInput }
  | { kind: "faq"; input: GuestFaqInput };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizedString(value: unknown, maxLength: number, allowEmpty = false): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if ((!allowEmpty && normalized.length === 0) || normalized.length > maxLength) return null;
  return normalized;
}

function nullableIsoDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function sortOrder(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 999
    ? value
    : null;
}

function externalUrl(value: unknown): string | null {
  const normalized = normalizedString(value, 500);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseGuestAnnouncementInput(value: unknown): GuestAnnouncementInput | null {
  if (!isRecord(value)) return null;
  const title = normalizedString(value.title, 60);
  const body = normalizedString(value.body, 300);
  const actionLabel = normalizedString(value.actionLabel, 24, true);
  const startsAt = nullableIsoDate(value.startsAt);
  const endsAt = nullableIsoDate(value.endsAt);
  const order = sortOrder(value.sortOrder);
  if (
    title === null
    || body === null
    || actionLabel === null
    || startsAt === undefined
    || endsAt === undefined
    || order === null
    || !guestAnnouncementTones.includes(value.tone as GuestAnnouncementTone)
    || !guestAnnouncementActionKinds.includes(value.actionKind as GuestAnnouncementActionKind)
    || typeof value.active !== "boolean"
    || typeof value.pinned !== "boolean"
  ) return null;
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return null;

  const actionKind = value.actionKind as GuestAnnouncementActionKind;
  const actionUrl = actionKind === "external" ? externalUrl(value.actionUrl) : null;
  if (actionKind === "external" && !actionUrl) return null;

  return {
    title,
    body,
    tone: value.tone as GuestAnnouncementTone,
    active: value.active,
    pinned: value.pinned,
    startsAt,
    endsAt,
    actionKind,
    actionLabel,
    actionUrl,
    sortOrder: order
  };
}

export function parseGuestFaqInput(value: unknown): GuestFaqInput | null {
  if (!isRecord(value)) return null;
  const category = normalizedString(value.category, 30);
  const question = normalizedString(value.question, 80);
  const answer = normalizedString(value.answer, 500);
  const order = sortOrder(value.sortOrder);
  if (
    category === null
    || question === null
    || answer === null
    || order === null
    || typeof value.active !== "boolean"
    || typeof value.featured !== "boolean"
  ) return null;
  return { category, question, answer, active: value.active, featured: value.featured, sortOrder: order };
}

export function parseGuestInformationCreateInput(value: unknown): GuestInformationCreateInput | null {
  if (!isRecord(value)) return null;
  if (value.kind === "announcement") {
    const input = parseGuestAnnouncementInput(value.input);
    return input ? { kind: "announcement", input } : null;
  }
  if (value.kind === "faq") {
    const input = parseGuestFaqInput(value.input);
    return input ? { kind: "faq", input } : null;
  }
  return null;
}

export function parseGuestAnnouncementViewIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.announcementIds) || value.announcementIds.length > 10) return null;
  const ids = [...new Set(value.announcementIds)];
  return ids.length > 0 && ids.every((id) => typeof id === "string" && /^notice_[0-9a-z-]{1,72}$/.test(id))
    ? ids as string[]
    : null;
}

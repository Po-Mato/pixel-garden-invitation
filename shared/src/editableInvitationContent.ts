import type {
  WeddingEvent,
  WeddingFamilyContact,
  WeddingGiftAccount
} from "./content";
import type { WeddingContent } from "./weddingContent";

export const editableContactIds = [
  "groom",
  "groom-father",
  "groom-mother",
  "bride",
  "bride-father",
  "bride-mother"
] as const;

export const editableStoryIds = ["hello", "seasons", "promise", "wedding"] as const;

export type EditableContactId = typeof editableContactIds[number];
export type EditableStoryId = typeof editableStoryIds[number];

export type EditableInvitationContent = {
  familyContacts: {
    notice: string;
    contacts: WeddingFamilyContact[];
  };
  giftAccounts: {
    notice: string;
    accounts: WeddingGiftAccount[];
  };
  coupleIntroduction: {
    bride: string;
    groom: string;
    together: string;
  };
  storyTimeline: Array<{
    id: EditableStoryId;
    title: string;
    body: string;
  }>;
  share: {
    title: string;
    description: string;
  };
};

export type InvitationContentVersionAction = "save" | "publish" | "restore";

export type InvitationContentVersion = {
  id: string;
  revision: number;
  action: InvitationContentVersionAction;
  content: EditableInvitationContent;
  createdAt: string;
};

export type InvitationContentAdminResult = {
  draft: EditableInvitationContent | null;
  revision: number;
  publishedRevision: number | null;
  updatedAt: string | null;
  publishedAt: string | null;
  history: InvitationContentVersion[];
};

export type InvitationContentPublicResult = {
  content: EditableInvitationContent | null;
  revision: number | null;
  publishedAt: string | null;
};

type ContactDefinition = Pick<WeddingFamilyContact, "id" | "side" | "relation">;

const contactDefinitions: Record<EditableContactId, ContactDefinition> = {
  groom: { id: "groom", side: "groom", relation: "신랑" },
  "groom-father": { id: "groom-father", side: "groom", relation: "신랑 아버지" },
  "groom-mother": { id: "groom-mother", side: "groom", relation: "신랑 어머니" },
  bride: { id: "bride", side: "bride", relation: "신부" },
  "bride-father": { id: "bride-father", side: "bride", relation: "신부 아버지" },
  "bride-mother": { id: "bride-mother", side: "bride", relation: "신부 어머니" }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim();
  return normalized.length <= maxLength ? normalized : null;
}

function normalizedPhone(value: unknown): string | null {
  const phone = normalizedString(value, 24);
  return phone !== null && /^[0-9+()\-\s]*$/.test(phone) ? phone : null;
}

function normalizedHttpsUrl(value: unknown): string | null {
  const candidate = normalizedString(value, 500);
  if (candidate === null || candidate === "") return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseContact(value: unknown): WeddingFamilyContact | null {
  if (!isRecord(value) || typeof value.id !== "string" || !(value.id in contactDefinitions)) return null;
  const definition = contactDefinitions[value.id as EditableContactId];
  const name = normalizedString(value.name, 30);
  const phone = normalizedPhone(value.phone);
  if (value.side !== definition.side || value.relation !== definition.relation || name === null || phone === null) {
    return null;
  }
  return { ...definition, name, phone };
}

function parseAccount(value: unknown): WeddingGiftAccount | null {
  if (!isRecord(value) || typeof value.id !== "string" || !(value.id in contactDefinitions)) return null;
  const definition = contactDefinitions[value.id as EditableContactId];
  const name = normalizedString(value.name, 30);
  const bank = normalizedString(value.bank, 24);
  const accountNumber = normalizedString(value.accountNumber, 48);
  const holder = normalizedString(value.holder, 30);
  const kakaoPayUrl = normalizedHttpsUrl(value.kakaoPayUrl);
  const tossUrl = normalizedHttpsUrl(value.tossUrl);
  if (
    value.side !== definition.side
    || value.relation !== definition.relation
    || name === null
    || bank === null
    || accountNumber === null
    || holder === null
    || kakaoPayUrl === null
    || tossUrl === null
  ) return null;
  return {
    ...definition,
    name,
    bank,
    accountNumber,
    holder,
    kakaoPayUrl,
    tossUrl
  };
}

function parseDefinedList<T>(
  value: unknown,
  parser: (item: unknown) => T | null,
  idOf: (item: T) => string
): T[] | null {
  if (!Array.isArray(value) || value.length !== editableContactIds.length) return null;
  const parsed = value.map(parser);
  if (parsed.some((item) => item === null)) return null;
  const items = parsed as T[];
  const ids = items.map(idOf);
  return editableContactIds.every((id, index) => ids[index] === id) ? items : null;
}

function parseStoryTimeline(value: unknown): EditableInvitationContent["storyTimeline"] | null {
  if (!Array.isArray(value) || value.length !== editableStoryIds.length) return null;
  const steps = value.map((item, index) => {
    if (!isRecord(item) || item.id !== editableStoryIds[index]) return null;
    const title = normalizedString(item.title, 50);
    const body = normalizedString(item.body, 400);
    return title === null || body === null ? null : { id: editableStoryIds[index], title, body };
  });
  return steps.some((step) => step === null)
    ? null
    : steps as EditableInvitationContent["storyTimeline"];
}

export function parseEditableInvitationContent(value: unknown): EditableInvitationContent | null {
  if (
    !isRecord(value)
    || !isRecord(value.familyContacts)
    || !isRecord(value.giftAccounts)
    || !isRecord(value.coupleIntroduction)
    || !isRecord(value.share)
  ) return null;

  const familyNotice = normalizedString(value.familyContacts.notice, 120);
  const giftNotice = normalizedString(value.giftAccounts.notice, 120);
  const contacts = parseDefinedList(value.familyContacts.contacts, parseContact, (contact) => contact.id);
  const accounts = parseDefinedList(value.giftAccounts.accounts, parseAccount, (account) => account.id);
  const bride = normalizedString(value.coupleIntroduction.bride, 400);
  const groom = normalizedString(value.coupleIntroduction.groom, 400);
  const together = normalizedString(value.coupleIntroduction.together, 400);
  const storyTimeline = parseStoryTimeline(value.storyTimeline);
  const shareTitle = normalizedString(value.share.title, 100);
  const shareDescription = normalizedString(value.share.description, 240);
  if (
    familyNotice === null
    || giftNotice === null
    || contacts === null
    || accounts === null
    || bride === null
    || groom === null
    || together === null
    || storyTimeline === null
    || shareTitle === null
    || shareDescription === null
  ) return null;

  return {
    familyContacts: { notice: familyNotice, contacts },
    giftAccounts: { notice: giftNotice, accounts },
    coupleIntroduction: { bride, groom, together },
    storyTimeline,
    share: { title: shareTitle, description: shareDescription }
  };
}

export function buildDefaultEditableInvitationContent(
  event: WeddingEvent,
  content: WeddingContent
): EditableInvitationContent {
  const bride = content.coupleProfiles.find((profile) => profile.role === "bride")?.message ?? "";
  const groom = content.coupleProfiles.find((profile) => profile.role === "groom")?.message ?? "";
  return {
    familyContacts: {
      notice: event.familyContacts.notice,
      contacts: event.familyContacts.contacts.map((contact) => ({ ...contact }))
    },
    giftAccounts: {
      notice: event.giftAccounts.notice,
      accounts: event.giftAccounts.accounts.map((account) => ({ ...account }))
    },
    coupleIntroduction: {
      bride,
      groom,
      together: content.coupleMessage
    },
    storyTimeline: content.storyTimeline.map(({ id, title, body }) => ({ id, title, body })),
    share: {
      title: "{names} 결혼식",
      description: `${event.startAt.slice(0, 10).replaceAll("-", ".")} · ${event.venue.name} ${event.venue.hall}`
    }
  };
}

export function editableInvitationContentPublishIssues(content: EditableInvitationContent): string[] {
  const issues: string[] = [];
  if (content.familyContacts.contacts.some(({ name, phone }) => !name || !phone)) issues.push("family_contacts");
  if (content.giftAccounts.accounts.some(({ name, bank, accountNumber, holder }) => (
    !name || !bank || !accountNumber || !holder
  ))) issues.push("gift_accounts");
  if (!content.coupleIntroduction.bride || !content.coupleIntroduction.groom || !content.coupleIntroduction.together) {
    issues.push("couple_introduction");
  }
  if (content.storyTimeline.some(({ title, body }) => !title || !body)) issues.push("story_timeline");
  if (!content.share.title || !content.share.description) issues.push("share");
  return issues;
}

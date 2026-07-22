import { sanitizeText } from "./validation";

export type RsvpSide = "groom" | "bride";
export type RsvpRecordSide = RsvpSide | "legacy";
export type RsvpAttendance = "yes" | "no" | "unsure";
export type RsvpMealStatus = "yes" | "no" | "unsure" | "not_applicable";

export type RsvpSubmission = {
  side: RsvpSide;
  guestName: string;
  phone: string;
  attendance: RsvpAttendance;
  partySize: number;
  childCount?: number;
  mealStatus: RsvpMealStatus;
  note: string;
  consentVersion: string;
};

export type RsvpRecord = Omit<RsvpSubmission, "side" | "phone" | "consentVersion"> & {
  id: string;
  side: RsvpRecordSide;
  phone: string | null;
  consentVersion: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type RsvpCreateResult = {
  response: RsvpRecord;
  credential: { rsvpId: string; editToken: string };
};

export type RsvpAdminSummary = {
  responseCount: number;
  attendingResponseCount: number;
  attendingPartySize: number;
  mealPartySize: number;
  declinedResponseCount: number;
  unsureResponseCount: number;
  unsurePartySize: number;
  deleteAt: string;
};

export type RsvpAdminResult = { summary: RsvpAdminSummary; responses: RsvpRecord[] };

export function normalizeRsvpPhone(value: string): string {
  return value.replace(/\D/g, "");
}

const sides = new Set<RsvpSide>(["groom", "bride"]);
const attendances = new Set<RsvpAttendance>(["yes", "no", "unsure"]);
const meals = new Set<RsvpMealStatus>(["yes", "no", "unsure", "not_applicable"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseRsvpSubmission(value: unknown, expectedConsentVersion: string): RsvpSubmission | null {
  if (!isRecord(value) || typeof value.phone !== "string") return null;

  const side = value.side as RsvpSide;
  const attendance = value.attendance as RsvpAttendance;
  const mealStatus = value.mealStatus as RsvpMealStatus;
  const guestName = sanitizeText(value.guestName, 30);
  const phone = normalizeRsvpPhone(value.phone);
  const note = sanitizeText(value.note ?? "", 160);
  const partySize = value.partySize;
  const childCount = "childCount" in value ? value.childCount : undefined;
  const consentVersion = value.consentVersion;

  if (!sides.has(side) || !attendances.has(attendance) || !meals.has(mealStatus)) return null;
  if (!guestName || phone.length < 8 || phone.length > 15) return null;
  if (typeof partySize !== "number" || !Number.isInteger(partySize)) return null;
  if (childCount !== undefined && (
    typeof childCount !== "number"
    || !Number.isInteger(childCount)
    || childCount < 0
    || childCount > partySize
  )) return null;
  if (consentVersion !== expectedConsentVersion) return null;

  const conditionalFieldsAreValid =
    (attendance === "yes" && partySize >= 1 && partySize <= 10 && mealStatus !== "not_applicable")
    || (attendance === "no" && partySize === 0 && mealStatus === "not_applicable")
    || (attendance === "unsure" && partySize >= 1 && partySize <= 10 && mealStatus === "unsure");
  if (!conditionalFieldsAreValid) return null;

  return {
    side,
    guestName,
    phone,
    attendance,
    partySize,
    ...(childCount === undefined ? {} : { childCount }),
    mealStatus,
    note,
    consentVersion
  };
}

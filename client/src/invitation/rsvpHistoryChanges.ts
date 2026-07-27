import type { RsvpHistoryEntry, RsvpRecord } from "@wedding-game/shared";

export type RsvpHistoryChange = {
  field: keyof RsvpRecord;
  label: string;
  before: string;
  after: string;
};

const comparableFields: Array<{ field: keyof RsvpRecord; label: string }> = [
  { field: "side", label: "대상" },
  { field: "guestName", label: "이름" },
  { field: "phone", label: "연락처" },
  { field: "attendance", label: "참석" },
  { field: "partySize", label: "인원" },
  { field: "childCount", label: "어린이" },
  { field: "mealStatus", label: "식사" },
  { field: "note", label: "전달사항" }
];

function maskPhone(value: string | null): string {
  if (!value) return "없음";
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `***-****-${digits.slice(-4)}` : "연락처 변경";
}

function formatHistoryValue(field: keyof RsvpRecord, value: RsvpRecord[keyof RsvpRecord]): string {
  if (field === "side") return value === "bride" ? "신부측" : value === "groom" ? "신랑측" : "구분 없음";
  if (field === "attendance") return value === "yes" ? "참석" : value === "no" ? "불참" : "미정";
  if (field === "mealStatus") {
    if (value === "yes") return "식사함";
    if (value === "no") return "식사 안 함";
    if (value === "not_applicable") return "해당 없음";
    return "미정";
  }
  if (field === "partySize" || field === "childCount") return `${typeof value === "number" ? value : 0}명`;
  if (field === "phone") return maskPhone(typeof value === "string" ? value : null);
  if (field === "note") return typeof value === "string" && value.trim() ? value : "없음";
  return typeof value === "string" && value.trim() ? value : "없음";
}

export function getRsvpHistoryChanges(
  entry: RsvpHistoryEntry,
  previous?: RsvpHistoryEntry
): RsvpHistoryChange[] {
  if (!previous) return [];

  return comparableFields.flatMap(({ field, label }) => {
    const beforeValue = previous.response[field];
    const afterValue = entry.response[field];
    if (beforeValue === afterValue) return [];
    return [{
      field,
      label,
      before: formatHistoryValue(field, beforeValue),
      after: formatHistoryValue(field, afterValue)
    }];
  });
}

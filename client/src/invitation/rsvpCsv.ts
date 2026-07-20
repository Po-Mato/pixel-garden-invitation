import type { RsvpAdminResult, RsvpRecord } from "@wedding-game/shared";

const formulaPrefix = /^[=+\-@]/;

function targetLabel(side: RsvpRecord["side"]): string {
  if (side === "groom") return "신랑측";
  if (side === "bride") return "신부측";
  return "기존";
}

function attendanceLabel(attendance: RsvpRecord["attendance"]): string {
  return attendance === "yes" ? "참석" : attendance === "no" ? "불참" : "미정";
}

function mealLabel(mealStatus: RsvpRecord["mealStatus"]): string {
  return mealStatus === "yes" ? "식사 예정" : mealStatus === "no" ? "식사 안 함" : mealStatus === "unsure" ? "미정" : "해당 없음";
}

function protectFormula(value: string): string {
  return formulaPrefix.test(value) ? `'${value}` : value;
}

function quoteCell(value: string | number): string {
  const cell = protectFormula(String(value));
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

function csvRow(values: Array<string | number>): string {
  return values.map(quoteCell).join(",");
}

function responseRow(response: RsvpRecord): Array<string | number> {
  return [
    targetLabel(response.side),
    response.guestName,
    response.phone ?? "",
    attendanceLabel(response.attendance),
    response.partySize,
    mealLabel(response.mealStatus),
    response.note,
    response.createdAt,
    response.updatedAt
  ];
}

export function buildRsvpCsv(result: RsvpAdminResult): string {
  const header = ["대상", "이름", "연락처", "참석 여부", "인원", "식사 여부", "전달사항", "등록 시각", "수정 시각"];
  return `\uFEFF${[header, ...result.responses.map(responseRow)].map(csvRow).join("\r\n")}\r\n`;
}

export function downloadRsvpCsv(result: RsvpAdminResult): void {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
  const blob = new Blob([buildRsvpCsv(result)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wedding-rsvp.csv";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

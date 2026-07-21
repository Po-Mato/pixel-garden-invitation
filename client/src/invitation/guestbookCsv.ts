import type { GuestbookAdminResult, GuestbookOwnedMessage } from "@wedding-game/shared";

const formulaPrefix = /^[=+\-@]/;

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

function messageRow(message: GuestbookOwnedMessage): Array<string | number> {
  return [
    message.nickname,
    message.message,
    message.isHidden ? "비공개" : "공개",
    message.createdAt,
    message.updatedAt
  ];
}

export function buildGuestbookCsv(result: GuestbookAdminResult): string {
  const header = ["작성자", "메시지", "공개 상태", "등록 시각", "수정 시각"];
  return `\uFEFF${[header, ...result.messages.map(messageRow)].map(csvRow).join("\r\n")}\r\n`;
}

export function downloadGuestbookCsv(result: GuestbookAdminResult): void {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
  const blob = new Blob([buildGuestbookCsv(result)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wedding-guestbook.csv";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

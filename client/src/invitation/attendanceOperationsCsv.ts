import Papa from "papaparse";
import type { AttendanceOperationEntry, AttendanceOperations } from "./attendanceOperations";

function sideLabel(side: string): string {
  return side === "bride" ? "신부측" : side === "groom" ? "신랑측" : "기존";
}

function attendanceLabel(entry: AttendanceOperationEntry): string {
  if (!entry.response) return "미응답";
  return entry.response.attendance === "yes" ? "참석" : entry.response.attendance === "no" ? "불참" : "미정";
}

function stageLabel(entry: AttendanceOperationEntry): string {
  const labels = {
    unsent: "미발송",
    unopened: "미열람",
    unresponded: "미응답",
    contacted: "연락 완료",
    unsure: "참석 미정",
    responded: "응답 완료",
    inactive: "링크 중지"
  } as const;
  return labels[entry.stage];
}

export function buildAttendanceOperationsCsv(operations: AttendanceOperations): string {
  const rows = operations.entries.map((entry) => {
    const source = entry.link ?? entry.response;
    const response = entry.response;
    const children = response?.attendance === "yes" ? response.childCount ?? 0 : 0;
    return {
      대상: sideLabel(source?.side ?? "legacy"),
      관계그룹: entry.link?.groupLabel ?? "",
      이름: source?.guestName ?? "",
      연락처: response?.phone ?? "",
      진행상태: stageLabel(entry),
      발송횟수: entry.link?.sendCount ?? 0,
      열람횟수: entry.link?.openCount ?? 0,
      참석여부: attendanceLabel(entry),
      참석인원: response?.attendance === "no" ? 0 : response?.partySize ?? 0,
      성인인원: response?.attendance === "yes" ? response.partySize - children : 0,
      어린이인원: children,
      식사인원: response?.attendance === "yes" && response.mealStatus === "yes" ? response.partySize : 0,
      전달사항: response?.note ?? "",
      후속연락완료: entry.link?.followUpCompletedAt ?? "",
      최근발송: entry.link?.lastSentAt ?? "",
      최근열람: entry.link?.lastOpenedAt ?? "",
      최근수정: response?.updatedAt ?? entry.link?.updatedAt ?? "",
      확인필요: entry.issues.join(" / ")
    };
  });
  return `\uFEFF${Papa.unparse(rows, { newline: "\r\n", escapeFormulae: true })}\r\n`;
}

export function downloadAttendanceOperationsCsv(operations: AttendanceOperations): void {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(new Blob([buildAttendanceOperationsCsv(operations)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wedding-attendance-operations.csv";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

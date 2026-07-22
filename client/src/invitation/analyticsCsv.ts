import type { InvitationAnalyticsAdminResult } from "@wedding-game/shared";

export function buildInvitationAnalyticsCsv(result: InvitationAnalyticsAdminResult): string {
  const rows = [
    ["날짜", "방문", "재방문", "게임 진입", "간편 초대장 진입", "참석 답변", "방명록", "공유", "오류"],
    ...result.daily.map((day) => [
      day.date,
      day.visits,
      day.returningVisits,
      day.gameEntries,
      day.simpleEntries,
      day.rsvpResponses,
      day.guestbookMessages,
      day.shares,
      day.clientErrors
    ])
  ];
  return rows.map((row) => row.join(",")).join("\r\n");
}

export function downloadInvitationAnalyticsCsv(result: InvitationAnalyticsAdminResult): void {
  const blob = new Blob(["\uFEFF", buildInvitationAnalyticsCsv(result)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `invitation-analytics-${result.range.from}-${result.range.to}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

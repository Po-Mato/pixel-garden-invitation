import Papa from "papaparse";
import {
  parseInvitationInviteLinkInput,
  type InvitationInviteLinkInput,
  type InvitationInviteLinkRecord
} from "@wedding-game/shared";
import { buildInvitationInviteUrl } from "./inviteLinkQr";
import { parseInviteLinkSide } from "./inviteLinkBulkInput";

type CsvParseResult = { links: InvitationInviteLinkInput[]; error: string };

const headerNames = {
  name: ["이름", "하객이름", "name", "guestname"],
  side: ["측", "구분", "신랑신부측", "side"],
  group: ["그룹", "관계", "관계그룹", "group", "grouplabel"]
};

function header(value: unknown): string {
  return typeof value === "string" ? value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_-]+/g, "") : "";
}

function headerIndex(row: unknown[], names: string[]): number {
  return row.findIndex((value) => names.includes(header(value)));
}

export function parseInviteGuestCsv(value: string): CsvParseResult {
  const parsed = Papa.parse<string[]>(value, { skipEmptyLines: "greedy" });
  if (parsed.errors.length > 0) {
    const row = parsed.errors[0].row === undefined ? "" : ` ${parsed.errors[0].row + 1}행`;
    return { links: [], error: `CSV${row} 형식을 확인해 주세요.` };
  }
  if (parsed.data.length === 0) return { links: [], error: "CSV에 하객 정보가 없습니다." };

  const first = parsed.data[0] ?? [];
  const indexes = {
    name: headerIndex(first, headerNames.name),
    side: headerIndex(first, headerNames.side),
    group: headerIndex(first, headerNames.group)
  };
  const hasHeader = indexes.name >= 0 && indexes.side >= 0;
  const rows = hasHeader ? parsed.data.slice(1) : parsed.data;
  if (rows.length > 100) return { links: [], error: "한 번에 최대 100명까지 가져올 수 있습니다." };

  const links: InvitationInviteLinkInput[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const guestName = String(row[hasHeader ? indexes.name : 0] ?? "");
    const side = parseInviteLinkSide(String(row[hasHeader ? indexes.side : 1] ?? ""));
    const groupLabel = String(row[hasHeader && indexes.group >= 0 ? indexes.group : 2] ?? "");
    const link = parseInvitationInviteLinkInput({ guestName, side, groupLabel });
    if (!link) return { links: [], error: `${index + 1 + (hasHeader ? 1 : 0)}번째 데이터 행의 이름·측·그룹을 확인해 주세요.` };
    links.push(link);
  }
  return links.length > 0 ? { links, error: "" } : { links: [], error: "CSV에 하객 정보가 없습니다." };
}

function channelLabel(link: InvitationInviteLinkRecord): string {
  if (link.deliveryChannel === "kakao") return "카카오톡";
  if (link.deliveryChannel === "sms") return "문자";
  if (link.deliveryChannel === "in_person") return "직접 전달";
  if (link.deliveryChannel === "other") return "기타";
  return "";
}

export function buildInviteGuestCsv(
  links: InvitationInviteLinkRecord[],
  tokens: Record<string, string>
): string {
  const rows = links.map((link) => ({
    이름: link.guestName,
    측: link.side === "bride" ? "신부측" : "신랑측",
    그룹: link.groupLabel,
    발송상태: link.sendCount > 0 ? (link.sendCount > 1 ? "재발송" : "발송 완료") : "미발송",
    발송경로: channelLabel(link),
    발송횟수: link.sendCount,
    최근발송: link.lastSentAt ?? "",
    열람횟수: link.openCount,
    최근열람: link.lastOpenedAt ?? "",
    RSVP: link.respondedAt ? "완료" : "대기",
    관리메모: link.deliveryNote,
    개인초대링크: tokens[link.id] ? buildInvitationInviteUrl(tokens[link.id]) : ""
  }));
  return `\uFEFF${Papa.unparse(rows, { escapeFormulae: true, newline: "\r\n" })}`;
}

export function downloadInviteGuestCsv(value: string, fileName = "wedding-invite-guests.csv"): void {
  const url = URL.createObjectURL(new Blob([value], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

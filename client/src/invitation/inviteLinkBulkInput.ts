import type { InvitationInviteLinkInput } from "@wedding-game/shared";

export function parseInviteLinkSide(value: string): InvitationInviteLinkInput["side"] | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  if (["신부", "신부측", "bride"].includes(normalized)) return "bride";
  if (["신랑", "신랑측", "groom"].includes(normalized)) return "groom";
  return null;
}

export function parseInviteLinkBulkInput(value: string): { links: InvitationInviteLinkInput[]; error: string } {
  const rows = value.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  if (rows.length === 0) return { links: [], error: "입력할 하객이 없습니다." };
  if (rows.length > 100) return { links: [], error: "한 번에 최대 100명까지 생성할 수 있습니다." };
  const links: InvitationInviteLinkInput[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const columns = rows[index].split(/\t|,/).map((column) => column.trim());
    const guestName = columns[0] ?? "";
    const guestSide = parseInviteLinkSide(columns[1] ?? "");
    const groupLabel = columns.slice(2).join(" ").replace(/\s+/g, " ");
    if (!guestName || guestName.length > 40 || !guestSide || groupLabel.length > 40) {
      return { links: [], error: `${index + 1}번째 줄의 이름·측·그룹 형식을 확인해 주세요.` };
    }
    links.push({ guestName, side: guestSide, groupLabel });
  }
  return { links, error: "" };
}

export function formatInviteLinkBulkInput(links: InvitationInviteLinkInput[]): string {
  return links.map((link) => [
    link.guestName,
    link.side === "bride" ? "신부측" : "신랑측",
    link.groupLabel
  ].join("\t")).join("\n");
}

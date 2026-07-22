import type {
  InvitationInviteLinkAdminResult,
  InvitationInviteLinkRecord,
  RsvpAdminResult,
  RsvpRecord,
  RsvpSide
} from "@wedding-game/shared";

export type AttendanceOperationStage =
  | "unsent"
  | "unopened"
  | "unresponded"
  | "contacted"
  | "unsure"
  | "responded"
  | "inactive";

export type AttendanceOperationEntry = {
  key: string;
  link: InvitationInviteLinkRecord | null;
  response: RsvpRecord | null;
  stage: AttendanceOperationStage;
  issues: string[];
};

export type AttendanceGroupSummary = {
  key: string;
  side: RsvpSide;
  groupLabel: string;
  invited: number;
  delivered: number;
  opened: number;
  responded: number;
  attendingPartySize: number;
  adultPartySize: number;
  childPartySize: number;
  mealPartySize: number;
  followUpNeeded: number;
};

export type AttendanceOperations = {
  summary: {
    invited: number;
    delivered: number;
    opened: number;
    responded: number;
    attendingPartySize: number;
    adultPartySize: number;
    childPartySize: number;
    mealPartySize: number;
    unsurePartySize: number;
    followUpNeeded: number;
    unsent: number;
    unopened: number;
    unresponded: number;
    unmatchedResponses: number;
  };
  entries: AttendanceOperationEntry[];
  groups: AttendanceGroupSummary[];
  issues: string[];
};

function identity(side: string, guestName: string): string {
  return `${side}:${guestName.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s/g, "")}`;
}

function stage(link: InvitationInviteLinkRecord, response: RsvpRecord | null): AttendanceOperationStage {
  if (!link.active) return "inactive";
  if (response?.attendance === "unsure") return "unsure";
  if (response) return "responded";
  if (link.followUpCompletedAt) return "contacted";
  if (link.sendCount === 0) return "unsent";
  if (link.openCount === 0) return "unopened";
  return "unresponded";
}

function childCount(response: RsvpRecord | null): number {
  return response?.attendance === "yes" ? response.childCount ?? 0 : 0;
}

function duplicateKeys(values: Array<{ side: string; guestName: string }>): Set<string> {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const key = identity(value.side, value.guestName);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

export function buildAttendanceOperations(
  inviteResult: InvitationInviteLinkAdminResult,
  rsvpResult: RsvpAdminResult
): AttendanceOperations {
  const responseById = new Map(rsvpResult.responses.map((response) => [response.id, response]));
  const linkedResponseIds = new Set<string>();
  const duplicateInviteKeys = duplicateKeys(inviteResult.links);
  const duplicateResponseKeys = duplicateKeys(rsvpResult.responses);
  const issueSet = new Set<string>();

  const entries: AttendanceOperationEntry[] = inviteResult.links.map((link) => {
    const response = link.rsvpId ? responseById.get(link.rsvpId) ?? null : null;
    if (response) linkedResponseIds.add(response.id);
    const issues: string[] = [];
    const linkIdentity = identity(link.side, link.guestName);
    if (duplicateInviteKeys.has(linkIdentity)) issues.push("동일한 이름·대상의 초대가 여러 건입니다.");
    if (response && duplicateResponseKeys.has(identity(response.side, response.guestName))) {
      issues.push("동일한 이름·대상의 RSVP가 여러 건입니다.");
    }
    if (response && (response.side !== link.side || identity(response.side, response.guestName) !== linkIdentity)) {
      issues.push("초대 명단과 RSVP의 이름 또는 대상이 다릅니다.");
    }
    if (link.rsvpId && !response) issues.push("연결된 RSVP가 삭제되었거나 존재하지 않습니다.");
    issues.forEach((issue) => issueSet.add(`${link.guestName}: ${issue}`));
    return { key: link.id, link, response, stage: stage(link, response), issues };
  });

  rsvpResult.responses.forEach((response) => {
    if (linkedResponseIds.has(response.id)) return;
    const issues = ["개인 초대 링크와 연결되지 않은 RSVP입니다."];
    if (duplicateResponseKeys.has(identity(response.side, response.guestName))) {
      issues.push("동일한 이름·대상의 RSVP가 여러 건입니다.");
    }
    issues.forEach((issue) => issueSet.add(`${response.guestName}: ${issue}`));
    entries.push({ key: `rsvp:${response.id}`, link: null, response, stage: response.attendance === "unsure" ? "unsure" : "responded", issues });
  });

  const groupMap = new Map<string, AttendanceGroupSummary>();
  inviteResult.links.forEach((link) => {
    const key = `${link.side}:${link.groupLabel || "미분류"}`;
    const response = link.rsvpId ? responseById.get(link.rsvpId) ?? null : null;
    const children = childCount(response);
    const group = groupMap.get(key) ?? {
      key,
      side: link.side,
      groupLabel: link.groupLabel || "미분류",
      invited: 0,
      delivered: 0,
      opened: 0,
      responded: 0,
      attendingPartySize: 0,
      adultPartySize: 0,
      childPartySize: 0,
      mealPartySize: 0,
      followUpNeeded: 0
    };
    group.invited += 1;
    if (link.sendCount > 0) group.delivered += 1;
    if (link.openCount > 0) group.opened += 1;
    if (response) group.responded += 1;
    if (response?.attendance === "yes") {
      group.attendingPartySize += response.partySize;
      group.childPartySize += children;
      group.adultPartySize += response.partySize - children;
      if (response.mealStatus === "yes") group.mealPartySize += response.partySize;
    }
    if (link.active && !response && !link.followUpCompletedAt) group.followUpNeeded += 1;
    groupMap.set(key, group);
  });

  const linkedResponses = entries.flatMap((entry) => entry.response ? [entry.response] : []);
  const attendingResponses = linkedResponses.filter(({ attendance }) => attendance === "yes");
  const totalChildren = attendingResponses.reduce((total, response) => total + (response.childCount ?? 0), 0);
  const unmatchedResponses = rsvpResult.responses.filter(({ id }) => !linkedResponseIds.has(id)).length;

  return {
    summary: {
      invited: inviteResult.links.length,
      delivered: inviteResult.links.filter(({ sendCount }) => sendCount > 0).length,
      opened: inviteResult.links.filter(({ openCount }) => openCount > 0).length,
      responded: linkedResponseIds.size,
      attendingPartySize: attendingResponses.reduce((total, response) => total + response.partySize, 0),
      adultPartySize: attendingResponses.reduce((total, response) => total + response.partySize, 0) - totalChildren,
      childPartySize: totalChildren,
      mealPartySize: attendingResponses
        .filter(({ mealStatus }) => mealStatus === "yes")
        .reduce((total, response) => total + response.partySize, 0),
      unsurePartySize: linkedResponses
        .filter(({ attendance }) => attendance === "unsure")
        .reduce((total, response) => total + response.partySize, 0),
      followUpNeeded: inviteResult.links.filter((link) => (
        link.active && !link.followUpCompletedAt && (!link.rsvpId || !responseById.has(link.rsvpId))
      )).length,
      unsent: inviteResult.links.filter(({ active, sendCount }) => active && sendCount === 0).length,
      unopened: inviteResult.links.filter(({ active, sendCount, openCount }) => active && sendCount > 0 && openCount === 0).length,
      unresponded: inviteResult.links.filter((link) => (
        link.active && link.openCount > 0 && (!link.rsvpId || !responseById.has(link.rsvpId))
      )).length,
      unmatchedResponses
    },
    entries,
    groups: [...groupMap.values()].sort((left, right) => (
      left.side.localeCompare(right.side) || left.groupLabel.localeCompare(right.groupLabel, "ko-KR")
    )),
    issues: [...issueSet]
  };
}

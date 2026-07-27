import type { WeddingEvent } from "@wedding-game/shared";
import { getWeddingDayStatus } from "./weddingDay";

export type InvitationPriorityActionId = "rsvp" | "schedule" | "directions" | "guestbook" | "gallery";

export type InvitationPriorityAction = {
  id: InvitationPriorityActionId;
  label: string;
  detail: string;
};

const action = (
  id: InvitationPriorityActionId,
  label: string,
  detail: string
): InvitationPriorityAction => ({ id, label, detail });

export function invitationPriorityActions(
  event: WeddingEvent,
  hasSavedRsvp: boolean,
  now = new Date()
): readonly InvitationPriorityAction[] {
  const startAt = Date.parse(event.startAt);
  const endAt = Date.parse(event.endAt);
  const responseDeadline = Date.parse(event.rsvp.responseDeadline);
  const current = now.getTime();
  const weddingDayStatus = getWeddingDayStatus(event, now);

  if (Number.isFinite(endAt) && current >= endAt) {
    return [
      action("guestbook", "축하 메시지", "두 사람에게 마음 남기기"),
      action("gallery", "사진 다시 보기", "두 사람의 장면 감상하기"),
      action("directions", "예식장 정보", "장소와 연락처 확인하기")
    ];
  }

  if (weddingDayStatus?.phase === "before" || weddingDayStatus?.phase === "in-progress") {
    return [
      action("directions", "오시는 길", "지도, 교통, 주차 바로 확인"),
      action("schedule", "예식 일정", "시간과 홀 위치 다시 확인"),
      action("rsvp", hasSavedRsvp ? "답변 확인" : "참석 답변", hasSavedRsvp ? "저장한 답변 확인·수정" : "참석 여부 알려주기")
    ];
  }

  if (!hasSavedRsvp && Number.isFinite(responseDeadline) && current <= responseDeadline) {
    return [
      action("rsvp", "참석 답변", "마감 전에 참석 여부 알려주기"),
      action("schedule", "캘린더 저장", "예식 일정을 휴대폰에 저장"),
      action("directions", "오시는 길", "교통과 주차 미리 확인")
    ];
  }

  if (hasSavedRsvp && (!Number.isFinite(startAt) || current < startAt)) {
    return [
      action("schedule", "캘린더 저장", "예식 일정을 휴대폰에 저장"),
      action("directions", "오시는 길", "교통과 주차 미리 확인"),
      action("rsvp", "답변 수정", "같은 기기에서 답변 확인·수정")
    ];
  }

  return [
    action("directions", "오시는 길", "교통과 주차 미리 확인"),
    action("schedule", "예식 일정", "시간과 장소 다시 확인"),
    action("rsvp", "답변 확인", "저장한 참석 답변 확인")
  ];
}

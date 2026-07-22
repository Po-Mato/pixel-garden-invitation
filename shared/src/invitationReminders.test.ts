import { describe, expect, it } from "vitest";
import { parseInvitationReminderDeliveryInput } from "./invitationReminders";

describe("invitation reminder input", () => {
  it("중복 대상을 제거하고 메모를 정규화한다", () => {
    expect(parseInvitationReminderDeliveryInput({
      linkIds: ["invite_abc-123", "invite_abc-123"],
      stage: "d14",
      channel: "kakao",
      note: "  대학\n친구 재안내  "
    })).toEqual({
      linkIds: ["invite_abc-123"],
      stage: "d14",
      channel: "kakao",
      note: "대학 친구 재안내"
    });
  });

  it("잘못된 단계, 채널, 대상 ID와 긴 메모를 거부한다", () => {
    expect(parseInvitationReminderDeliveryInput({ linkIds: ["bad"], stage: "d14", channel: "kakao", note: "" })).toBeNull();
    expect(parseInvitationReminderDeliveryInput({ linkIds: ["invite_abc"], stage: "week", channel: "kakao", note: "" })).toBeNull();
    expect(parseInvitationReminderDeliveryInput({ linkIds: ["invite_abc"], stage: "d7", channel: "email", note: "" })).toBeNull();
    expect(parseInvitationReminderDeliveryInput({ linkIds: ["invite_abc"], stage: "d7", channel: "sms", note: "가".repeat(201) })).toBeNull();
  });
});

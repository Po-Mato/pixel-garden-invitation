import { describe, expect, it } from "vitest";
import { invitationContent } from "@wedding-game/shared";
import { buildReminderMessage } from "./reminderMessages";

describe("reminder messages", () => {
  it("RSVP 재안내에 이름, 마감일, 개인 링크를 포함한다", () => {
    const message = buildReminderMessage("d14", "김하객", "https://example.com/?invite=token", invitationContent.event);
    expect(message.copyText).toContain("김하객님");
    expect(message.copyText).toContain("4월 24일");
    expect(message.copyText).toContain("https://example.com/?invite=token");
  });

  it("하루 전 안내에 예식 시간과 장소를 포함한다", () => {
    const message = buildReminderMessage("d1", "이하객", "https://example.com/invite", invitationContent.event);
    expect(message.text).toContain("내일");
    expect(message.text).toContain("오후 5시 10분");
    expect(message.text).toContain("MJ컨벤션 5층 파티오볼룸");
  });
});

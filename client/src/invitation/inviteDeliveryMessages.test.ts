import { describe, expect, it } from "vitest";
import { buildInviteDeliveryMessage } from "./inviteDeliveryMessages";

describe("invite delivery messages", () => {
  it.each(["formal", "warm", "brief"] as const)("builds the %s template from common wedding data", (template) => {
    const message = buildInviteDeliveryMessage(template, "김하객", "https://invite.test/personal");
    expect(message.title).toContain("김하객");
    expect(message.text).toContain("이건희 · 이승재");
    expect(message.text).toContain("2027년 5월 1일");
    expect(message.text).toContain("MJ컨벤션");
    expect(message.copyText).toContain("https://invite.test/personal");
  });
});

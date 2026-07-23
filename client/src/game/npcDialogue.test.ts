import { describe, expect, it } from "vitest";
import { resolveNpcDialogue } from "./npcDialogue";

describe("resolveNpcDialogue", () => {
  it("changes the bridal-room greeting after the first bride stamp", () => {
    const first = resolveNpcDialogue({
      npcId: "bride",
      zoneId: "bridal-room",
      nickname: "민지",
      completedCheckpointIds: []
    });
    const returning = resolveNpcDialogue({
      npcId: "bride",
      zoneId: "bridal-room",
      nickname: "민지",
      completedCheckpointIds: ["bride"]
    });

    expect(first.message).toContain("와주셨군요");
    expect(returning.message).toContain("다시 인사");
    expect(first.tone).toBe("welcome");
    expect(returning.tone).toBe("thanks");
  });

  it("uses a distinct groom message after the guestbook checkpoint", () => {
    expect(resolveNpcDialogue({
      npcId: "groom",
      zoneId: "ceremony-hall",
      nickname: "수현",
      completedCheckpointIds: ["guestbook"]
    }).message).toContain("축하 메시지");
  });

  it("celebrates a fully completed journey", () => {
    const dialogue = resolveNpcDialogue({
      npcId: "bride",
      zoneId: "ceremony-hall",
      nickname: "지민",
      completedCheckpointIds: ["directions", "gallery", "bride", "ceremony", "guestbook"]
    });

    expect(dialogue.tone).toBe("celebration");
    expect(dialogue.message).toContain("모든 순간");
  });
});

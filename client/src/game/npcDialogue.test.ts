import { describe, expect, it } from "vitest";
import { resolveNpcDialogue, resolveNpcDialogueChoice } from "./npcDialogue";

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
    expect(first.personalityLabel).toBe("다정한 공감형");
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

  it("changes guidance with the live wedding phase", () => {
    expect(resolveNpcDialogue({
      npcId: "groom",
      zoneId: "ceremony-hall",
      nickname: "지민",
      completedCheckpointIds: [],
      weddingPhase: "ceremony"
    }).message).toContain("예식이 진행 중");
    expect(resolveNpcDialogue({
      npcId: "bride",
      zoneId: "ceremony-hall",
      nickname: "지민",
      completedCheckpointIds: [],
      weddingPhase: "reception"
    }).tone).toBe("celebration");
  });

  it("대화 선택지를 하객 리액션과 NPC 답변으로 연결한다", () => {
    const initial = resolveNpcDialogue({
      npcId: "bride",
      zoneId: "bridal-room",
      nickname: "민지",
      completedCheckpointIds: []
    });
    const result = resolveNpcDialogueChoice(initial, "celebrate", "민지");

    expect(result.reaction).toBe("celebrate");
    expect(result.dialogue.responded).toBe(true);
    expect(result.dialogue.message).toContain("더 환하게");
    expect(result.dialogue.crowdMessage).toContain("박수와 축하");
  });

  it("이전 답변을 기억하고 관계별 후속 대화를 연다", () => {
    const returning = resolveNpcDialogue({
      npcId: "bride",
      zoneId: "bridal-room",
      nickname: "민지",
      completedCheckpointIds: [],
      conversation: { interactionCount: 1, lastChoiceId: "heart", relationshipLabel: "반가운 재회" }
    });
    expect(returning.message).toContain("따뜻한 마음");
    expect(returning.relationshipLabel).toBe("반가운 재회");

    const ending = resolveNpcDialogue({
      npcId: "groom",
      zoneId: "ceremony-hall",
      nickname: "민지",
      completedCheckpointIds: [],
      conversation: { interactionCount: 3, lastChoiceId: "celebrate", relationshipLabel: "소중한 인연" }
    });
    expect(ending.message).toContain("힘차게 축하");
    expect(ending.relationshipLabel).toBe("소중한 인연");
  });
});

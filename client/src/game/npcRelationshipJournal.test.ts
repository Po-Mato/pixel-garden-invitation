import { describe, expect, it } from "vitest";
import { buildNpcRelationshipJournal } from "./npcRelationshipJournal";

describe("npcRelationshipJournal", () => {
  it("인연 단계와 선택 기록에 맞는 대화만 해금한다", () => {
    const journal = buildNpcRelationshipJournal({
      version: 1,
      groupCelebrationSeen: true,
      records: {
        bride: {
          interactionCount: 4,
          affinityPoints: 7,
          choiceIds: ["greet", "heart", "heart", "celebrate"],
          unlockedRewardIds: ["bride-gratitude-letter"],
          lastInteractedAt: "2026-07-30T00:00:00.000Z"
        }
      }
    }, "bride");
    expect(journal.affinityLevel).toBe(3);
    expect(journal.rewardLabel).toBe("신부의 감사 편지");
    expect(journal.entries.every(({ unlocked }) => unlocked)).toBe(true);
    expect(journal.recentChoiceLabels).toEqual(["반갑게 인사", "따뜻한 마음", "따뜻한 마음", "힘찬 축하"]);
  });
});

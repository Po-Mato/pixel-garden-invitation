import { describe, expect, it } from "vitest";
import { buildNpcRelationshipJournal, buildNpcRelationshipStampBook } from "./npcRelationshipJournal";

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
          lastInteractedAt: "2026-07-30T00:00:00.000Z",
          encounters: [
            { zoneId: "bridal-room", choiceId: "heart", interactedAt: "2026-07-30T00:00:00.000Z" },
            { zoneId: "ceremony-hall", choiceId: "celebrate", interactedAt: "2026-07-30T00:10:00.000Z" }
          ]
        }
      }
    }, "bride");
    expect(journal.affinityLevel).toBe(3);
    expect(journal.rewardLabel).toBe("신부의 감사 편지");
    expect(journal.entries.every(({ unlocked }) => unlocked)).toBe(true);
    expect(journal.recentChoiceLabels).toEqual(["반갑게 인사", "따뜻한 마음", "따뜻한 마음", "힘찬 축하"]);
    expect(journal.locations.map(({ label }) => label)).toEqual(["신부 대기실", "파티오볼룸"]);
    expect(journal.locations.map(({ stampCode }) => stampCode)).toEqual(["BRIDE", "PATIO"]);
    expect(journal.rewardActionLabel).toBe("감사 편지 펼치기");
    expect(journal.keepsakes).toEqual([expect.objectContaining({ label: "꽃잎 감사 편지", unlocked: true, illustration: "flowers" })]);
  });

  it("두 사람의 세 장소 도장을 모두 모으면 숨은 편지를 해금한다", () => {
    const stampBook = buildNpcRelationshipStampBook({
      version: 1,
      groupCelebrationSeen: false,
      records: {
        bride: {
          interactionCount: 2,
          affinityPoints: 2,
          choiceIds: ["greet", "heart"],
          unlockedRewardIds: [],
          lastInteractedAt: "2026-07-30T00:00:00.000Z",
          encounters: [
            { zoneId: "bridal-room", choiceId: "greet", interactedAt: "2026-07-30T00:00:00.000Z" },
            { zoneId: "ceremony-hall", choiceId: "heart", interactedAt: "2026-07-30T00:10:00.000Z" }
          ]
        },
        groom: {
          interactionCount: 1,
          affinityPoints: 1,
          choiceIds: ["celebrate"],
          unlockedRewardIds: [],
          lastInteractedAt: "2026-07-30T00:15:00.000Z",
          encounters: [{ zoneId: "ceremony-hall", choiceId: "celebrate", interactedAt: "2026-07-30T00:15:00.000Z" }]
        }
      }
    });
    expect(stampBook).toEqual(expect.objectContaining({ completedCount: 3, totalCount: 3, complete: true, rewardLabel: "두 사람의 약속 봉인" }));
    expect(stampBook.stamps.every(({ unlocked }) => unlocked)).toBe(true);
  });
});

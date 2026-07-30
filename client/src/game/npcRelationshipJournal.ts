import type { NpcDialogueChoiceId, NpcId } from "./npcDialogue";
import { npcConversationSnapshot, type NpcDialogueMemory } from "./npcDialogueMemory";

export type NpcRelationshipJournalEntry = {
  id: string;
  title: string;
  message: string;
  unlocked: boolean;
};

export type NpcRelationshipJournal = {
  npcId: NpcId;
  affinityLevel: 0 | 1 | 2 | 3;
  relationshipLabel: string;
  interactionCount: number;
  recentChoiceLabels: string[];
  rewardLabel: string | null;
  entries: NpcRelationshipJournalEntry[];
};

const choiceLabels: Record<NpcDialogueChoiceId, string> = {
  greet: "반갑게 인사",
  heart: "따뜻한 마음",
  celebrate: "힘찬 축하"
};

export function buildNpcRelationshipJournal(memory: NpcDialogueMemory, npcId: NpcId): NpcRelationshipJournal {
  const snapshot = npcConversationSnapshot(memory, npcId);
  const record = memory.records[npcId];
  const isBride = npcId === "bride";
  const lastChoice = record?.choiceIds.at(-1) ?? null;
  const rememberedMessage = lastChoice === "heart"
    ? "아까 전해주신 따뜻한 마음, 아직도 마음에 남아 있어요."
    : lastChoice === "celebrate"
      ? "아까 보내주신 힘찬 축하 덕분에 오늘이 더 밝아졌어요."
      : "다시 만나 인사를 나누니 더 반갑고 든든해요.";
  return {
    npcId,
    affinityLevel: snapshot.affinityLevel,
    relationshipLabel: snapshot.relationshipLabel,
    interactionCount: snapshot.interactionCount,
    recentChoiceLabels: (record?.choiceIds ?? []).slice(-4).map((choice) => choiceLabels[choice]),
    rewardLabel: snapshot.specialRewardLabel,
    entries: [
      {
        id: "first-greeting",
        title: "첫 인사",
        message: isBride ? "오늘 이 순간을 함께해 주셔서 정말 든든해요." : "오늘 편하게 즐기시고 두 사람의 시작을 축하해 주세요.",
        unlocked: snapshot.interactionCount >= 1
      },
      {
        id: "remembered-choice",
        title: "기억한 마음",
        message: rememberedMessage,
        unlocked: snapshot.interactionCount >= 2
      },
      {
        id: "close-friend",
        title: "소중한 인연 전용 대화",
        message: isBride
          ? "이제 눈빛만 봐도 어떤 마음인지 알 것 같아요. 오늘의 설렘을 오래 함께 기억해 주세요."
          : "여러 번 나눈 인사가 든든한 응원이 됐어요. 연회장에서도 꼭 다시 만나요.",
        unlocked: snapshot.affinityLevel >= 3
      },
      {
        id: "group-finale",
        title: "인연 피날레",
        message: "두 사람과 주변 하객이 함께 축하하며 오늘의 인연을 환하게 완성했어요.",
        unlocked: memory.groupCelebrationSeen
      }
    ]
  };
}

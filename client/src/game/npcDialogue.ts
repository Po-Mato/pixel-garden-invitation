import type { GuestReaction, WorldZoneId } from "@wedding-game/shared";
import { journeyCheckpointIds, type JourneyCheckpointId } from "./journeyProgress";
import type { WeddingJourneyTiming } from "./weddingJourneyTiming";
import type { NpcConversationSnapshot } from "./npcDialogueMemory";

export type NpcId = "groom" | "bride";

export type NpcDialogue = {
  npcId: NpcId;
  message: string;
  tone: "welcome" | "thanks" | "celebration";
  personalityLabel?: string;
  relationshipLabel?: NpcConversationSnapshot["relationshipLabel"];
  affinityLevel?: NpcConversationSnapshot["affinityLevel"];
  specialRewardLabel?: string | null;
  rewardUnlocked?: boolean;
  crowdMessage?: string;
  responded?: boolean;
};

export type NpcDialogueChoiceId = "greet" | "heart" | "celebrate";

export type NpcDialogueChoice = {
  id: NpcDialogueChoiceId;
  label: string;
  reaction: GuestReaction;
};

export const npcDialogueChoices: readonly NpcDialogueChoice[] = [
  { id: "greet", label: "반갑게 인사", reaction: "wave" },
  { id: "heart", label: "마음 전하기", reaction: "heart" },
  { id: "celebrate", label: "축하 전하기", reaction: "celebrate" }
];

const npcPersonalityLabels: Record<NpcId, string> = {
  bride: "다정한 공감형",
  groom: "차분한 안내형"
};

export function resolveNpcDialogueChoice(
  dialogue: NpcDialogue,
  choiceId: NpcDialogueChoiceId,
  nickname: string
): { dialogue: NpcDialogue; reaction: GuestReaction; status: string } {
  const choice = npcDialogueChoices.find(({ id }) => id === choiceId) ?? npcDialogueChoices[0];
  const message = choice.id === "greet"
    ? dialogue.npcId === "bride"
      ? `${nickname}님, 이렇게 가까이서 인사 나눌 수 있어 더 반가워요!`
      : `${nickname}님, 반갑게 맞아주셔서 감사해요. 오늘 편하게 즐겨주세요!`
    : choice.id === "heart"
      ? `${nickname}님의 따뜻한 마음, 두 사람 모두 오래도록 간직할게요.`
      : dialogue.npcId === "bride"
        ? `${nickname}님의 축하 덕분에 오늘이 더 환하게 빛나요!`
        : `${nickname}님의 힘찬 축하를 받아 행복하게 잘 살겠습니다!`;
  const crowdMessage = choice.id === "greet"
    ? "곁에 있던 하객들도 미소로 인사를 건넸어요"
    : choice.id === "heart"
      ? "주변 하객들이 따뜻한 눈빛으로 함께 마음을 보탰어요"
      : "주변에서 박수와 축하가 한꺼번에 이어졌어요";

  return {
    dialogue: {
      ...dialogue,
      message,
      crowdMessage,
      tone: choice.id === "greet" ? "thanks" : "celebration",
      responded: true
    },
    reaction: choice.reaction,
    status: `${choice.label}을 전했어요`
  };
}

type ResolveNpcDialogueInput = {
  npcId: NpcId;
  zoneId: WorldZoneId;
  nickname: string;
  completedCheckpointIds: readonly JourneyCheckpointId[];
  weddingPhase?: WeddingJourneyTiming["phase"] | null;
  conversation?: NpcConversationSnapshot;
};

export function resolveNpcDialogue({
  npcId,
  zoneId,
  nickname,
  completedCheckpointIds,
  weddingPhase = null,
  conversation = { interactionCount: 0, affinityPoints: 0, affinityLevel: 0, lastChoiceId: null, relationshipLabel: "첫 만남", specialRewardLabel: null }
}: ResolveNpcDialogueInput): NpcDialogue {
  const completed = new Set(completedCheckpointIds);
  const allComplete = journeyCheckpointIds.every((checkpointId) => completed.has(checkpointId));
  const personalityLabel = npcPersonalityLabels[npcId];
  const relationshipLabel = conversation.relationshipLabel;
  const affinityLevel = conversation.affinityLevel;
  const specialRewardLabel = conversation.specialRewardLabel;

  if (allComplete) {
    return {
      npcId,
      message: npcId === "bride"
        ? `${nickname}님, 정원의 모든 순간을 함께해 주셔서 정말 고마워요.`
        : `${nickname}님 덕분에 오늘의 여정이 더 따뜻해졌어요. 함께 축하해 주세요!`,
      personalityLabel,
      relationshipLabel,
      tone: "celebration"
    };
  }

  if (weddingPhase === "soon") {
    return {
      npcId,
      message: npcId === "bride"
        ? `${nickname}님, 예식이 곧 시작돼요. 천천히 예식홀로 와주세요!`
        : `${nickname}님, 예식홀 자리를 안내받으신 뒤 편하게 기다려 주세요.`,
      personalityLabel,
      relationshipLabel,
      tone: "welcome"
    };
  }

  if (weddingPhase === "ceremony") {
    return {
      npcId,
      message: `${nickname}님, 지금은 예식이 진행 중이에요. 안내선을 따라 조용히 자리로 이동해 주세요.`,
      personalityLabel,
      relationshipLabel,
      tone: "thanks"
    };
  }

  if (weddingPhase === "reception") {
    return {
      npcId,
      message: npcId === "groom"
        ? `${nickname}님, 이제 연회장에서 맛있는 식사와 함께 인사 나눠요!`
        : `${nickname}님, 오늘의 축하를 오래 기억할게요. 연회장에서도 꼭 만나요!`,
      personalityLabel,
      relationshipLabel,
      tone: "celebration"
    };
  }

  if (zoneId === "bridal-room" && completed.has("bride")) {
    const remembered = conversation.interactionCount === 0
      ? ""
      : conversation.lastChoiceId === "heart"
        ? " 아까 전해주신 따뜻한 마음도 잘 간직하고 있어요."
        : conversation.lastChoiceId === "celebrate"
          ? " 아까 보내주신 힘찬 축하 덕분에 더 환하게 웃고 있어요!"
          : " 다시 만나 인사를 나누니 더 반가워요.";
    return {
      npcId,
      message: `${nickname}님, 다시 인사해 주셨네요. 예식홀에서도 반갑게 만나요!${remembered}`,
      personalityLabel,
      relationshipLabel,
      tone: "thanks"
    };
  }

  if (conversation.interactionCount >= 3) {
    const branchMessage = conversation.lastChoiceId === "heart"
      ? "여러 번 전해주신 따뜻한 마음을 두 사람의 소중한 기억으로 간직하고 있어요."
      : conversation.lastChoiceId === "celebrate"
        ? "만날 때마다 힘차게 축하해 주신 덕분에 오늘이 더 즐거워졌어요!"
        : "여정에서 여러 번 마주쳐 인사를 나누니 정말 가까운 친구처럼 반가워요.";
    return {
      npcId,
      message: `${nickname}님, ${branchMessage}`,
      personalityLabel,
      relationshipLabel,
      tone: "celebration"
    };
  }

  if (conversation.interactionCount > 0) {
    const rememberedMessage = conversation.lastChoiceId === "heart"
      ? "아까 전해주신 따뜻한 마음, 아직도 마음에 남아 있어요."
      : conversation.lastChoiceId === "celebrate"
        ? "아까 보내주신 힘찬 축하 덕분에 기분이 한층 더 밝아졌어요!"
        : "다시 만나 인사를 나누니 더 반갑고 든든해요.";
    return {
      npcId,
      message: `${nickname}님, ${rememberedMessage}`,
      personalityLabel,
      relationshipLabel,
      tone: "thanks"
    };
  }

  if (zoneId === "bridal-room") {
    return completed.has("bride")
      ? {
          npcId,
          message: `${nickname}님, 다시 인사해 주셨네요. 예식홀에서도 반갑게 만나요!`,
          personalityLabel,
          relationshipLabel,
          tone: "thanks"
        }
      : {
          npcId,
          message: `${nickname}님, 와주셨군요! 오늘 이 순간을 함께해 주셔서 정말 든든해요.`,
          personalityLabel,
          relationshipLabel,
          tone: "welcome"
        };
  }

  if (npcId === "groom") {
    return completed.has("guestbook")
      ? {
          npcId,
          message: `${nickname}님, 축하 메시지까지 잘 받았어요. 오래도록 소중히 간직할게요.`,
          personalityLabel,
          relationshipLabel,
          tone: "thanks"
        }
      : {
          npcId,
          message: `${nickname}님, 먼 길 와주셔서 감사합니다. 예식 후 연회장에서 꼭 인사 나눠요!`,
          personalityLabel,
          relationshipLabel,
          tone: "welcome"
        };
  }

  return completed.has("gallery")
    ? {
        npcId,
        message: `${nickname}님, 사진도 보고 오셨군요. 이제 가장 설레는 순간을 함께해 주세요.`,
        personalityLabel,
        relationshipLabel,
        tone: "thanks"
      }
    : {
        npcId,
        message: `${nickname}님, 이 자리까지 와주셔서 고마워요. 오늘의 약속을 함께 지켜봐 주세요.`,
        personalityLabel,
        relationshipLabel,
        tone: "welcome"
      };
}

import type { GuestReaction, WorldZoneId } from "@wedding-game/shared";
import { journeyCheckpointIds, type JourneyCheckpointId } from "./journeyProgress";
import type { WeddingJourneyTiming } from "./weddingJourneyTiming";

export type NpcId = "groom" | "bride";

export type NpcDialogue = {
  npcId: NpcId;
  message: string;
  tone: "welcome" | "thanks" | "celebration";
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

  return {
    dialogue: { ...dialogue, message, tone: choice.id === "greet" ? "thanks" : "celebration", responded: true },
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
};

export function resolveNpcDialogue({
  npcId,
  zoneId,
  nickname,
  completedCheckpointIds,
  weddingPhase = null
}: ResolveNpcDialogueInput): NpcDialogue {
  const completed = new Set(completedCheckpointIds);
  const allComplete = journeyCheckpointIds.every((checkpointId) => completed.has(checkpointId));

  if (allComplete) {
    return {
      npcId,
      message: npcId === "bride"
        ? `${nickname}님, 정원의 모든 순간을 함께해 주셔서 정말 고마워요.`
        : `${nickname}님 덕분에 오늘의 여정이 더 따뜻해졌어요. 함께 축하해 주세요!`,
      tone: "celebration"
    };
  }

  if (weddingPhase === "soon") {
    return {
      npcId,
      message: npcId === "bride"
        ? `${nickname}님, 예식이 곧 시작돼요. 천천히 예식홀로 와주세요!`
        : `${nickname}님, 예식홀 자리를 안내받으신 뒤 편하게 기다려 주세요.`,
      tone: "welcome"
    };
  }

  if (weddingPhase === "ceremony") {
    return {
      npcId,
      message: `${nickname}님, 지금은 예식이 진행 중이에요. 안내선을 따라 조용히 자리로 이동해 주세요.`,
      tone: "thanks"
    };
  }

  if (weddingPhase === "reception") {
    return {
      npcId,
      message: npcId === "groom"
        ? `${nickname}님, 이제 연회장에서 맛있는 식사와 함께 인사 나눠요!`
        : `${nickname}님, 오늘의 축하를 오래 기억할게요. 연회장에서도 꼭 만나요!`,
      tone: "celebration"
    };
  }

  if (zoneId === "bridal-room") {
    return completed.has("bride")
      ? {
          npcId,
          message: `${nickname}님, 다시 인사해 주셨네요. 예식홀에서도 반갑게 만나요!`,
          tone: "thanks"
        }
      : {
          npcId,
          message: `${nickname}님, 와주셨군요! 오늘 이 순간을 함께해 주셔서 정말 든든해요.`,
          tone: "welcome"
        };
  }

  if (npcId === "groom") {
    return completed.has("guestbook")
      ? {
          npcId,
          message: `${nickname}님, 축하 메시지까지 잘 받았어요. 오래도록 소중히 간직할게요.`,
          tone: "thanks"
        }
      : {
          npcId,
          message: `${nickname}님, 먼 길 와주셔서 감사합니다. 예식 후 연회장에서 꼭 인사 나눠요!`,
          tone: "welcome"
        };
  }

  return completed.has("gallery")
    ? {
        npcId,
        message: `${nickname}님, 사진도 보고 오셨군요. 이제 가장 설레는 순간을 함께해 주세요.`,
        tone: "thanks"
      }
    : {
        npcId,
        message: `${nickname}님, 이 자리까지 와주셔서 고마워요. 오늘의 약속을 함께 지켜봐 주세요.`,
        tone: "welcome"
      };
}

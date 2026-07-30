import { BookOpen, Hand, Heart, PartyPopper, Users, X } from "lucide-react";
import { useEffect } from "react";
import {
  npcDialogueChoices,
  type NpcDialogue,
  type NpcDialogueChoice
} from "../game/npcDialogue";
import type { DialoguePlacement } from "../game/gameOverlayPlacement";

type NpcDialogueBubbleProps = {
  dialogue: NpcDialogue;
  speaker: string;
  onClose: () => void;
  onOpenProfile: () => void;
  onChoose?: (choice: NpcDialogueChoice) => void;
  placement?: DialoguePlacement;
};

const dialogueVisibleMs = 7200;

export function NpcDialogueBubble({
  dialogue,
  speaker,
  onClose,
  onOpenProfile,
  onChoose,
  placement = "above"
}: NpcDialogueBubbleProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, dialogueVisibleMs);
    return () => window.clearTimeout(timer);
  }, [dialogue, onClose]);

  return (
    <section
      className="npc-dialogue"
      data-tone={dialogue.tone}
      data-placement={placement}
      aria-label={`${speaker}의 인사`}
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className="npc-dialogue__close" aria-label="대화 닫기" onClick={onClose}>
        <X aria-hidden="true" />
      </button>
      <small>
        {speaker}
        {dialogue.personalityLabel ? <i>{dialogue.personalityLabel}</i> : null}
        {dialogue.relationshipLabel ? <i data-relationship>{dialogue.relationshipLabel}</i> : null}
      </small>
      <p aria-live="polite">{dialogue.message}</p>
      {dialogue.crowdMessage ? (
        <div className="npc-dialogue__crowd" role="status">
          <Users aria-hidden="true" />
          <span>{dialogue.crowdMessage}</span>
        </div>
      ) : null}
      {onChoose && !dialogue.responded ? (
        <div className="npc-dialogue__choices" aria-label="대화 답변 선택">
          {npcDialogueChoices.map((choice) => {
            const Icon = choice.id === "greet" ? Hand : choice.id === "heart" ? Heart : PartyPopper;
            return (
              <button key={choice.id} type="button" onClick={() => onChoose(choice)}>
                <Icon aria-hidden="true" />
                <span>{choice.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <button type="button" className="npc-dialogue__profile" onClick={onOpenProfile}>
        <BookOpen aria-hidden="true" />
        두 사람 소개
      </button>
    </section>
  );
}

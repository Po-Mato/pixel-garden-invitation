import { BookOpen, X } from "lucide-react";
import { useEffect } from "react";
import type { NpcDialogue } from "../game/npcDialogue";

type NpcDialogueBubbleProps = {
  dialogue: NpcDialogue;
  speaker: string;
  onClose: () => void;
  onOpenProfile: () => void;
};

const dialogueVisibleMs = 7200;

export function NpcDialogueBubble({
  dialogue,
  speaker,
  onClose,
  onOpenProfile
}: NpcDialogueBubbleProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, dialogueVisibleMs);
    return () => window.clearTimeout(timer);
  }, [dialogue, onClose]);

  return (
    <section
      className="npc-dialogue"
      data-tone={dialogue.tone}
      aria-label={`${speaker}의 인사`}
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className="npc-dialogue__close" aria-label="대화 닫기" onClick={onClose}>
        <X aria-hidden="true" />
      </button>
      <small>{speaker}</small>
      <p aria-live="polite">{dialogue.message}</p>
      <button type="button" className="npc-dialogue__profile" onClick={onOpenProfile}>
        <BookOpen aria-hidden="true" />
        두 사람 소개
      </button>
    </section>
  );
}

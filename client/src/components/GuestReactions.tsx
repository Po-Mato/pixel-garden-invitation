import {
  Hand,
  Heart,
  PartyPopper,
  SmilePlus,
  Sparkles,
  type LucideIcon
} from "lucide-react";
import { useEffect, useState } from "react";
import type { GuestReaction } from "@wedding-game/shared";

type GuestReactionDockProps = {
  disabled?: boolean;
  onReact: (reaction: GuestReaction) => void;
};

type GuestReactionBubbleProps = {
  reaction: GuestReaction;
  guestName: string;
};

type ReactionOption = {
  id: GuestReaction;
  label: string;
  Icon: LucideIcon;
};

const guestReactionOptions: readonly ReactionOption[] = [
  { id: "wave", label: "인사", Icon: Hand },
  { id: "heart", label: "하트", Icon: Heart },
  { id: "applause", label: "박수", Icon: Sparkles },
  { id: "celebrate", label: "축하", Icon: PartyPopper }
];

const reactionIconById = Object.fromEntries(
  guestReactionOptions.map((option) => [option.id, option.Icon])
) as Record<GuestReaction, LucideIcon>;
const reactionLabelById = Object.fromEntries(
  guestReactionOptions.map((option) => [option.id, option.label])
) as Record<GuestReaction, string>;

export function GuestReactionDock({ disabled = false, onReact }: GuestReactionDockProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className="guest-reaction-dock" onClick={(event) => event.stopPropagation()}>
      {open ? (
        <div className="guest-reaction-dock__options" aria-label="하객 리액션 선택">
          {guestReactionOptions.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={`${label} 보내기`}
              title={label}
              disabled={disabled}
              onClick={() => {
                onReact(id);
                setOpen(false);
              }}
            >
              <Icon aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="guest-reaction-dock__toggle"
        aria-label={open ? "하객 리액션 닫기" : "하객 리액션 열기"}
        aria-expanded={open}
        disabled={disabled}
        title="리액션"
        onClick={() => setOpen((current) => !current)}
      >
        <SmilePlus aria-hidden="true" />
      </button>
    </div>
  );
}

export function GuestReactionBubble({ reaction, guestName }: GuestReactionBubbleProps) {
  const Icon = reactionIconById[reaction];
  return (
    <span
      className={`guest-reaction-bubble guest-reaction-bubble--${reaction}`}
      role="status"
      aria-label={`${guestName}님의 ${reactionLabelById[reaction]}`}
    >
      <Icon aria-hidden="true" />
    </span>
  );
}

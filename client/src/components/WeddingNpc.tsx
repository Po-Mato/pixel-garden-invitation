import type { Direction } from "@wedding-game/shared";
import type { CSSProperties, MouseEvent } from "react";
import type { NpcReaction } from "../game/npcMotion";

type Props = {
  id: "groom" | "bride";
  label: string;
  approaching?: boolean;
  direction?: Direction;
  moving?: boolean;
  stepFrame?: number;
  reaction?: NpcReaction;
  onSelect: () => void;
};

const directionRow: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };

export function WeddingNpc({
  id,
  label,
  approaching = false,
  direction = "down",
  moving = false,
  stepFrame = 1,
  reaction = "idle",
  onSelect
}: Props) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect();
  };
  const useWalkSheet = moving || direction !== "down";
  const renderedFrame = moving ? ((stepFrame % 3) + 3) % 3 : 1;
  const spriteStyle = {
    "--npc-frame-width": "96px",
    "--npc-frame-height": "144px",
    "--npc-display-width": "48px",
    "--npc-display-height": "72px",
    "--npc-sheet-display-width": useWalkSheet ? "144px" : "96px",
    "--npc-sheet-display-height": useWalkSheet ? "288px" : "72px",
    backgroundImage: `url("${import.meta.env.BASE_URL}characters/generated/npc/${id}__${useWalkSheet ? "walk" : "idle"}.png")`,
    backgroundPosition: useWalkSheet
      ? `${renderedFrame * -48}px ${directionRow[direction] * -72}px`
      : "0 0"
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`wedding-npc${approaching ? " wedding-npc--target" : ""}`}
      aria-label={`${label}와 대화하기`}
      data-approaching={approaching || undefined}
      data-moving={moving || undefined}
      data-reaction={reaction}
      onClick={handleClick}
    >
      {reaction !== "idle" ? (
        <span className="wedding-npc__reaction" aria-hidden="true">
          {reaction === "yield" ? "먼저 지나가세요" : "어서 오세요"}
        </span>
      ) : null}
      <span
        className={`wedding-npc__sprite wedding-npc__sprite--${id} wedding-npc__sprite--${useWalkSheet ? "walk" : "idle"}`}
        style={spriteStyle}
        aria-hidden="true"
      />
      <span className="wedding-npc__label">{label}</span>
    </button>
  );
}

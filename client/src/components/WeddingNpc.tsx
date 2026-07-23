import type { CSSProperties, MouseEvent } from "react";

type Props = {
  id: "groom" | "bride";
  label: string;
  approaching?: boolean;
  onSelect: () => void;
};

export function WeddingNpc({ id, label, approaching = false, onSelect }: Props) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect();
  };
  const spriteStyle = {
    "--npc-frame-width": "96px",
    "--npc-frame-height": "144px",
    "--npc-display-width": "48px",
    "--npc-display-height": "72px",
    "--npc-sheet-display-width": "96px",
    "--npc-sheet-display-height": "72px",
    backgroundImage: `url("${import.meta.env.BASE_URL}characters/generated/npc/${id}__idle.png")`
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`wedding-npc${approaching ? " wedding-npc--target" : ""}`}
      aria-label={`${label}와 대화하기`}
      data-approaching={approaching || undefined}
      onClick={handleClick}
    >
      <span
        className={`wedding-npc__sprite wedding-npc__sprite--${id}`}
        style={spriteStyle}
        aria-hidden="true"
      />
      <span className="wedding-npc__label">{label}</span>
    </button>
  );
}

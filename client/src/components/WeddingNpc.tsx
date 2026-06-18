import type { MouseEvent } from "react";

type Props = {
  id: "groom" | "bride";
  label: string;
  onSelect: () => void;
};

export function WeddingNpc({ id, label, onSelect }: Props) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect();
  };

  return (
    <button
      type="button"
      className="wedding-npc"
      aria-label={`${label} 소개 보기`}
      onClick={handleClick}
    >
      <span
        className={`wedding-npc__sprite wedding-npc__sprite--${id}`}
        style={{
          backgroundImage: `url("${import.meta.env.BASE_URL}characters/generated/npc/${id}__idle.png")`
        }}
        aria-hidden="true"
      />
      <span className="wedding-npc__label">{label}</span>
    </button>
  );
}

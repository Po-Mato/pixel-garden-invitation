import { Eye, Hand, Search, Sparkles } from "lucide-react";
import type { WorldDecoration } from "../game/world";
import type { WorldPropInteraction } from "../game/worldPropInteractions";
import { worldDepth } from "../game/worldVisuals";

type WorldInteractivePropProps = {
  decoration: WorldDecoration;
  interaction: WorldPropInteraction;
  active: boolean;
  discovered?: boolean;
  nearby?: boolean;
  onSelect: () => void;
};

export function WorldInteractiveProp({
  decoration,
  interaction,
  active,
  discovered = false,
  nearby = false,
  onSelect
}: WorldInteractivePropProps) {
  const Icon = !discovered ? Search : interaction.effect === "scenery" ? Eye : interaction.effect === "rest" ? Hand : Sparkles;
  const depthY = decoration.depthY ?? decoration.y + decoration.height;

  return (
    <button
      type="button"
      className="world-interactive-prop"
      data-effect={interaction.effect}
      data-active={active || undefined}
      data-discovered={discovered || undefined}
      data-nearby={nearby || undefined}
      aria-label={`${decoration.label}, ${interaction.actionLabel}`}
      title={interaction.actionLabel}
      style={{
        left: decoration.x,
        top: decoration.y,
        width: decoration.width,
        height: decoration.height,
        zIndex: worldDepth(depthY) + 2
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <span aria-hidden="true"><Icon /></span>
    </button>
  );
}

type WorldPropMomentProps = {
  decoration: WorldDecoration;
  interaction: WorldPropInteraction;
  isNewSecret?: boolean;
  achievementLabel?: string;
};

export function WorldPropMoment({ decoration, interaction, isNewSecret = false, achievementLabel }: WorldPropMomentProps) {
  return (
    <div
      className="world-prop-moment"
      data-effect={interaction.effect}
      role="status"
    >
      <Sparkles aria-hidden="true" />
      <span>
        <strong>{isNewSecret ? `숨은 추억 · ${interaction.secretLabel}` : decoration.label}</strong>
        <small>{interaction.resultMessage}</small>
        {achievementLabel ? <em>업적 달성 · {achievementLabel}</em> : null}
      </span>
    </div>
  );
}

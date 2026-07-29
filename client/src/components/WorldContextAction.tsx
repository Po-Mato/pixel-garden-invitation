import { Camera, DoorOpen, ListChecks, MessageCircle } from "lucide-react";
import type { ContextHudAction } from "../game/contextHudAction";

type WorldContextActionProps = {
  action: ContextHudAction;
  onActivate: (action: ContextHudAction) => void;
};

export function WorldContextAction({ action, onActivate }: WorldContextActionProps) {
  const Icon = action.kind === "portal"
    ? DoorOpen
    : action.kind === "photo"
      ? Camera
      : action.kind === "npc" ? MessageCircle : ListChecks;
  return (
    <button
      type="button"
      className="world-context-action"
      data-kind={action.kind}
      aria-label={`${action.label} ${action.actionLabel}`}
      onClick={(event) => {
        event.stopPropagation();
        onActivate(action);
      }}
    >
      <Icon aria-hidden="true" />
      <span><small>{action.progressLabel ?? "가까운 장소"}</small><strong>{action.label}</strong></span>
      <em>{action.actionLabel}</em>
    </button>
  );
}

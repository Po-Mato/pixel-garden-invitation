import type { Point } from "./world";
import type { WorldDecoration } from "./world";
import type { WorldPropInteraction } from "./worldPropInteractions";

export type WorldSecretClueBand = "distant" | "warm" | "near";

export type WorldSecretClue = {
  band: WorldSecretClueBand;
  distance: number;
  directionLabel: "위쪽" | "아래쪽" | "왼쪽" | "오른쪽" | "바로 근처";
  message: string;
};

function directionToward(deltaX: number, deltaY: number, nearby: boolean): WorldSecretClue["directionLabel"] {
  if (nearby) return "바로 근처";
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX >= 0 ? "오른쪽" : "왼쪽";
  return deltaY >= 0 ? "아래쪽" : "위쪽";
}

export function resolveWorldSecretClue(
  interaction: Pick<WorldPropInteraction, "actionRadius" | "clueLabel">,
  decoration: Pick<WorldDecoration, "x" | "y" | "width" | "height">,
  position: Point
): WorldSecretClue {
  const deltaX = decoration.x + decoration.width / 2 - position.x;
  const deltaY = decoration.y + decoration.height / 2 - position.y;
  const distance = Math.round(Math.hypot(deltaX, deltaY));
  const nearThreshold = interaction.actionRadius + 55;
  const warmThreshold = interaction.actionRadius + 180;
  const band: WorldSecretClueBand = distance <= nearThreshold ? "near" : distance <= warmThreshold ? "warm" : "distant";
  const directionLabel = directionToward(deltaX, deltaY, band === "near");
  const prefix = band === "near" ? "단서가 아주 선명해요" : band === "warm" ? "단서가 가까워지고 있어요" : "주변을 천천히 살펴보세요";
  return {
    band,
    distance,
    directionLabel,
    message: `${prefix} · ${directionLabel}에서 ${interaction.clueLabel}`
  };
}

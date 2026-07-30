import { Sparkles } from "lucide-react";
import { worldDepth } from "../game/worldVisuals";

export function WorldSecretMemorial() {
  const point = { x: 520, y: 620 };
  return (
    <div
      className="world-secret-memorial"
      aria-label="숨은 추억을 모두 모아 완성한 기억의 등불"
      style={{ left: point.x, top: point.y, zIndex: worldDepth(point.y) }}
    >
      <span aria-hidden="true"><i /><Sparkles /><i /></span>
      <strong>기억의 등불</strong>
    </div>
  );
}

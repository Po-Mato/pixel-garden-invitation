import type { WorldDecoration as WorldDecorationData } from "../game/world";

type WorldDecorationProps = {
  decoration: WorldDecorationData;
};

export function WorldDecoration({ decoration }: WorldDecorationProps) {
  return (
    <div
      className={`world-decoration world-decoration--${decoration.kind}`}
      data-decoration={decoration.kind}
      data-decoration-label={decoration.label}
      aria-hidden="true"
      style={{
        left: decoration.x,
        top: decoration.y,
        width: decoration.width,
        height: decoration.height
      }}
    >
      <span />
    </div>
  );
}

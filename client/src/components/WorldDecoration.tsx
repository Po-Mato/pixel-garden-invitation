import type { WorldDecoration as WorldDecorationData, WorldZone } from "../game/world";

type WorldDecorationProps = {
  decoration: WorldDecorationData;
  zone: WorldZone;
};

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

export function WorldDecoration({ decoration, zone }: WorldDecorationProps) {
  return (
    <div
      className={`world-decoration world-decoration--${decoration.kind}`}
      data-decoration={decoration.kind}
      data-decoration-label={decoration.label}
      aria-hidden="true"
      style={{
        left: toPercent(decoration.x, zone.bounds.width),
        top: toPercent(decoration.y, zone.bounds.height),
        width: toPercent(decoration.width, zone.bounds.width),
        height: toPercent(decoration.height, zone.bounds.height)
      }}
    >
      <span />
    </div>
  );
}

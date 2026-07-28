import type { CrowdDensityCell } from "../game/crowdDensity";

type WorldCrowdHeatmapProps = {
  cells: readonly CrowdDensityCell[];
};

export function WorldCrowdHeatmap({ cells }: WorldCrowdHeatmapProps) {
  if (cells.length === 0) return null;
  return (
    <div className="world-crowd-heatmap" aria-label={`실시간 하객 밀도 ${cells.length}구역`}>
      {cells.map((cell) => (
        <span
          key={`${cell.point.x}-${cell.point.y}`}
          className="world-crowd-heatmap__cell"
          data-level={cell.level}
          style={{ left: cell.point.x, top: cell.point.y }}
          title={`이 주변 하객 ${cell.count}명`}
        >
          <i aria-hidden="true" />
          {cell.count > 1 ? <small>{cell.count}</small> : null}
        </span>
      ))}
    </div>
  );
}

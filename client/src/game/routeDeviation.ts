export type RouteRecalculationResult = {
  deltaTiles: number;
  notice: string;
  kind: "detour" | "shorter" | "same";
};

export function routeRecalculationResult(
  previousRemainingTiles: number,
  nextRemainingTiles: number
): RouteRecalculationResult {
  const previous = Math.max(0, Math.floor(previousRemainingTiles));
  const next = Math.max(0, Math.floor(nextRemainingTiles));
  const deltaTiles = next - previous;

  if (deltaTiles > 0) {
    return { deltaTiles, notice: `우회 +${deltaTiles}타일`, kind: "detour" };
  }
  if (deltaTiles < 0) {
    return { deltaTiles, notice: `새 경로 ${Math.abs(deltaTiles)}타일 단축`, kind: "shorter" };
  }
  return { deltaTiles: 0, notice: "자동 재탐색 완료", kind: "same" };
}

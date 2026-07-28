export type RouteArrivalCue = {
  remainingTiles: 1 | 2 | 3;
  eyebrow: string;
  message: string;
};

export function routeArrivalCue(
  remainingTiles: number,
  destinationLabel: string,
  portal: boolean
): RouteArrivalCue | null {
  const remaining = Math.floor(remainingTiles);
  if (remaining < 1 || remaining > 3) return null;

  const messages = portal
    ? {
      3: "포털 진입 방향을 확인하세요",
      2: "빛나는 타일을 따라 이동하세요",
      1: "곧 다음 맵으로 이동해요"
    }
    : {
      3: `${destinationLabel} 진입을 준비하세요`,
      2: "현재 경로를 그대로 따라가세요",
      1: "곧 목적지에 도착해요"
    };

  return {
    remainingTiles: remaining as 1 | 2 | 3,
    eyebrow: `${remaining}타일 앞`,
    message: messages[remaining as 1 | 2 | 3]
  };
}

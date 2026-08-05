export type WorldLabelVisibility = "full" | "quiet";

export type WorldLabelCandidate = {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
  priority: number;
};

function overlaps(
  left: WorldLabelCandidate["rect"],
  right: WorldLabelCandidate["rect"],
  padding: number
) {
  return !(
    left.x + left.width + padding <= right.x
    || right.x + right.width + padding <= left.x
    || left.y + left.height + padding <= right.y
    || right.y + right.height + padding <= left.y
  );
}

export function resolveWorldLabelVisibility(
  candidates: readonly WorldLabelCandidate[],
  padding = 6
): ReadonlyMap<string, WorldLabelVisibility> {
  const ordered = candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => right.candidate.priority - left.candidate.priority || left.index - right.index);
  const visible: WorldLabelCandidate[] = [];
  const result = new Map<string, WorldLabelVisibility>();

  for (const { candidate } of ordered) {
    const obscured = visible.some((accepted) => overlaps(candidate.rect, accepted.rect, padding));
    result.set(candidate.id, obscured ? "quiet" : "full");
    if (!obscured) visible.push(candidate);
  }

  return result;
}

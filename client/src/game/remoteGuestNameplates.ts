export type RemoteGuestNameplateSource = {
  guestId: string;
  x: number;
  y: number;
};

export type RemoteGuestNameplatePlacement = {
  x: number;
  y: number;
  crowded: boolean;
};

export type RemoteGuestNameplateBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export const remoteGuestNameplateWidth = 64;
export const remoteGuestNameplateHeight = 18;
const nameplateGap = 4;
const horizontalStep = remoteGuestNameplateWidth + nameplateGap;
const verticalStep = remoteGuestNameplateHeight + nameplateGap;

type NameplateRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function candidateOffsets(count: number) {
  const radius = Math.max(1, count);
  return Array.from({ length: radius * 2 + 1 }, (_, rowIndex) => rowIndex - radius)
    .flatMap((row) => Array.from(
      { length: radius * 2 + 1 },
      (_, columnIndex) => ({ column: columnIndex - radius, row })
    ))
    .sort((left, right) => (
      Math.abs(left.column) + Math.abs(left.row)
      - Math.abs(right.column) - Math.abs(right.row)
      || Math.abs(left.row) - Math.abs(right.row)
      || left.row - right.row
      || left.column - right.column
    ))
    .map(({ column, row }) => ({ x: column * horizontalStep, y: row * verticalStep }));
}

function placementRect(guest: RemoteGuestNameplateSource, x: number, y: number): NameplateRect {
  const centerX = guest.x + x;
  const top = guest.y + y;
  return {
    left: centerX - remoteGuestNameplateWidth / 2,
    right: centerX + remoteGuestNameplateWidth / 2,
    top,
    bottom: top + remoteGuestNameplateHeight
  };
}

function intersects(left: NameplateRect, right: NameplateRect) {
  return !(
    left.right + nameplateGap <= right.left
    || right.right + nameplateGap <= left.left
    || left.bottom + nameplateGap <= right.top
    || right.bottom + nameplateGap <= left.top
  );
}

function isInsideBounds(rect: NameplateRect, bounds: RemoteGuestNameplateBounds | undefined) {
  return !bounds || (
    rect.left >= bounds.left
    && rect.right <= bounds.right
    && rect.top >= bounds.top
    && rect.bottom <= bounds.bottom
  );
}

export function placeRemoteGuestNameplates(
  guests: readonly RemoteGuestNameplateSource[],
  bounds?: RemoteGuestNameplateBounds
) {
  const placements = new Map<string, RemoteGuestNameplatePlacement>();
  const placedRects: NameplateRect[] = [];
  const candidates = candidateOffsets(guests.length);

  for (const guest of [...guests].sort((left, right) => left.guestId.localeCompare(right.guestId))) {
    const selected = candidates.find(({ x, y }) => {
      const rect = placementRect(guest, x, y);
      return isInsideBounds(rect, bounds)
        && placedRects.every((placed) => !intersects(rect, placed));
    }) ?? { x: 0, y: placedRects.length * verticalStep };

    placedRects.push(placementRect(guest, selected.x, selected.y));
    placements.set(guest.guestId, {
      ...selected,
      crowded: selected.x !== 0 || selected.y !== 0
    });
  }

  return placements;
}

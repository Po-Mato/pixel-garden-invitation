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
  const candidates = [{ x: 0, y: 0 }];
  const rows = Math.max(1, Math.ceil(count / 3));

  for (let row = 0; row < rows; row += 1) {
    const y = row * verticalStep;
    if (row > 0) candidates.push({ x: 0, y });
    candidates.push({ x: -horizontalStep, y }, { x: horizontalStep, y });
  }

  return candidates;
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

export function placeRemoteGuestNameplates(guests: readonly RemoteGuestNameplateSource[]) {
  const placements = new Map<string, RemoteGuestNameplatePlacement>();
  const placedRects: NameplateRect[] = [];
  const candidates = candidateOffsets(guests.length);

  for (const guest of [...guests].sort((left, right) => left.guestId.localeCompare(right.guestId))) {
    const selected = candidates.find(({ x, y }) => {
      const rect = placementRect(guest, x, y);
      return placedRects.every((placed) => !intersects(rect, placed));
    }) ?? { x: 0, y: placedRects.length * verticalStep };

    placedRects.push(placementRect(guest, selected.x, selected.y));
    placements.set(guest.guestId, {
      ...selected,
      crowded: selected.x !== 0 || selected.y !== 0
    });
  }

  return placements;
}

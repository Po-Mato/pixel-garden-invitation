import { describe, expect, it } from "vitest";
import {
  placeRemoteGuestNameplates,
  remoteGuestNameplateHeight,
  remoteGuestNameplateWidth,
  type RemoteGuestNameplateBounds,
  type RemoteGuestNameplateSource
} from "./remoteGuestNameplates";

function rectangles(guests: RemoteGuestNameplateSource[], bounds?: RemoteGuestNameplateBounds) {
  const placements = placeRemoteGuestNameplates(guests, bounds);
  return guests.map((guest) => {
    const placement = placements.get(guest.guestId)!;
    const centerX = guest.x + placement.x;
    return {
      id: guest.guestId,
      left: centerX - remoteGuestNameplateWidth / 2,
      right: centerX + remoteGuestNameplateWidth / 2,
      top: guest.y + placement.y,
      bottom: guest.y + placement.y + remoteGuestNameplateHeight
    };
  });
}

function expectNoOverlap(guests: RemoteGuestNameplateSource[], bounds?: RemoteGuestNameplateBounds) {
  const rects = rectangles(guests, bounds);
  for (let leftIndex = 0; leftIndex < rects.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rects.length; rightIndex += 1) {
      const left = rects[leftIndex];
      const right = rects[rightIndex];
      const overlaps = !(
        left.right <= right.left
        || right.right <= left.left
        || left.bottom <= right.top
        || right.bottom <= left.top
      );
      expect(overlaps, `${left.id} and ${right.id}`).toBe(false);
    }
  }
}

function expectInsideBounds(guests: RemoteGuestNameplateSource[], bounds: RemoteGuestNameplateBounds) {
  for (const rect of rectangles(guests, bounds)) {
    expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
    expect(rect.right).toBeLessThanOrEqual(bounds.right);
    expect(rect.top).toBeGreaterThanOrEqual(bounds.top);
    expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom);
  }
}

describe("placeRemoteGuestNameplates", () => {
  it("keeps distant guest labels in their natural position", () => {
    const placements = placeRemoteGuestNameplates([
      { guestId: "a", x: 100, y: 100 },
      { guestId: "b", x: 240, y: 100 },
      { guestId: "c", x: 380, y: 100 }
    ]);

    expect([...placements.values()]).toEqual([
      { x: 0, y: 0, crowded: false },
      { x: 0, y: 0, crowded: false },
      { x: 0, y: 0, crowded: false }
    ]);
  });

  it("separates eight long-name labels sharing a tight crowd", () => {
    const guests = Array.from({ length: 8 }, (_, index) => ({
      guestId: `guest-${index + 1}`,
      x: 200 + (index % 2) * 2,
      y: 240 + (index % 3) * 2
    }));

    expectNoOverlap(guests);
    expect([...placeRemoteGuestNameplates(guests).values()].filter(({ crowded }) => crowded)).toHaveLength(7);
  });

  it("is stable when realtime guest order changes", () => {
    const guests = Array.from({ length: 6 }, (_, index) => ({
      guestId: `guest-${index + 1}`,
      x: 200,
      y: 240
    }));
    const forward = placeRemoteGuestNameplates(guests);
    const reverse = placeRemoteGuestNameplates([...guests].reverse());

    for (const guest of guests) {
      expect(reverse.get(guest.guestId)).toEqual(forward.get(guest.guestId));
    }
  });

  it.each([
    { count: 3, anchor: { x: 18, y: 90 } },
    { count: 5, anchor: { x: 382, y: 150 } },
    { count: 8, anchor: { x: 200, y: 286 } }
  ])("keeps $count crowded long-name labels inside map edges", ({ count, anchor }) => {
    const bounds = { left: 4, right: 396, top: 4, bottom: 296 };
    const guests = Array.from({ length: count }, (_, index) => ({
      guestId: `edge-guest-${index + 1}`,
      x: anchor.x + (index % 2),
      y: anchor.y + (index % 2)
    }));

    expectNoOverlap(guests, bounds);
    expectInsideBounds(guests, bounds);
  });
});

import type { WeddingEvent } from "@wedding-game/shared";

export type CoupleDisplayOrder = "bride-first" | "groom-first";
export type CoupleSide = keyof WeddingEvent["couple"];

type SessionStorageLike = Pick<Storage, "getItem" | "setItem">;

export const defaultCoupleDisplayOrder: CoupleDisplayOrder = "bride-first";
export const coupleOrderStorageKey = "wedding-couple-display-order:v1";

function browserSessionStorage(): SessionStorageLike | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function isCoupleDisplayOrder(value: unknown): value is CoupleDisplayOrder {
  return value === "bride-first" || value === "groom-first";
}

export function chooseCoupleDisplayOrder(random = Math.random): CoupleDisplayOrder {
  return random() < 0.5 ? "bride-first" : "groom-first";
}

export function loadOrCreateCoupleDisplayOrder(
  storage: SessionStorageLike | null = browserSessionStorage(),
  random = Math.random
): CoupleDisplayOrder {
  try {
    const stored = storage?.getItem(coupleOrderStorageKey);
    if (isCoupleDisplayOrder(stored)) return stored;
  } catch {
    // A stable in-memory provider value is still available when storage is blocked.
  }

  const order = chooseCoupleDisplayOrder(random);
  try {
    storage?.setItem(coupleOrderStorageKey, order);
  } catch {
    // Storage permissions can change while the invitation is open.
  }
  return order;
}

export function coupleSides(order: CoupleDisplayOrder): readonly [CoupleSide, CoupleSide] {
  return order === "bride-first" ? ["bride", "groom"] : ["groom", "bride"];
}

export function formatCoupleNames(
  event: WeddingEvent,
  order: CoupleDisplayOrder = defaultCoupleDisplayOrder,
  separator = " · "
): string {
  const [first, second] = coupleSides(order);
  return `${event.couple[first]}${separator}${event.couple[second]}`;
}

export function formatWeddingTitle(
  event: WeddingEvent,
  order: CoupleDisplayOrder = defaultCoupleDisplayOrder
): string {
  const orderedNames = formatCoupleNames(event, order);
  const currentNames = [
    `${event.couple.bride} · ${event.couple.groom}`,
    `${event.couple.groom} · ${event.couple.bride}`
  ].find((names) => event.title.includes(names));

  return currentNames ? event.title.replace(currentNames, orderedNames) : event.title;
}

export const celebrationFrameStorageKey = "wedding-game:celebration-frame:v1";

export type CelebrationFramePalette = "garden" | "rose" | "starlight" | "wedding-day";
export type CelebrationFrameDecoration = "flowers" | "ribbons" | "stars";

export type CelebrationFrameSelection = {
  palette: CelebrationFramePalette;
  decoration: CelebrationFrameDecoration;
};

export const defaultCelebrationFrame: CelebrationFrameSelection = {
  palette: "garden",
  decoration: "flowers"
};

type FrameStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): FrameStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isCelebrationFrameSelection(value: unknown): value is CelebrationFrameSelection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CelebrationFrameSelection>;
  return ["garden", "rose", "starlight", "wedding-day"].includes(candidate.palette ?? "")
    && ["flowers", "ribbons", "stars"].includes(candidate.decoration ?? "");
}

export function loadCelebrationFrameSelection(
  weddingDayAvailable = false,
  storage: FrameStorage | null = browserStorage()
): CelebrationFrameSelection {
  try {
    const parsed = JSON.parse(storage?.getItem(celebrationFrameStorageKey) ?? "null");
    if (!isCelebrationFrameSelection(parsed)) return defaultCelebrationFrame;
    return parsed.palette === "wedding-day" && !weddingDayAvailable
      ? defaultCelebrationFrame
      : parsed;
  } catch {
    return defaultCelebrationFrame;
  }
}

export function saveCelebrationFrameSelection(
  selection: CelebrationFrameSelection,
  weddingDayAvailable = false,
  storage: FrameStorage | null = browserStorage()
): CelebrationFrameSelection {
  const normalized = isCelebrationFrameSelection(selection)
    && (selection.palette !== "wedding-day" || weddingDayAvailable)
    ? selection
    : defaultCelebrationFrame;
  try {
    storage?.setItem(celebrationFrameStorageKey, JSON.stringify(normalized));
  } catch {
    // Keep the in-memory choice usable when embedded or private browsers block storage.
  }
  return normalized;
}

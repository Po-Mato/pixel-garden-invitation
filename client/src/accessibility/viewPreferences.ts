export type ViewPreferences = {
  textScale: "default" | "large";
  reduceMotion: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const viewPreferencesStorageKey = "wedding-view-preferences:v1";
export const defaultViewPreferences: ViewPreferences = {
  textScale: "default",
  reduceMotion: false
};

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isViewPreferences(value: unknown): value is ViewPreferences {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ViewPreferences>;
  return (candidate.textScale === "default" || candidate.textScale === "large")
    && typeof candidate.reduceMotion === "boolean";
}

export function loadViewPreferences(storage: StorageLike | null = browserStorage()): ViewPreferences {
  try {
    const stored = storage?.getItem(viewPreferencesStorageKey);
    if (!stored) return defaultViewPreferences;
    const parsed: unknown = JSON.parse(stored);
    return isViewPreferences(parsed) ? parsed : defaultViewPreferences;
  } catch {
    return defaultViewPreferences;
  }
}

export function saveViewPreferences(
  preferences: ViewPreferences,
  storage: StorageLike | null = browserStorage()
): boolean {
  try {
    storage?.setItem(viewPreferencesStorageKey, JSON.stringify(preferences));
    return storage !== null;
  } catch {
    return false;
  }
}

export function applyViewPreferences(
  preferences: ViewPreferences,
  root: HTMLElement = document.documentElement
) {
  if (preferences.textScale === "large") root.dataset.textScale = "large";
  else delete root.dataset.textScale;

  if (preferences.reduceMotion) root.dataset.reduceMotion = "true";
  else delete root.dataset.reduceMotion;
}

export function shouldReduceMotion(
  root: HTMLElement = document.documentElement,
  matchMedia: typeof window.matchMedia | undefined = typeof window === "undefined" ? undefined : window.matchMedia
): boolean {
  if (root.dataset.reduceMotion === "true") return true;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

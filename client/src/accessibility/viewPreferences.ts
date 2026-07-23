export type ViewPreferences = {
  textScale: "default" | "large" | "xlarge";
  reduceMotion: boolean;
  highContrast: boolean;
  comfortableControls: boolean;
  dataSaver: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const viewPreferencesStorageKey = "wedding-view-preferences:v1";
export const defaultViewPreferences: ViewPreferences = {
  textScale: "default",
  reduceMotion: false,
  highContrast: false,
  comfortableControls: false,
  dataSaver: false
};

export const comfortableViewPreferences: ViewPreferences = {
  textScale: "xlarge",
  reduceMotion: true,
  highContrast: true,
  comfortableControls: true,
  dataSaver: false
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
  return (
    candidate.textScale === "default"
    || candidate.textScale === "large"
    || candidate.textScale === "xlarge"
  )
    && typeof candidate.reduceMotion === "boolean"
    && typeof candidate.highContrast === "boolean"
    && typeof candidate.comfortableControls === "boolean"
    && typeof candidate.dataSaver === "boolean";
}

function normalizeStoredPreferences(value: unknown): ViewPreferences | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<ViewPreferences>;
  if (
    candidate.textScale !== "default"
    && candidate.textScale !== "large"
    && candidate.textScale !== "xlarge"
  ) return null;
  if (typeof candidate.reduceMotion !== "boolean") return null;

  return {
    textScale: candidate.textScale,
    reduceMotion: candidate.reduceMotion,
    highContrast: typeof candidate.highContrast === "boolean" ? candidate.highContrast : false,
    comfortableControls: typeof candidate.comfortableControls === "boolean"
      ? candidate.comfortableControls
      : false,
    dataSaver: typeof candidate.dataSaver === "boolean" ? candidate.dataSaver : false
  };
}

export function loadViewPreferences(storage: StorageLike | null = browserStorage()): ViewPreferences {
  try {
    const stored = storage?.getItem(viewPreferencesStorageKey);
    if (!stored) return defaultViewPreferences;
    const parsed: unknown = JSON.parse(stored);
    return normalizeStoredPreferences(parsed) ?? defaultViewPreferences;
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
  if (preferences.textScale === "large" || preferences.textScale === "xlarge") {
    root.dataset.textScale = preferences.textScale;
  }
  else delete root.dataset.textScale;

  if (preferences.reduceMotion) root.dataset.reduceMotion = "true";
  else delete root.dataset.reduceMotion;

  if (preferences.highContrast) root.dataset.highContrast = "true";
  else delete root.dataset.highContrast;

  if (preferences.comfortableControls) root.dataset.comfortableControls = "true";
  else delete root.dataset.comfortableControls;

  if (preferences.dataSaver) root.dataset.dataSaver = "true";
  else delete root.dataset.dataSaver;
}

export function shouldReduceMotion(
  root: HTMLElement = document.documentElement,
  matchMedia: typeof window.matchMedia | undefined = typeof window === "undefined" ? undefined : window.matchMedia
): boolean {
  if (root.dataset.reduceMotion === "true") return true;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

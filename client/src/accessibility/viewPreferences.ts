export type ViewPreferences = {
  textScale: "default" | "large" | "xlarge";
  reduceMotion: boolean;
  highContrast: boolean;
  comfortableControls: boolean;
  oneHandedControls: boolean;
  joystickSide: "left" | "right";
  dataSaver: boolean;
  routeVoiceGuidance: boolean;
  routeVoiceRate: "slow" | "normal" | "fast";
  stepFreeRouteEnabled: boolean;
  miniMapHighContrast: boolean;
  miniMapRouteWeight: "standard" | "bold";
  routePatternEnhanced: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const viewPreferencesStorageKey = "wedding-view-preferences:v1";
export const defaultViewPreferences: ViewPreferences = {
  textScale: "default",
  reduceMotion: false,
  highContrast: false,
  comfortableControls: false,
  oneHandedControls: false,
  joystickSide: "left",
  dataSaver: false,
  routeVoiceGuidance: false,
  routeVoiceRate: "normal",
  stepFreeRouteEnabled: false,
  miniMapHighContrast: false,
  miniMapRouteWeight: "standard",
  routePatternEnhanced: false
};

export const comfortableViewPreferences: ViewPreferences = {
  textScale: "xlarge",
  reduceMotion: true,
  highContrast: true,
  comfortableControls: true,
  oneHandedControls: true,
  joystickSide: "left",
  dataSaver: false,
  routeVoiceGuidance: false,
  routeVoiceRate: "normal",
  stepFreeRouteEnabled: true,
  miniMapHighContrast: true,
  miniMapRouteWeight: "bold",
  routePatternEnhanced: true
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
    && typeof candidate.oneHandedControls === "boolean"
    && (candidate.joystickSide === "left" || candidate.joystickSide === "right")
    && typeof candidate.dataSaver === "boolean"
    && typeof candidate.routeVoiceGuidance === "boolean"
    && (candidate.routeVoiceRate === "slow" || candidate.routeVoiceRate === "normal" || candidate.routeVoiceRate === "fast")
    && typeof candidate.stepFreeRouteEnabled === "boolean"
    && typeof candidate.miniMapHighContrast === "boolean"
    && (candidate.miniMapRouteWeight === "standard" || candidate.miniMapRouteWeight === "bold")
    && typeof candidate.routePatternEnhanced === "boolean";
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
    oneHandedControls: typeof candidate.oneHandedControls === "boolean"
      ? candidate.oneHandedControls
      : false,
    joystickSide: candidate.joystickSide === "right" ? "right" : "left",
    dataSaver: typeof candidate.dataSaver === "boolean" ? candidate.dataSaver : false,
    routeVoiceGuidance: typeof candidate.routeVoiceGuidance === "boolean"
      ? candidate.routeVoiceGuidance
      : false,
    routeVoiceRate: candidate.routeVoiceRate === "slow" || candidate.routeVoiceRate === "fast"
      ? candidate.routeVoiceRate
      : "normal",
    stepFreeRouteEnabled: typeof candidate.stepFreeRouteEnabled === "boolean"
      ? candidate.stepFreeRouteEnabled
      : false,
    miniMapHighContrast: typeof candidate.miniMapHighContrast === "boolean"
      ? candidate.miniMapHighContrast
      : false,
    miniMapRouteWeight: candidate.miniMapRouteWeight === "bold" ? "bold" : "standard",
    routePatternEnhanced: typeof candidate.routePatternEnhanced === "boolean"
      ? candidate.routePatternEnhanced
      : false
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

  if (preferences.oneHandedControls) root.dataset.oneHandedControls = "true";
  else delete root.dataset.oneHandedControls;

  root.dataset.joystickSide = preferences.joystickSide;

  if (preferences.dataSaver) root.dataset.dataSaver = "true";
  else delete root.dataset.dataSaver;

  if (preferences.routeVoiceGuidance) root.dataset.routeVoiceGuidance = "true";
  else delete root.dataset.routeVoiceGuidance;

  if (preferences.miniMapHighContrast) root.dataset.miniMapHighContrast = "true";
  else delete root.dataset.miniMapHighContrast;

  root.dataset.miniMapRouteWeight = preferences.miniMapRouteWeight;

  if (preferences.routePatternEnhanced) root.dataset.routePattern = "enhanced";
  else delete root.dataset.routePattern;
}

export function shouldReduceMotion(
  root: HTMLElement = document.documentElement,
  matchMedia: typeof window.matchMedia | undefined = typeof window === "undefined" ? undefined : window.matchMedia
): boolean {
  if (root.dataset.reduceMotion === "true") return true;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

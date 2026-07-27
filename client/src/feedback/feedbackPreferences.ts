export type FeedbackVolume = "quiet" | "balanced" | "bright";

export type FeedbackPreferences = {
  soundEnabled: boolean;
  effectsEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  volume: FeedbackVolume;
  footstepVolume: FeedbackVolume;
  portalAudioEnabled: boolean;
  portalAudioVolume: FeedbackVolume;
  portalMonoEnabled: boolean;
  portalHapticsEnabled: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const feedbackPreferencesStorageKey = "wedding-game-feedback:v1";
export const defaultFeedbackPreferences: FeedbackPreferences = {
  soundEnabled: false,
  effectsEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
  volume: "balanced",
  footstepVolume: "balanced",
  portalAudioEnabled: true,
  portalAudioVolume: "balanced",
  portalMonoEnabled: false,
  portalHapticsEnabled: false
};

function isFeedbackVolume(value: unknown): value is FeedbackVolume {
  return value === "quiet" || value === "balanced" || value === "bright";
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isFeedbackPreferences(value: unknown): value is FeedbackPreferences {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<FeedbackPreferences>;
  return typeof candidate.soundEnabled === "boolean"
    && typeof candidate.effectsEnabled === "boolean"
    && typeof candidate.musicEnabled === "boolean"
    && typeof candidate.hapticsEnabled === "boolean"
    && isFeedbackVolume(candidate.volume)
    && isFeedbackVolume(candidate.footstepVolume)
    && typeof candidate.portalAudioEnabled === "boolean"
    && isFeedbackVolume(candidate.portalAudioVolume)
    && typeof candidate.portalMonoEnabled === "boolean"
    && typeof candidate.portalHapticsEnabled === "boolean";
}

function migrateFeedbackPreferences(value: unknown): FeedbackPreferences | null {
  if (isFeedbackPreferences(value)) return value;
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<FeedbackPreferences>;
  if (typeof candidate.soundEnabled !== "boolean"
    || typeof candidate.effectsEnabled !== "boolean"
    || typeof candidate.musicEnabled !== "boolean"
    || typeof candidate.hapticsEnabled !== "boolean"
    || !isFeedbackVolume(candidate.volume)) return null;

  const footstepVolume = candidate.footstepVolume === undefined
    ? defaultFeedbackPreferences.footstepVolume
    : isFeedbackVolume(candidate.footstepVolume) ? candidate.footstepVolume : null;
  const portalAudioEnabled = candidate.portalAudioEnabled === undefined
    ? defaultFeedbackPreferences.portalAudioEnabled
    : typeof candidate.portalAudioEnabled === "boolean" ? candidate.portalAudioEnabled : null;
  const portalAudioVolume = candidate.portalAudioVolume === undefined
    ? defaultFeedbackPreferences.portalAudioVolume
    : isFeedbackVolume(candidate.portalAudioVolume) ? candidate.portalAudioVolume : null;
  const portalMonoEnabled = candidate.portalMonoEnabled === undefined
    ? defaultFeedbackPreferences.portalMonoEnabled
    : typeof candidate.portalMonoEnabled === "boolean" ? candidate.portalMonoEnabled : null;
  const portalHapticsEnabled = candidate.portalHapticsEnabled === undefined
    ? defaultFeedbackPreferences.portalHapticsEnabled
    : typeof candidate.portalHapticsEnabled === "boolean" ? candidate.portalHapticsEnabled : null;
  if (!footstepVolume
    || portalAudioEnabled === null
    || !portalAudioVolume
    || portalMonoEnabled === null
    || portalHapticsEnabled === null) return null;

  return {
    soundEnabled: candidate.soundEnabled,
    effectsEnabled: candidate.effectsEnabled,
    musicEnabled: candidate.musicEnabled,
    hapticsEnabled: candidate.hapticsEnabled,
    volume: candidate.volume,
    footstepVolume,
    portalAudioEnabled,
    portalAudioVolume,
    portalMonoEnabled,
    portalHapticsEnabled
  };
}

export function loadFeedbackPreferences(
  storage: StorageLike | null = browserStorage()
): FeedbackPreferences {
  try {
    const stored = storage?.getItem(feedbackPreferencesStorageKey);
    if (!stored) return defaultFeedbackPreferences;
    const parsed: unknown = JSON.parse(stored);
    return migrateFeedbackPreferences(parsed) ?? defaultFeedbackPreferences;
  } catch {
    return defaultFeedbackPreferences;
  }
}

export function saveFeedbackPreferences(
  preferences: FeedbackPreferences,
  storage: StorageLike | null = browserStorage()
): boolean {
  try {
    storage?.setItem(feedbackPreferencesStorageKey, JSON.stringify(preferences));
    return storage !== null;
  } catch {
    return false;
  }
}

export const destinationVoicePreferencesStorageKey = "wedding-game:destination-voice-preferences:v1";
export const destinationVoiceProfileIds = ["standard", "short", "custom"] as const;
export type DestinationVoiceProfileId = (typeof destinationVoiceProfileIds)[number];

export type DestinationVoicePreferences = {
  profileId: DestinationVoiceProfileId;
  movePhrase: string;
  nextPhrase: string;
  cancelPhrase: string;
  repeatPhrase: string;
};

type VoicePreferencesStorage = Pick<Storage, "getItem" | "setItem">;

export const defaultDestinationVoicePreferences: DestinationVoicePreferences = {
  profileId: "standard",
  movePhrase: "이동",
  nextPhrase: "다음",
  cancelPhrase: "취소",
  repeatPhrase: "반복"
};

export const destinationVoiceProfilePresets: Record<Exclude<DestinationVoiceProfileId, "custom">, DestinationVoicePreferences> = {
  standard: defaultDestinationVoicePreferences,
  short: {
    profileId: "short",
    movePhrase: "가자",
    nextPhrase: "넘겨",
    cancelPhrase: "멈춰",
    repeatPhrase: "다시"
  }
};

function browserStorage(): VoicePreferencesStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function normalizePhrase(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 12) || fallback;
}

export function normalizeDestinationVoicePreferences(value: unknown): DestinationVoicePreferences {
  const candidate = value && typeof value === "object" ? value as Partial<DestinationVoicePreferences> : {};
  return {
    profileId: destinationVoiceProfileIds.includes(candidate.profileId as DestinationVoiceProfileId)
      ? candidate.profileId as DestinationVoiceProfileId
      : defaultDestinationVoicePreferences.profileId,
    movePhrase: normalizePhrase(candidate.movePhrase, defaultDestinationVoicePreferences.movePhrase),
    nextPhrase: normalizePhrase(candidate.nextPhrase, defaultDestinationVoicePreferences.nextPhrase),
    cancelPhrase: normalizePhrase(candidate.cancelPhrase, defaultDestinationVoicePreferences.cancelPhrase),
    repeatPhrase: normalizePhrase(candidate.repeatPhrase, defaultDestinationVoicePreferences.repeatPhrase)
  };
}

export function destinationVoicePreferencesForProfile(
  profileId: DestinationVoiceProfileId,
  current: DestinationVoicePreferences
) {
  if (profileId === "custom") return { ...current, profileId };
  return destinationVoiceProfilePresets[profileId];
}

export function loadDestinationVoicePreferences(
  storage: VoicePreferencesStorage | null = browserStorage()
) {
  try {
    const stored = storage?.getItem(destinationVoicePreferencesStorageKey);
    return stored ? normalizeDestinationVoicePreferences(JSON.parse(stored)) : defaultDestinationVoicePreferences;
  } catch {
    return defaultDestinationVoicePreferences;
  }
}

export function saveDestinationVoicePreferences(
  preferences: DestinationVoicePreferences,
  storage: VoicePreferencesStorage | null = browserStorage()
) {
  try {
    storage?.setItem(destinationVoicePreferencesStorageKey, JSON.stringify(normalizeDestinationVoicePreferences(preferences)));
    return storage !== null;
  } catch {
    return false;
  }
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { WorldZoneId } from "@wedding-game/shared";
import {
  defaultFeedbackPreferences,
  loadFeedbackPreferences,
  saveFeedbackPreferences,
  type FeedbackPreferences,
  type FeedbackVolume
} from "./feedbackPreferences";
import { GameAudioEngine, triggerHaptic, type FeedbackCue } from "./gameAudio";

type GameFeedbackContextValue = {
  preferences: FeedbackPreferences;
  setSoundEnabled: (enabled: boolean) => void;
  setEffectsEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setVolume: (volume: FeedbackVolume) => void;
  resetFeedbackPreferences: () => void;
  playFeedback: (cue: FeedbackCue) => void;
  setFeedbackZone: (zoneId: WorldZoneId) => void;
};

const GameFeedbackContext = createContext<GameFeedbackContextValue>({
  preferences: defaultFeedbackPreferences,
  setSoundEnabled: () => undefined,
  setEffectsEnabled: () => undefined,
  setMusicEnabled: () => undefined,
  setHapticsEnabled: () => undefined,
  setVolume: () => undefined,
  resetFeedbackPreferences: () => undefined,
  playFeedback: () => undefined,
  setFeedbackZone: () => undefined
});

type GameFeedbackProviderProps = {
  children: ReactNode;
  initialPreferences?: FeedbackPreferences;
};

export function GameFeedbackProvider({ children, initialPreferences }: GameFeedbackProviderProps) {
  const [preferences, setPreferences] = useState(() => initialPreferences ?? loadFeedbackPreferences());
  const preferencesRef = useRef(preferences);
  const engineRef = useRef<GameAudioEngine | null>(null);
  const zoneRef = useRef<WorldZoneId>("home");

  const getEngine = useCallback(() => {
    engineRef.current ??= new GameAudioEngine(preferencesRef.current);
    engineRef.current.setZone(zoneRef.current);
    return engineRef.current;
  }, []);

  const applyPreferences = useCallback((next: FeedbackPreferences) => {
    preferencesRef.current = next;
    saveFeedbackPreferences(next);
    setPreferences(next);
    engineRef.current?.configure(next);
  }, []);

  const activateAndPlay = useCallback(async (cue?: FeedbackCue) => {
    const engine = getEngine();
    if (await engine.unlock()) {
      engine.configure(preferencesRef.current);
      if (cue) engine.playCue(cue);
    }
  }, [getEngine]);

  useEffect(() => {
    if (!preferences.soundEnabled) return;
    const unlock = () => { void activateAndPlay(); };
    document.addEventListener("pointerdown", unlock, { capture: true, once: true });
    document.addEventListener("keydown", unlock, { capture: true, once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock, { capture: true });
      document.removeEventListener("keydown", unlock, { capture: true });
    };
  }, [activateAndPlay, preferences.soundEnabled]);

  useEffect(() => {
    const updateVisibility = () => engineRef.current?.setVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => () => engineRef.current?.dispose(), []);

  const value = useMemo<GameFeedbackContextValue>(() => ({
    preferences,
    setSoundEnabled: (enabled) => {
      const next = { ...preferencesRef.current, soundEnabled: enabled };
      applyPreferences(next);
      if (enabled) void activateAndPlay("tap");
    },
    setEffectsEnabled: (enabled) => {
      const next = { ...preferencesRef.current, effectsEnabled: enabled };
      applyPreferences(next);
      if (enabled && next.soundEnabled) void activateAndPlay("tap");
    },
    setMusicEnabled: (enabled) => {
      const next = { ...preferencesRef.current, musicEnabled: enabled };
      applyPreferences(next);
      if (enabled && next.soundEnabled) void activateAndPlay();
    },
    setHapticsEnabled: (enabled) => {
      const next = { ...preferencesRef.current, hapticsEnabled: enabled };
      applyPreferences(next);
      if (enabled) triggerHaptic("tap");
    },
    setVolume: (volume) => {
      const next = { ...preferencesRef.current, volume };
      applyPreferences(next);
      if (next.soundEnabled) void activateAndPlay("tap");
    },
    resetFeedbackPreferences: () => applyPreferences(defaultFeedbackPreferences),
    playFeedback: (cue) => {
      const current = preferencesRef.current;
      if (current.hapticsEnabled) triggerHaptic(cue);
      if (current.soundEnabled) void activateAndPlay(cue);
    },
    setFeedbackZone: (zoneId) => {
      zoneRef.current = zoneId;
      engineRef.current?.setZone(zoneId);
    }
  }), [activateAndPlay, applyPreferences, preferences]);

  return <GameFeedbackContext.Provider value={value}>{children}</GameFeedbackContext.Provider>;
}

export function useGameFeedback(): GameFeedbackContextValue {
  return useContext(GameFeedbackContext);
}

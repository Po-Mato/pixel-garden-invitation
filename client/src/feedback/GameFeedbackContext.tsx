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
import type { PortalAudioMix } from "../game/portalAudio";
import {
  defaultFeedbackPreferences,
  loadFeedbackPreferences,
  saveFeedbackPreferences,
  type FeedbackPreferences,
  type FeedbackVolume
} from "./feedbackPreferences";
import {
  GameAudioEngine,
  triggerHaptic,
  type FeedbackCue,
  type FeedbackCueOptions
} from "./gameAudio";

type GameFeedbackContextValue = {
  preferences: FeedbackPreferences;
  setSoundEnabled: (enabled: boolean) => void;
  setEffectsEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setVolume: (volume: FeedbackVolume) => void;
  setFootstepVolume: (volume: FeedbackVolume) => void;
  setPortalAudioEnabled: (enabled: boolean) => void;
  setPortalAudioVolume: (volume: FeedbackVolume) => void;
  previewPortalAudio: () => void;
  resetFeedbackPreferences: () => void;
  playFeedback: (cue: FeedbackCue, options?: FeedbackCueOptions) => void;
  setFeedbackZone: (zoneId: WorldZoneId) => void;
  setPortalAudio: (mix: PortalAudioMix | null) => void;
};

const GameFeedbackContext = createContext<GameFeedbackContextValue>({
  preferences: defaultFeedbackPreferences,
  setSoundEnabled: () => undefined,
  setEffectsEnabled: () => undefined,
  setMusicEnabled: () => undefined,
  setHapticsEnabled: () => undefined,
  setVolume: () => undefined,
  setFootstepVolume: () => undefined,
  setPortalAudioEnabled: () => undefined,
  setPortalAudioVolume: () => undefined,
  previewPortalAudio: () => undefined,
  resetFeedbackPreferences: () => undefined,
  playFeedback: () => undefined,
  setFeedbackZone: () => undefined,
  setPortalAudio: () => undefined
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
  const portalAudioRef = useRef<PortalAudioMix | null>(null);

  const getEngine = useCallback(() => {
    engineRef.current ??= new GameAudioEngine(preferencesRef.current);
    engineRef.current.setZone(zoneRef.current);
    engineRef.current.setPortalAudio(portalAudioRef.current);
    return engineRef.current;
  }, []);

  const applyPreferences = useCallback((next: FeedbackPreferences) => {
    preferencesRef.current = next;
    saveFeedbackPreferences(next);
    setPreferences(next);
    engineRef.current?.configure(next);
  }, []);

  const activateAndPlay = useCallback(async (cue?: FeedbackCue, options?: FeedbackCueOptions) => {
    const engine = getEngine();
    if (await engine.unlock()) {
      engine.configure(preferencesRef.current);
      if (cue) engine.playCue(cue, options);
    }
  }, [getEngine]);

  const activateAndPreviewPortal = useCallback(async () => {
    const engine = getEngine();
    if (await engine.unlock()) {
      engine.configure(preferencesRef.current);
      engine.previewPortalAudio();
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
    setFootstepVolume: (footstepVolume) => {
      const next = { ...preferencesRef.current, footstepVolume };
      applyPreferences(next);
      if (next.soundEnabled && next.effectsEnabled) {
        void activateAndPlay("footstep", { surface: "wood", foot: "right" });
      }
    },
    setPortalAudioEnabled: (portalAudioEnabled) => {
      const next = { ...preferencesRef.current, portalAudioEnabled };
      applyPreferences(next);
      if (portalAudioEnabled && next.soundEnabled && next.effectsEnabled) {
        void activateAndPreviewPortal();
      }
    },
    setPortalAudioVolume: (portalAudioVolume) => {
      const next = { ...preferencesRef.current, portalAudioVolume };
      applyPreferences(next);
      if (next.soundEnabled && next.effectsEnabled && next.portalAudioEnabled) {
        void activateAndPreviewPortal();
      }
    },
    previewPortalAudio: () => {
      const current = preferencesRef.current;
      if (current.soundEnabled && current.effectsEnabled && current.portalAudioEnabled) {
        void activateAndPreviewPortal();
      }
    },
    resetFeedbackPreferences: () => applyPreferences(defaultFeedbackPreferences),
    playFeedback: (cue, options) => {
      const current = preferencesRef.current;
      if (current.hapticsEnabled) triggerHaptic(cue);
      if (current.soundEnabled) void activateAndPlay(cue, options);
    },
    setFeedbackZone: (zoneId) => {
      zoneRef.current = zoneId;
      engineRef.current?.setZone(zoneId);
    },
    setPortalAudio: (mix) => {
      portalAudioRef.current = mix;
      engineRef.current?.setPortalAudio(mix);
    }
  }), [activateAndPlay, activateAndPreviewPortal, applyPreferences, preferences]);

  return <GameFeedbackContext.Provider value={value}>{children}</GameFeedbackContext.Provider>;
}

export function useGameFeedback(): GameFeedbackContextValue {
  return useContext(GameFeedbackContext);
}

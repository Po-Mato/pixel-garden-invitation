import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  applyViewPreferences,
  comfortableViewPreferences,
  defaultViewPreferences,
  loadViewPreferences,
  saveViewPreferences,
  type ViewPreferences
} from "./viewPreferences";

type ViewPreferencesContextValue = {
  preferences: ViewPreferences;
  setTextScale: (textScale: ViewPreferences["textScale"]) => void;
  setReduceMotion: (reduceMotion: boolean) => void;
  setHighContrast: (highContrast: boolean) => void;
  setComfortableControls: (comfortableControls: boolean) => void;
  enableComfortableView: () => void;
  resetPreferences: () => void;
};

const ViewPreferencesContext = createContext<ViewPreferencesContextValue>({
  preferences: defaultViewPreferences,
  setTextScale: () => undefined,
  setReduceMotion: () => undefined,
  setHighContrast: () => undefined,
  setComfortableControls: () => undefined,
  enableComfortableView: () => undefined,
  resetPreferences: () => undefined
});

type ViewPreferencesProviderProps = {
  children: ReactNode;
  initialPreferences?: ViewPreferences;
};

export function ViewPreferencesProvider({ children, initialPreferences }: ViewPreferencesProviderProps) {
  const [preferences, setPreferences] = useState(() => initialPreferences ?? loadViewPreferences());

  useLayoutEffect(() => {
    applyViewPreferences(preferences);
    saveViewPreferences(preferences);
  }, [preferences]);

  const value = useMemo<ViewPreferencesContextValue>(() => ({
    preferences,
    setTextScale: (textScale) => setPreferences((current) => ({ ...current, textScale })),
    setReduceMotion: (reduceMotion) => setPreferences((current) => ({ ...current, reduceMotion })),
    setHighContrast: (highContrast) => setPreferences((current) => ({ ...current, highContrast })),
    setComfortableControls: (comfortableControls) => setPreferences((current) => ({
      ...current,
      comfortableControls
    })),
    enableComfortableView: () => setPreferences(comfortableViewPreferences),
    resetPreferences: () => setPreferences(defaultViewPreferences)
  }), [preferences]);

  return <ViewPreferencesContext.Provider value={value}>{children}</ViewPreferencesContext.Provider>;
}

export function useViewPreferences(): ViewPreferencesContextValue {
  return useContext(ViewPreferencesContext);
}

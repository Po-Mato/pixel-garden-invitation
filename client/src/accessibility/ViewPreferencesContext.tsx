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
  defaultViewPreferences,
  loadViewPreferences,
  saveViewPreferences,
  type ViewPreferences
} from "./viewPreferences";

type ViewPreferencesContextValue = {
  preferences: ViewPreferences;
  setTextScale: (textScale: ViewPreferences["textScale"]) => void;
  setReduceMotion: (reduceMotion: boolean) => void;
};

const ViewPreferencesContext = createContext<ViewPreferencesContextValue>({
  preferences: defaultViewPreferences,
  setTextScale: () => undefined,
  setReduceMotion: () => undefined
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
    setReduceMotion: (reduceMotion) => setPreferences((current) => ({ ...current, reduceMotion }))
  }), [preferences]);

  return <ViewPreferencesContext.Provider value={value}>{children}</ViewPreferencesContext.Provider>;
}

export function useViewPreferences(): ViewPreferencesContextValue {
  return useContext(ViewPreferencesContext);
}

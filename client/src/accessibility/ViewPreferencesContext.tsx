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
  setOneHandedControls: (oneHandedControls: boolean) => void;
  setJoystickSide: (joystickSide: ViewPreferences["joystickSide"]) => void;
  setDataSaver: (dataSaver: boolean) => void;
  setRouteVoiceGuidance: (routeVoiceGuidance: boolean) => void;
  setRouteVoiceRate: (routeVoiceRate: ViewPreferences["routeVoiceRate"]) => void;
  setRouteVoiceDetail: (routeVoiceDetail: ViewPreferences["routeVoiceDetail"]) => void;
  setColorVisionMode: (colorVisionMode: ViewPreferences["colorVisionMode"]) => void;
  setStepFreeRouteEnabled: (stepFreeRouteEnabled: boolean) => void;
  setMiniMapHighContrast: (miniMapHighContrast: boolean) => void;
  setMiniMapRouteWeight: (miniMapRouteWeight: ViewPreferences["miniMapRouteWeight"]) => void;
  setRoutePatternEnhanced: (routePatternEnhanced: boolean) => void;
  setGameMovementSpeed: (gameMovementSpeed: ViewPreferences["gameMovementSpeed"]) => void;
  setGameUiScale: (gameUiScale: ViewPreferences["gameUiScale"]) => void;
  enableComfortableView: () => void;
  resetPreferences: () => void;
};

const ViewPreferencesContext = createContext<ViewPreferencesContextValue>({
  preferences: defaultViewPreferences,
  setTextScale: () => undefined,
  setReduceMotion: () => undefined,
  setHighContrast: () => undefined,
  setComfortableControls: () => undefined,
  setOneHandedControls: () => undefined,
  setJoystickSide: () => undefined,
  setDataSaver: () => undefined,
  setRouteVoiceGuidance: () => undefined,
  setRouteVoiceRate: () => undefined,
  setRouteVoiceDetail: () => undefined,
  setColorVisionMode: () => undefined,
  setStepFreeRouteEnabled: () => undefined,
  setMiniMapHighContrast: () => undefined,
  setMiniMapRouteWeight: () => undefined,
  setRoutePatternEnhanced: () => undefined,
  setGameMovementSpeed: () => undefined,
  setGameUiScale: () => undefined,
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
    setOneHandedControls: (oneHandedControls) => setPreferences((current) => ({
      ...current,
      oneHandedControls
    })),
    setJoystickSide: (joystickSide) => setPreferences((current) => ({ ...current, joystickSide })),
    setDataSaver: (dataSaver) => setPreferences((current) => ({ ...current, dataSaver })),
    setRouteVoiceGuidance: (routeVoiceGuidance) => setPreferences((current) => ({
      ...current,
      routeVoiceGuidance
    })),
    setRouteVoiceRate: (routeVoiceRate) => setPreferences((current) => ({ ...current, routeVoiceRate })),
    setRouteVoiceDetail: (routeVoiceDetail) => setPreferences((current) => ({ ...current, routeVoiceDetail })),
    setColorVisionMode: (colorVisionMode) => setPreferences((current) => ({ ...current, colorVisionMode })),
    setStepFreeRouteEnabled: (stepFreeRouteEnabled) => setPreferences((current) => ({
      ...current,
      stepFreeRouteEnabled
    })),
    setMiniMapHighContrast: (miniMapHighContrast) => setPreferences((current) => ({
      ...current,
      miniMapHighContrast
    })),
    setMiniMapRouteWeight: (miniMapRouteWeight) => setPreferences((current) => ({
      ...current,
      miniMapRouteWeight
    })),
    setRoutePatternEnhanced: (routePatternEnhanced) => setPreferences((current) => ({
      ...current,
      routePatternEnhanced
    })),
    setGameMovementSpeed: (gameMovementSpeed) => setPreferences((current) => ({
      ...current,
      gameMovementSpeed
    })),
    setGameUiScale: (gameUiScale) => setPreferences((current) => ({ ...current, gameUiScale })),
    enableComfortableView: () => setPreferences((current) => ({
      ...comfortableViewPreferences,
      dataSaver: current.dataSaver,
      routeVoiceGuidance: current.routeVoiceGuidance,
      routeVoiceRate: current.routeVoiceRate,
      routeVoiceDetail: current.routeVoiceDetail,
      colorVisionMode: current.colorVisionMode
    })),
    resetPreferences: () => setPreferences(defaultViewPreferences)
  }), [preferences]);

  return <ViewPreferencesContext.Provider value={value}>{children}</ViewPreferencesContext.Provider>;
}

export function useViewPreferences(): ViewPreferencesContextValue {
  return useContext(ViewPreferencesContext);
}

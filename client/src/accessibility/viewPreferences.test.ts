import { describe, expect, it, vi } from "vitest";
import {
  applyViewPreferences,
  defaultViewPreferences,
  loadViewPreferences,
  saveViewPreferences,
  shouldReduceMotion,
  viewPreferencesStorageKey
} from "./viewPreferences";

function storage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => { value = next; })
  };
}

describe("보기 설정 저장", () => {
  it("검증된 설정만 불러오고 손상된 값은 기본값으로 복구한다", () => {
    expect(loadViewPreferences(storage(JSON.stringify({ textScale: "large", reduceMotion: true }))))
      .toEqual({
        textScale: "large",
        reduceMotion: true,
        highContrast: false,
        comfortableControls: false,
        oneHandedControls: false,
        joystickSide: "left",
        dataSaver: false,
        routeVoiceGuidance: false,
        routeVoiceRate: "normal",
        routeVoiceDetail: "brief",
        colorVisionMode: "standard",
        stepFreeRouteEnabled: false,
        miniMapHighContrast: false,
        miniMapRouteWeight: "standard",
        routePatternEnhanced: false,
        gameMovementSpeed: "normal",
        cameraTracking: "steady",
        gameUiScale: "standard"
      });
    expect(loadViewPreferences(storage(JSON.stringify({
      textScale: "xlarge",
      reduceMotion: true,
      highContrast: true,
      comfortableControls: true,
      oneHandedControls: false,
      joystickSide: "left",
      dataSaver: true,
      routeVoiceGuidance: false,
      routeVoiceRate: "normal",
      routeVoiceDetail: "brief",
      colorVisionMode: "standard",
      stepFreeRouteEnabled: false,
      miniMapHighContrast: false,
      miniMapRouteWeight: "standard",
      routePatternEnhanced: false,
      gameMovementSpeed: "normal",
      cameraTracking: "responsive",
      gameUiScale: "standard"
    })))).toEqual({
      textScale: "xlarge",
      reduceMotion: true,
      highContrast: true,
      comfortableControls: true,
      oneHandedControls: false,
      joystickSide: "left",
      dataSaver: true,
      routeVoiceGuidance: false,
      routeVoiceRate: "normal",
      routeVoiceDetail: "brief",
      colorVisionMode: "standard",
      stepFreeRouteEnabled: false,
      miniMapHighContrast: false,
      miniMapRouteWeight: "standard",
      routePatternEnhanced: false,
      gameMovementSpeed: "normal",
      cameraTracking: "responsive",
      gameUiScale: "standard"
    });
    expect(loadViewPreferences(storage("{broken"))).toEqual(defaultViewPreferences);
    expect(loadViewPreferences(storage(JSON.stringify({ textScale: "huge", reduceMotion: true }))))
      .toEqual(defaultViewPreferences);
  });

  it("기기 저장소에 버전 키로 저장한다", () => {
    const target = storage();
    const preferences = {
      textScale: "large" as const,
      reduceMotion: true,
      highContrast: true,
      comfortableControls: true,
      oneHandedControls: true,
      joystickSide: "right" as const,
      dataSaver: true,
      routeVoiceGuidance: true,
      routeVoiceRate: "fast" as const,
      routeVoiceDetail: "detailed" as const,
      colorVisionMode: "deuteranopia" as const,
      stepFreeRouteEnabled: true,
      miniMapHighContrast: true,
      miniMapRouteWeight: "bold" as const,
      routePatternEnhanced: true,
      gameMovementSpeed: "brisk" as const,
      cameraTracking: "responsive" as const,
      gameUiScale: "large" as const
    };
    expect(saveViewPreferences(preferences, target)).toBe(true);
    expect(target.setItem).toHaveBeenCalledWith(
      viewPreferencesStorageKey,
      JSON.stringify(preferences)
    );
  });

  it("문서 속성과 시스템 모션 설정을 함께 반영한다", () => {
    const root = document.createElement("html");
    applyViewPreferences({
      textScale: "xlarge",
      reduceMotion: true,
      highContrast: true,
      comfortableControls: true,
      oneHandedControls: true,
      joystickSide: "right",
      dataSaver: true,
      routeVoiceGuidance: true,
      routeVoiceRate: "slow",
      routeVoiceDetail: "detailed",
      colorVisionMode: "tritanopia",
      stepFreeRouteEnabled: true,
      miniMapHighContrast: true,
      miniMapRouteWeight: "bold",
      routePatternEnhanced: true,
      gameMovementSpeed: "relaxed",
      cameraTracking: "responsive",
      gameUiScale: "large"
    }, root);
    expect(root).toHaveAttribute("data-text-scale", "xlarge");
    expect(root).toHaveAttribute("data-reduce-motion", "true");
    expect(root).toHaveAttribute("data-high-contrast", "true");
    expect(root).toHaveAttribute("data-comfortable-controls", "true");
    expect(root).toHaveAttribute("data-one-handed-controls", "true");
    expect(root).toHaveAttribute("data-joystick-side", "right");
    expect(root).toHaveAttribute("data-data-saver", "true");
    expect(root).toHaveAttribute("data-route-voice-guidance", "true");
    expect(root).toHaveAttribute("data-color-vision", "tritanopia");
    expect(root).toHaveAttribute("data-mini-map-high-contrast", "true");
    expect(root).toHaveAttribute("data-mini-map-route-weight", "bold");
    expect(root).toHaveAttribute("data-route-pattern", "enhanced");
    expect(root).toHaveAttribute("data-game-movement-speed", "relaxed");
    expect(root).toHaveAttribute("data-camera-tracking", "responsive");
    expect(root).toHaveAttribute("data-game-ui-scale", "large");
    expect(shouldReduceMotion(root, vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia)).toBe(true);

    applyViewPreferences(defaultViewPreferences, root);
    expect(root).not.toHaveAttribute("data-text-scale");
    expect(root).not.toHaveAttribute("data-reduce-motion");
    expect(root).not.toHaveAttribute("data-high-contrast");
    expect(root).not.toHaveAttribute("data-comfortable-controls");
    expect(root).not.toHaveAttribute("data-one-handed-controls");
    expect(root).toHaveAttribute("data-joystick-side", "left");
    expect(root).not.toHaveAttribute("data-data-saver");
    expect(root).not.toHaveAttribute("data-route-voice-guidance");
    expect(root).not.toHaveAttribute("data-color-vision");
    expect(root).not.toHaveAttribute("data-mini-map-high-contrast");
    expect(root).toHaveAttribute("data-mini-map-route-weight", "standard");
    expect(root).not.toHaveAttribute("data-route-pattern");
    expect(root).toHaveAttribute("data-game-movement-speed", "normal");
    expect(root).toHaveAttribute("data-camera-tracking", "steady");
    expect(root).toHaveAttribute("data-game-ui-scale", "standard");
    expect(shouldReduceMotion(root, vi.fn(() => ({ matches: true })) as unknown as typeof window.matchMedia)).toBe(true);
  });
});

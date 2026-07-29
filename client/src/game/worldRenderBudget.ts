import type {
  DeviceEffectsQuality,
  DevicePerformanceMode
} from "../performance/DevicePerformanceContext";

export type WorldRenderBudget = {
  targetFps: 60 | 30 | 24;
  npcMotionIntervalMs: number;
  remoteGuestLimit: number;
  ambientMotion: "full" | "reduced" | "minimal";
};

export function resolveWorldRenderBudget(
  mode: DevicePerformanceMode,
  effectsQuality: DeviceEffectsQuality
): WorldRenderBudget {
  if (mode === "lite" || effectsQuality === "minimal") {
    return {
      targetFps: 24,
      npcMotionIntervalMs: 1_200,
      remoteGuestLimit: 6,
      ambientMotion: "minimal"
    };
  }
  if (effectsQuality === "reduced") {
    return {
      targetFps: 30,
      npcMotionIntervalMs: 900,
      remoteGuestLimit: 12,
      ambientMotion: "reduced"
    };
  }
  return {
    targetFps: 60,
    npcMotionIntervalMs: 720,
    remoteGuestLimit: 24,
    ambientMotion: "full"
  };
}

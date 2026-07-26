export const walkTileSizePx = 30;
export const walkInputInitialDelayMs = 300;
export const walkStepIntervalMs = 240;
export const neutralWalkFrame = 1;
export const walkFrameSequence = [0, 1, 2, 1] as const;
export const walkLandingFrames = [0, 2] as const;

const minimumTileSpeedPxPerSecond = 100;
const maximumTileSpeedPxPerSecond = 150;
const minimumStrideCycleMs = 800;
const maximumStrideCycleMs = 1_100;
const maximumInitialDelayRatio = 1.25;

export type WalkTimingConfig = {
  tileSizePx: number;
  initialDelayMs: number;
  stepIntervalMs: number;
  frameSequence: readonly number[];
};

export type WalkTimingAudit = {
  tileSpeedPxPerSecond: number;
  footfallCadencePerMinute: number;
  strideCycleMs: number;
  neutralBetweenOppositeFeet: boolean;
  startsOnStrideFrame: boolean;
  returnsToNeutralBeforeLoop: boolean;
  landingFeedbacksPerCycle: number;
  landingIntervalMs: number;
  landingFeedbackSynchronized: boolean;
  initialDelayRatio: number;
  passed: boolean;
};

export const defaultWalkTiming: WalkTimingConfig = {
  tileSizePx: walkTileSizePx,
  initialDelayMs: walkInputInitialDelayMs,
  stepIntervalMs: walkStepIntervalMs,
  frameSequence: walkFrameSequence
};

export function walkFrameForPhase(phase: number): number {
  const normalized = ((phase % walkFrameSequence.length) + walkFrameSequence.length)
    % walkFrameSequence.length;
  return walkFrameSequence[normalized];
}

export function advanceWalkPhase(phase: number): { frame: number; nextPhase: number } {
  return {
    frame: walkFrameForPhase(phase),
    nextPhase: phase + 1
  };
}

export function isWalkLandingFrame(frame: number): boolean {
  return walkLandingFrames.some((landingFrame) => landingFrame === frame);
}

export function auditWalkTiming(config: WalkTimingConfig = defaultWalkTiming): WalkTimingAudit {
  const { tileSizePx, initialDelayMs, stepIntervalMs, frameSequence } = config;
  const tileSpeedPxPerSecond = stepIntervalMs > 0 ? (tileSizePx * 1_000) / stepIntervalMs : 0;
  const strideCycleMs = stepIntervalMs * frameSequence.length;
  const footfallCadencePerMinute = strideCycleMs > 0 ? (60_000 / strideCycleMs) * 2 : 0;
  const initialDelayRatio = stepIntervalMs > 0 ? initialDelayMs / stepIntervalMs : Number.POSITIVE_INFINITY;
  const neutralBetweenOppositeFeet = frameSequence.length === 4
    && frameSequence[0] === 0
    && frameSequence[1] === neutralWalkFrame
    && frameSequence[2] === 2
    && frameSequence[3] === neutralWalkFrame;
  const startsOnStrideFrame = frameSequence[0] === 0 || frameSequence[0] === 2;
  const returnsToNeutralBeforeLoop = frameSequence.at(-1) === neutralWalkFrame;
  const landingPhaseIndexes = frameSequence
    .map((frame, index) => isWalkLandingFrame(frame) ? index : -1)
    .filter((index) => index >= 0);
  const landingFeedbacksPerCycle = landingPhaseIndexes.length;
  const landingIntervalMs = landingFeedbacksPerCycle === 2
    ? (landingPhaseIndexes[1] - landingPhaseIndexes[0]) * stepIntervalMs
    : 0;
  const landingFeedbackSynchronized = landingFeedbacksPerCycle === 2
    && landingPhaseIndexes[0] === 0
    && landingPhaseIndexes[1] === 2
    && landingIntervalMs * 2 === strideCycleMs;
  const passed = Number.isFinite(tileSpeedPxPerSecond)
    && tileSpeedPxPerSecond >= minimumTileSpeedPxPerSecond
    && tileSpeedPxPerSecond <= maximumTileSpeedPxPerSecond
    && strideCycleMs >= minimumStrideCycleMs
    && strideCycleMs <= maximumStrideCycleMs
    && initialDelayRatio >= 1
    && initialDelayRatio <= maximumInitialDelayRatio
    && neutralBetweenOppositeFeet
    && startsOnStrideFrame
    && returnsToNeutralBeforeLoop
    && landingFeedbackSynchronized;

  return {
    tileSpeedPxPerSecond,
    footfallCadencePerMinute,
    strideCycleMs,
    neutralBetweenOppositeFeet,
    startsOnStrideFrame,
    returnsToNeutralBeforeLoop,
    landingFeedbacksPerCycle,
    landingIntervalMs,
    landingFeedbackSynchronized,
    initialDelayRatio,
    passed
  };
}

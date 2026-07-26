import { describe, expect, it } from "vitest";
import {
  advanceWalkPhase,
  auditWalkTiming,
  defaultWalkTiming,
  isWalkLandingFrame,
  neutralWalkFrame,
  walkFrameForPhase
} from "./walkTiming";

describe("walk timing audit", () => {
  it("keeps the approved tile speed and alternating foot cadence", () => {
    const audit = auditWalkTiming();

    expect(audit).toMatchObject({
      tileSpeedPxPerSecond: 125,
      footfallCadencePerMinute: 125,
      strideCycleMs: 960,
      neutralBetweenOppositeFeet: true,
      startsOnStrideFrame: true,
      returnsToNeutralBeforeLoop: true,
      landingFeedbacksPerCycle: 2,
      landingIntervalMs: 480,
      landingFeedbackSynchronized: true,
      initialDelayRatio: 1.25,
      passed: true
    });
  });

  it("emits landing feedback only for right-foot and left-foot frames", () => {
    expect(Array.from({ length: 8 }, (_, phase) => isWalkLandingFrame(walkFrameForPhase(phase))))
      .toEqual([true, false, true, false, true, false, true, false]);
  });

  it("cycles right foot, neutral, left foot, neutral without skipping", () => {
    expect(Array.from({ length: 9 }, (_, phase) => walkFrameForPhase(phase)))
      .toEqual([0, 1, 2, 1, 0, 1, 2, 1, 0]);
    expect(walkFrameForPhase(-1)).toBe(neutralWalkFrame);
    expect(advanceWalkPhase(2)).toEqual({ frame: 2, nextPhase: 3 });
  });

  it("fails when opposite stride frames touch without a neutral frame", () => {
    expect(auditWalkTiming({
      ...defaultWalkTiming,
      frameSequence: [0, 2, 1]
    })).toMatchObject({
      neutralBetweenOppositeFeet: false,
      passed: false
    });
  });

  it("fails when tile travel is too fast for the sprite cadence", () => {
    expect(auditWalkTiming({
      ...defaultWalkTiming,
      stepIntervalMs: 120
    })).toMatchObject({
      tileSpeedPxPerSecond: 250,
      passed: false
    });
  });
});

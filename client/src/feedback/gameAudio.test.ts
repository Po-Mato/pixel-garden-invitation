import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultFeedbackPreferences } from "./feedbackPreferences";
import { GameAudioEngine, triggerHaptic } from "./gameAudio";

class FakeAudioParam {
  readonly values: number[] = [];
  setValueAtTime(value: number) { this.values.push(value); }
  exponentialRampToValueAtTime(value: number) { this.values.push(value); }
}

class FakeOscillator extends EventTarget {
  readonly frequency = new FakeAudioParam();
  type: OscillatorType = "sine";
  starts: number[] = [];
  stops: number[] = [];
  connect() { return undefined; }
  start(at: number) { this.starts.push(at); }
  stop(at = 0) { this.stops.push(at); }
}

class FakeGain {
  readonly gain = new FakeAudioParam();
  connect() { return undefined; }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  readonly destination = {};
  readonly oscillators: FakeOscillator[] = [];
  currentTime = 10;
  state: AudioContextState = "running";

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain() { return new FakeGain(); }
  resume() { this.state = "running"; return Promise.resolve(); }
  close() { this.state = "closed"; return Promise.resolve(); }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeAudioContext.instances = [];
});

describe("GameAudioEngine", () => {
  it("creates a distinct three-note stamp cue after user activation", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false
    });

    expect(await engine.unlock()).toBe(true);
    engine.playCue("stamp");

    const context = FakeAudioContext.instances[0];
    expect(context.oscillators).toHaveLength(3);
    expect(context.oscillators.map((oscillator) => oscillator.frequency.values[0]))
      .toEqual([523.25, 659.25, 783.99]);

    engine.configure({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      effectsEnabled: false,
      musicEnabled: false
    });
    engine.playCue("reaction");
    expect(context.oscillators).toHaveLength(3);
  });

  it("plays a longer four-note celebration for journey completion", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false
    });

    await engine.unlock();
    engine.playCue("complete");

    const context = FakeAudioContext.instances[0];
    expect(context.oscillators.map((oscillator) => oscillator.frequency.values[0]))
      .toEqual([392, 523.25, 659.25, 783.99]);
  });

  it("plays a crisp two-note shutter cue for a photo", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false
    });

    await engine.unlock();
    engine.playCue("photo");

    const context = FakeAudioContext.instances[0];
    expect(context.oscillators.map((oscillator) => oscillator.frequency.values[0]))
      .toEqual([880, 1174.66]);
  });

  it("starts zone music only while sound, music, and page visibility are active", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: true
    });

    await engine.unlock();
    const context = FakeAudioContext.instances[0];
    expect(context.oscillators).toHaveLength(6);
    expect(context.oscillators.every((oscillator) => oscillator.stops.length === 1)).toBe(true);

    engine.setVisible(false);
    expect(context.oscillators.every((oscillator) => oscillator.stops.length === 2)).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(context.oscillators).toHaveLength(6);
  });
});

describe("triggerHaptic", () => {
  it("uses short, cue-specific patterns and safely handles unsupported devices", () => {
    const vibrate = vi.fn(() => true);
    expect(triggerHaptic("portal", vibrate)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([18, 35, 28]);
    expect(triggerHaptic("complete", vibrate)).toBe(true);
    expect(vibrate).toHaveBeenLastCalledWith([16, 34, 20, 34, 32]);
    expect(triggerHaptic("photo", vibrate)).toBe(true);
    expect(vibrate).toHaveBeenLastCalledWith([10, 24, 14]);
    expect(triggerHaptic("tap", undefined)).toBe(false);
  });
});

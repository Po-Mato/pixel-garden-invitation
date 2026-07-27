import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultFeedbackPreferences } from "./feedbackPreferences";
import { GameAudioEngine, triggerHaptic, triggerJourneyHaptic, triggerPortalDirectionHaptic } from "./gameAudio";

class FakeAudioParam {
  value = 1;
  readonly values: number[] = [];
  readonly linearRamps: Array<{ value: number; at: number }> = [];
  readonly exponentialRamps: Array<{ value: number; at: number }> = [];
  readonly cancellations: number[] = [];
  readonly holds: number[] = [];
  setValueAtTime(value: number) { this.value = value; this.values.push(value); }
  exponentialRampToValueAtTime(value: number, at: number) {
    this.value = value;
    this.values.push(value);
    this.exponentialRamps.push({ value, at });
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.value = value;
    this.values.push(value);
    this.linearRamps.push({ value, at });
  }
  cancelScheduledValues(at: number) { this.cancellations.push(at); }
  cancelAndHoldAtTime(at: number) { this.holds.push(at); }
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

class FakeDelay {
  readonly delayTime = new FakeAudioParam();
  connect() { return undefined; }
}

class FakeStereoPanner {
  readonly pan = new FakeAudioParam();
  connect() { return undefined; }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  readonly destination = {};
  readonly oscillators: FakeOscillator[] = [];
  readonly gains: FakeGain[] = [];
  readonly delays: FakeDelay[] = [];
  readonly panners: FakeStereoPanner[] = [];
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

  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createDelay() {
    const delay = new FakeDelay();
    this.delays.push(delay);
    return delay;
  }
  createStereoPanner() {
    const panner = new FakeStereoPanner();
    this.panners.push(panner);
    return panner;
  }
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

  it("uses a distinct quiet tone profile for every map surface", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false
    });

    await engine.unlock();
    const context = FakeAudioContext.instances[0];
    const expected = {
      wood: [160, 96],
      asphalt: [125, 84],
      concrete: [210, 135],
      metal: [360, 220],
      gravel: [240, 180, 300],
      marble: [260, 180],
      carpet: [135],
      tile: [300, 190]
    } as const;

    for (const [surface, frequencies] of Object.entries(expected)) {
      const firstNewOscillator = context.oscillators.length;
      engine.playCue("footstep", { surface: surface as keyof typeof expected });
      expect(context.oscillators
        .slice(firstNewOscillator)
        .map((oscillator) => oscillator.frequency.values[0]))
        .toEqual(frequencies);
    }
  });

  it("makes right and left landings subtly different and applies the footstep level", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const rightEngine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false
    });
    const leftEngine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false
    });
    const strongEngine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false,
      footstepVolume: "bright"
    });

    await rightEngine.unlock();
    await leftEngine.unlock();
    await strongEngine.unlock();
    rightEngine.playCue("footstep", { surface: "wood", foot: "right" });
    leftEngine.playCue("footstep", { surface: "wood", foot: "left" });
    strongEngine.playCue("footstep", { surface: "wood", foot: "right" });

    const rightContext = FakeAudioContext.instances[0];
    const leftContext = FakeAudioContext.instances[1];
    const strongContext = FakeAudioContext.instances[2];
    const rightFrequency = rightContext.oscillators[0].frequency.values[0];
    const leftFrequency = leftContext.oscillators[0].frequency.values[0];
    const rightPeak = rightContext.gains[0].gain.values[1];
    const leftPeak = leftContext.gains[0].gain.values[1];
    expect(rightFrequency).toBeCloseTo(157.6);
    expect(leftFrequency).toBeCloseTo(162.4);
    expect(leftPeak).toBeGreaterThan(rightPeak);
    expect(strongContext.gains[0].gain.values[1]).toBeCloseTo(rightPeak * 1.3);
  });

  it("cycles three texture variants independently for each surface", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false
    });

    await engine.unlock();
    const context = FakeAudioContext.instances[0];
    for (let index = 0; index < 6; index += 1) {
      engine.playCue("footstep", { surface: "wood", foot: "right" });
    }
    engine.playCue("footstep", { surface: "metal", foot: "right" });

    const woodFirstToneFrequencies = Array.from(
      { length: 6 },
      (_, index) => context.oscillators[index * 2].frequency.values[0]
    );
    const expectedWoodFrequencies = [
      157.6,
      156.3392,
      158.8608,
      157.6,
      158.8608,
      156.3392
    ];
    woodFirstToneFrequencies.forEach((frequency, index) => {
      expect(frequency).toBeCloseTo(expectedWoodFrequencies[index]);
    });
    expect(new Set(woodFirstToneFrequencies.map((frequency) => frequency.toFixed(4))).size).toBe(3);
    expect(context.oscillators[12].frequency.values[0]).toBeCloseTo(354.6);
  });

  it("adds zone-sized footstep reflections indoors while keeping outdoor steps dry", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false
    });

    engine.setZone("neighborhood");
    await engine.unlock();
    const context = FakeAudioContext.instances[0];
    engine.playCue("footstep", { surface: "asphalt", foot: "right" });
    expect(context.delays).toHaveLength(0);

    engine.setZone("ceremony-hall");
    engine.playCue("footstep", { surface: "carpet", foot: "left" });
    expect(context.delays).toHaveLength(1);
    expect(context.delays[0].delayTime.values[0]).toBeCloseTo(0.14);
    expect(context.gains[3].gain.values[0]).toBeCloseTo(0.24);

    engine.setZone("restroom");
    engine.playCue("footstep", { surface: "tile", foot: "right" });
    expect(context.delays).toHaveLength(3);
    expect(context.delays[1].delayTime.values[0]).toBeCloseTo(0.115);
    expect(context.gains[5].gain.values[0]).toBeCloseTo(0.26);
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

  it("fades and pans the portal hum with proximity while respecting effect settings", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false
    });

    engine.setPortalAudio({ intensity: 0.5, pan: 0.75, destination: "neighborhood", direction: "right" });
    await engine.unlock();

    const context = FakeAudioContext.instances[0];
    const portalBus = context.gains[0];
    expect(context.oscillators.map((oscillator) => oscillator.frequency.values[0]))
      .toEqual([196, 392]);
    expect(portalBus.gain.linearRamps.at(-1)?.value).toBeCloseTo(0.00702);
    expect(portalBus.gain.linearRamps.at(-1)?.at).toBeCloseTo(10.16);
    expect(context.panners[0].pan.linearRamps.at(-1)).toEqual({ value: 0.75, at: 10.16 });

    engine.setPortalAudio({ intensity: 1, pan: -0.5, destination: "subway-station", direction: "left" });
    expect(portalBus.gain.linearRamps.at(-1)?.value).toBeCloseTo(0.01404);
    expect(portalBus.gain.linearRamps.at(-1)?.at).toBeCloseTo(10.16);
    expect(context.panners[0].pan.linearRamps.at(-1)).toEqual({ value: -0.5, at: 10.16 });
    expect(context.oscillators[0].frequency.exponentialRamps.at(-1))
      .toEqual({ value: 146.83, at: 10.24 });
    expect(context.oscillators[1].frequency.exponentialRamps.at(-1))
      .toEqual({ value: 220, at: 10.24 });
    expect(context.oscillators.map((oscillator) => oscillator.type)).toEqual(["triangle", "sine"]);
    expect(context.gains[2].gain.linearRamps.at(-1)).toEqual({ value: 0.68, at: 10.24 });
    expect(context.gains[3].gain.linearRamps.at(-1)).toEqual({ value: 0.26, at: 10.24 });

    engine.configure({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      portalAudioVolume: "bright",
      musicEnabled: false
    });
    expect(portalBus.gain.linearRamps.at(-1)?.value).toBeCloseTo(0.018954);

    engine.configure({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      portalAudioEnabled: false,
      musicEnabled: false
    });
    expect(portalBus.gain.linearRamps.at(-1)).toEqual({ value: 0.0001, at: 10.16 });
    vi.advanceTimersByTime(180);
    expect(context.oscillators.every((oscillator) => oscillator.stops.length === 1)).toBe(true);
  });

  it("centers mono portal audio and repeats direction-specific tone patterns", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false,
      portalMonoEnabled: true
    });

    engine.setPortalAudio({
      intensity: 0.5,
      pan: -0.8,
      destination: "ceremony-hall",
      direction: "left"
    });
    await engine.unlock();
    const context = FakeAudioContext.instances[0];
    expect(context.panners[0].pan.linearRamps.at(-1)?.value).toBe(0);
    expect(context.oscillators.slice(-2).map((oscillator) => oscillator.frequency.values[0]))
      .toEqual([261.63, 261.63]);

    vi.advanceTimersByTime(1_119);
    expect(context.oscillators).toHaveLength(4);
    vi.advanceTimersByTime(1);
    expect(context.oscillators.slice(-2).map((oscillator) => oscillator.frequency.values[0]))
      .toEqual([261.63, 261.63]);

    engine.setPortalAudio({
      intensity: 0.8,
      pan: 0.7,
      destination: "ceremony-hall",
      direction: "up"
    });
    expect(context.panners[0].pan.linearRamps.at(-1)?.value).toBe(0);
    expect(context.oscillators.slice(-2).map((oscillator) => oscillator.frequency.values[0]))
      .toEqual([329.63, 493.88]);

    engine.configure({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false,
      portalMonoEnabled: false
    });
    expect(context.panners[0].pan.linearRamps.at(-1)?.value).toBeCloseTo(0.7);
    const oscillatorCount = context.oscillators.length;
    vi.advanceTimersByTime(2_000);
    expect(context.oscillators).toHaveLength(oscillatorCount);
  });

  it("previews the selected portal level with a wedding-hall signature", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false,
      portalAudioVolume: "bright"
    });

    await engine.unlock();
    engine.previewPortalAudio();
    const context = FakeAudioContext.instances[0];
    expect(context.oscillators.map((oscillator) => oscillator.frequency.values[0]))
      .toEqual([329.63, 493.88]);
    expect(context.gains[0].gain.values[1]).toBeCloseTo(0.0250614);

    engine.configure({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false,
      portalAudioEnabled: false
    });
    engine.previewPortalAudio();
    expect(context.oscillators).toHaveLength(2);
  });

  it("assigns every portal destination a distinct two-tone signature", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: false
    });
    const destinations = [
      "home",
      "neighborhood",
      "subway-station",
      "subway-train",
      "venue-exterior",
      "lobby",
      "bridal-room",
      "ceremony-hall",
      "banquet",
      "restroom"
    ] as const;

    engine.setPortalAudio({ intensity: 0.5, pan: 0, destination: destinations[0], direction: "up" });
    await engine.unlock();
    const context = FakeAudioContext.instances[0];
    const signatures = [context.oscillators
      .map((oscillator) => `${oscillator.frequency.values[0]}:${oscillator.type}`)
      .join("|")];

    destinations.slice(1).forEach((destination) => {
      engine.setPortalAudio({ intensity: 0.5, pan: 0, destination, direction: "up" });
      signatures.push(context.oscillators
        .map((oscillator) => `${oscillator.frequency.exponentialRamps.at(-1)?.value}:${oscillator.type}`)
        .join("|"));
    });

    expect(new Set(signatures).size).toBe(destinations.length);
  });

  it("changes ambience with the map and stops all background sound while hidden", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: true
    });

    engine.setZone("subway-train");
    await engine.unlock();
    const context = FakeAudioContext.instances[0];
    const subwayBus = context.gains[0];
    expect(context.oscillators).toHaveLength(8);
    expect(context.oscillators.slice(-2).map((oscillator) => oscillator.frequency.values[0]))
      .toEqual([42, 84]);

    engine.setZone("neighborhood");
    const neighborhoodBus = context.gains[10];
    expect(context.oscillators).toHaveLength(17);
    expect(context.oscillators.slice(-3).map((oscillator) => oscillator.frequency.values[0]))
      .toEqual([1046.5, 1318.5, 880]);
    expect(context.oscillators.slice(0, 8).every((oscillator) => oscillator.stops.length === 2)).toBe(true);
    expect(context.oscillators.slice(8).every((oscillator) => oscillator.stops.length === 1)).toBe(true);
    expect(subwayBus.gain.cancellations).toEqual([10]);
    expect(subwayBus.gain.linearRamps).toEqual([{ value: 0.0001, at: 10.42 }]);
    expect(context.oscillators[0].stops.at(-1)).toBeCloseTo(10.44);
    expect(neighborhoodBus.gain.values[0]).toBe(0.0001);
    expect(neighborhoodBus.gain.linearRamps).toEqual([{ value: 1, at: 10.42 }]);

    engine.setVisible(false);
    expect(context.oscillators.every((oscillator) => oscillator.stops.length === 2)).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(context.oscillators).toHaveLength(17);
  });

  it.each([
    ["portal", 0.28, 10.05, 11.05],
    ["stamp", 0.38, 10.04, 10.96],
    ["dialogue", 0.46, 10.04, 10.7],
    ["complete", 0.22, 10.06, 11.75]
  ] as const)("ducks background audio for the %s cue and restores it smoothly", async (
    cue,
    expectedGain,
    expectedDuckAt,
    expectedRestoreAt
  ) => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const engine = new GameAudioEngine({
      ...defaultFeedbackPreferences,
      soundEnabled: true,
      musicEnabled: true
    });

    await engine.unlock();
    const context = FakeAudioContext.instances[0];
    const backgroundBus = context.gains[1];
    engine.playCue("footstep", { surface: "wood", foot: "right" });
    expect(backgroundBus.gain.linearRamps).toHaveLength(0);

    engine.playCue(cue);
    expect(backgroundBus.gain.holds).toEqual([10]);
    expect(backgroundBus.gain.linearRamps[0].value).toBeCloseTo(expectedGain);
    expect(backgroundBus.gain.linearRamps[0].at).toBeCloseTo(expectedDuckAt);
    expect(backgroundBus.gain.linearRamps.at(-1)?.value).toBe(1);
    expect(backgroundBus.gain.linearRamps.at(-1)?.at).toBeCloseTo(expectedRestoreAt);
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
    expect(triggerHaptic("footstep", vibrate)).toBe(true);
    expect(vibrate).toHaveBeenLastCalledWith(4);
    expect(triggerHaptic("tap", undefined)).toBe(false);
  });

  it("uses distinct portal direction patterns", () => {
    const vibrate = vi.fn<(pattern: number | number[]) => boolean>(() => true);
    const directions = ["left", "right", "up", "down", "arrived"] as const;

    directions.forEach((direction) => triggerPortalDirectionHaptic(direction, vibrate));

    expect(vibrate.mock.calls.map(([pattern]) => pattern)).toEqual([
      28,
      [10, 34, 10],
      [10, 28, 22],
      [22, 28, 10],
      [12, 24, 12, 24, 24]
    ]);
    expect(triggerPortalDirectionHaptic("left", undefined)).toBe(false);
  });

  it("uses distinct journey destination patterns for start and arrival", () => {
    const vibrate = vi.fn<(pattern: number | number[]) => boolean>(() => true);
    const destinations = ["directions", "gallery", "bride", "ceremony", "guestbook"] as const;

    destinations.forEach((destination) => {
      triggerJourneyHaptic(destination, "start", vibrate);
      triggerJourneyHaptic(destination, "arrived", vibrate);
    });

    const serializedPatterns = vibrate.mock.calls.map(([pattern]) => JSON.stringify(pattern));
    expect(new Set(serializedPatterns)).toHaveProperty("size", 10);
    expect(triggerJourneyHaptic("ceremony", "arrived", undefined)).toBe(false);
  });
});

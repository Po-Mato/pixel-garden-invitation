import type { WorldZoneId } from "@wedding-game/shared";
import type { FeedbackPreferences, FeedbackVolume } from "./feedbackPreferences";

export type FeedbackCue = "tap" | "portal" | "stamp" | "dialogue" | "reaction" | "complete";

type AudioContextConstructor = new () => AudioContext;

const volumeGain: Record<FeedbackVolume, number> = {
  quiet: 0.55,
  balanced: 0.78,
  bright: 1
};

const zoneRoots: Record<WorldZoneId, number> = {
  home: 261.63,
  neighborhood: 293.66,
  "subway-station": 220,
  "subway-train": 246.94,
  "venue-exterior": 329.63,
  lobby: 349.23,
  "bridal-room": 392,
  "ceremony-hall": 329.63,
  banquet: 293.66,
  restroom: 261.63
};

const cueTones: Record<FeedbackCue, Array<{
  frequency: number;
  offset: number;
  duration: number;
  strength: number;
  wave?: OscillatorType;
}>> = {
  tap: [{ frequency: 540, offset: 0, duration: 0.055, strength: 0.045 }],
  portal: [
    { frequency: 329.63, offset: 0, duration: 0.24, strength: 0.08, wave: "triangle" },
    { frequency: 493.88, offset: 0.1, duration: 0.3, strength: 0.075, wave: "triangle" },
    { frequency: 659.25, offset: 0.22, duration: 0.42, strength: 0.065 }
  ],
  stamp: [
    { frequency: 523.25, offset: 0, duration: 0.16, strength: 0.075 },
    { frequency: 659.25, offset: 0.11, duration: 0.2, strength: 0.075 },
    { frequency: 783.99, offset: 0.22, duration: 0.36, strength: 0.085 }
  ],
  dialogue: [
    { frequency: 440, offset: 0, duration: 0.14, strength: 0.055, wave: "triangle" },
    { frequency: 554.37, offset: 0.1, duration: 0.24, strength: 0.06, wave: "triangle" }
  ],
  reaction: [
    { frequency: 659.25, offset: 0, duration: 0.12, strength: 0.065 },
    { frequency: 880, offset: 0.09, duration: 0.26, strength: 0.07 }
  ],
  complete: [
    { frequency: 392, offset: 0, duration: 0.28, strength: 0.07, wave: "triangle" },
    { frequency: 523.25, offset: 0.14, duration: 0.34, strength: 0.075, wave: "triangle" },
    { frequency: 659.25, offset: 0.3, duration: 0.42, strength: 0.08 },
    { frequency: 783.99, offset: 0.48, duration: 0.66, strength: 0.085 }
  ]
};

const hapticPatterns: Record<FeedbackCue, number | number[]> = {
  tap: 7,
  portal: [18, 35, 28],
  stamp: [12, 28, 12],
  dialogue: 9,
  reaction: [8, 22, 8],
  complete: [16, 34, 20, 34, 32]
};

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? candidate.webkitAudioContext ?? null;
}

export function triggerHaptic(
  cue: FeedbackCue,
  vibrate: ((pattern: number | number[]) => boolean) | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.vibrate?.bind(navigator)
): boolean {
  if (!vibrate) return false;
  try {
    return vibrate(hapticPatterns[cue]);
  } catch {
    return false;
  }
}

export class GameAudioEngine {
  private context: AudioContext | null = null;
  private preferences: FeedbackPreferences;
  private zoneId: WorldZoneId = "home";
  private visible = true;
  private musicTimer: number | null = null;
  private musicOscillators = new Set<OscillatorNode>();

  constructor(preferences: FeedbackPreferences) {
    this.preferences = preferences;
  }

  async unlock(): Promise<boolean> {
    const Context = audioContextConstructor();
    if (!Context) return false;
    this.context ??= new Context();
    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        return false;
      }
    }
    if (this.context.state !== "running") return false;
    this.syncMusic();
    return true;
  }

  configure(preferences: FeedbackPreferences) {
    this.preferences = preferences;
    this.syncMusic();
  }

  setZone(zoneId: WorldZoneId) {
    if (this.zoneId === zoneId) return;
    this.zoneId = zoneId;
    if (this.musicTimer !== null || this.musicOscillators.size > 0) {
      this.stopMusic();
      this.syncMusic();
    }
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.syncMusic();
  }

  playCue(cue: FeedbackCue) {
    if (!this.preferences.effectsEnabled || !this.canPlaySound()) return;
    cueTones[cue].forEach((tone) => {
      this.playTone(tone.frequency, tone.offset, tone.duration, tone.strength, tone.wave ?? "sine", false);
    });
  }

  dispose() {
    this.stopMusic();
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") void context.close();
  }

  private canPlaySound() {
    return this.preferences.soundEnabled
      && this.visible
      && this.context?.state === "running";
  }

  private canPlayMusic() {
    return this.canPlaySound() && this.preferences.musicEnabled;
  }

  private syncMusic() {
    if (!this.canPlayMusic()) {
      this.stopMusic();
      return;
    }
    if (this.musicTimer === null && this.musicOscillators.size === 0) this.scheduleMusicCycle();
  }

  private scheduleMusicCycle() {
    if (!this.canPlayMusic()) return;
    const root = zoneRoots[this.zoneId];
    const motif = [1, 1.25, 1.5, 2, 1.5];

    this.playTone(root / 2, 0, 4.6, 0.012, "sine", true);
    motif.forEach((ratio, index) => {
      this.playTone(root * ratio, 0.22 + index * 0.72, 1.55, 0.018, index % 2 === 0 ? "sine" : "triangle", true);
    });
    this.musicTimer = window.setTimeout(() => {
      this.musicTimer = null;
      this.scheduleMusicCycle();
    }, 4800);
  }

  private stopMusic() {
    if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.musicOscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // Already stopped by its scheduled end.
      }
    });
    this.musicOscillators.clear();
  }

  private playTone(
    frequency: number,
    offset: number,
    duration: number,
    strength: number,
    wave: OscillatorType,
    music: boolean
  ) {
    const context = this.context;
    if (!context || context.state !== "running") return;
    const startAt = context.currentTime + offset;
    const stopAt = startAt + duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const peak = strength * volumeGain[this.preferences.volume];

    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), startAt + Math.min(0.05, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    oscillator.connect(gain);
    gain.connect(context.destination);
    if (music) {
      this.musicOscillators.add(oscillator);
      oscillator.addEventListener("ended", () => this.musicOscillators.delete(oscillator), { once: true });
    }
    oscillator.start(startAt);
    oscillator.stop(stopAt + 0.02);
  }
}

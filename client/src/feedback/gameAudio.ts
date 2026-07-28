import type { Direction, WorldZoneId } from "@wedding-game/shared";
import type { FootstepSurface } from "../game/footstepSurface";
import type { PortalAudioMix, PortalGuideDirection } from "../game/portalAudio";
import type { WalkLandingFoot } from "../game/walkTiming";
import type { JourneyCheckpointId } from "../game/journeyProgress";
import type { FeedbackPreferences, FeedbackVolume } from "./feedbackPreferences";

export type FeedbackCue = "tap" | "footstep" | "portal" | "stamp" | "dialogue" | "reaction" | "photo" | "complete";
export type FeedbackCueOptions = {
  surface?: FootstepSurface;
  foot?: WalkLandingFoot;
};

type AudioContextConstructor = new () => AudioContext;

const volumeGain: Record<FeedbackVolume, number> = {
  quiet: 0.55,
  balanced: 0.78,
  bright: 1
};

const footstepVolumeGain: Record<FeedbackVolume, number> = {
  quiet: 0.65,
  balanced: 1,
  bright: 1.3
};

const portalAudioVolumeGain: Record<FeedbackVolume, number> = {
  quiet: 0.55,
  balanced: 1,
  bright: 1.35
};

const footstepVariation: Record<WalkLandingFoot, { pitch: number; strength: number }> = {
  right: { pitch: 0.985, strength: 0.94 },
  left: { pitch: 1.015, strength: 1.04 }
};

type FootstepTextureVariation = {
  pitch: number;
  strength: number;
  duration: number;
  spacing: number;
};

const footstepTextureVariations: readonly FootstepTextureVariation[] = [
  { pitch: 1, strength: 1, duration: 1, spacing: 1 },
  { pitch: 0.992, strength: 0.96, duration: 0.92, spacing: 0.94 },
  { pitch: 1.008, strength: 1.035, duration: 1.06, spacing: 1.04 }
];

const footstepTextureSequence = [0, 1, 2, 0, 2, 1] as const;
const musicCrossfadeSeconds = 0.42;
const portalAudioFadeSeconds = 0.16;
const portalToneTransitionSeconds = 0.24;
const portalAudioMaxGain = 0.018;
const portalGuidanceMinIntervalMs = 760;
const portalGuidanceMaxIntervalMs = 1_480;

type PortalTone = { frequency: number; strength: number; wave: OscillatorType };
type PortalToneProfile = readonly [PortalTone, PortalTone];

const portalToneProfiles: Record<WorldZoneId, PortalToneProfile> = {
  home: [
    { frequency: 174.61, strength: 0.72, wave: "sine" },
    { frequency: 261.63, strength: 0.22, wave: "sine" }
  ],
  neighborhood: [
    { frequency: 196, strength: 0.72, wave: "sine" },
    { frequency: 392, strength: 0.24, wave: "triangle" }
  ],
  "subway-station": [
    { frequency: 146.83, strength: 0.68, wave: "triangle" },
    { frequency: 220, strength: 0.26, wave: "sine" }
  ],
  "subway-train": [
    { frequency: 123.47, strength: 0.65, wave: "triangle" },
    { frequency: 246.94, strength: 0.22, wave: "square" }
  ],
  "venue-exterior": [
    { frequency: 220, strength: 0.7, wave: "sine" },
    { frequency: 329.63, strength: 0.24, wave: "triangle" }
  ],
  lobby: [
    { frequency: 261.63, strength: 0.7, wave: "sine" },
    { frequency: 392, strength: 0.23, wave: "sine" }
  ],
  "bridal-room": [
    { frequency: 293.66, strength: 0.68, wave: "sine" },
    { frequency: 440, strength: 0.25, wave: "triangle" }
  ],
  "ceremony-hall": [
    { frequency: 329.63, strength: 0.7, wave: "sine" },
    { frequency: 493.88, strength: 0.24, wave: "sine" }
  ],
  banquet: [
    { frequency: 246.94, strength: 0.68, wave: "triangle" },
    { frequency: 369.99, strength: 0.22, wave: "sine" }
  ],
  restroom: [
    { frequency: 185, strength: 0.65, wave: "sine" },
    { frequency: 277.18, strength: 0.2, wave: "triangle" }
  ]
};

type BackgroundDuckProfile = {
  gain: number;
  attack: number;
  hold: number;
  release: number;
};

const backgroundDuckProfiles: Partial<Record<FeedbackCue, BackgroundDuckProfile>> = {
  portal: { gain: 0.28, attack: 0.05, hold: 0.65, release: 0.35 },
  stamp: { gain: 0.38, attack: 0.04, hold: 0.58, release: 0.34 },
  dialogue: { gain: 0.46, attack: 0.04, hold: 0.36, release: 0.3 },
  complete: { gain: 0.22, attack: 0.06, hold: 1.14, release: 0.55 }
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

type FeedbackTone = {
  frequency: number;
  offset: number;
  duration: number;
  strength: number;
  wave?: OscillatorType;
};

const portalDirectionTones: Record<PortalGuideDirection, readonly FeedbackTone[]> = {
  left: [
    { frequency: 261.63, offset: 0, duration: 0.12, strength: 0.022, wave: "triangle" },
    { frequency: 261.63, offset: 0.18, duration: 0.12, strength: 0.022, wave: "triangle" }
  ],
  right: [
    { frequency: 523.25, offset: 0, duration: 0.12, strength: 0.018 },
    { frequency: 523.25, offset: 0.18, duration: 0.12, strength: 0.018 }
  ],
  up: [
    { frequency: 329.63, offset: 0, duration: 0.13, strength: 0.019, wave: "triangle" },
    { frequency: 493.88, offset: 0.16, duration: 0.16, strength: 0.02 }
  ],
  down: [
    { frequency: 493.88, offset: 0, duration: 0.13, strength: 0.019 },
    { frequency: 329.63, offset: 0.16, duration: 0.16, strength: 0.02, wave: "triangle" }
  ],
  arrived: [
    { frequency: 392, offset: 0, duration: 0.16, strength: 0.02, wave: "triangle" },
    { frequency: 523.25, offset: 0.11, duration: 0.2, strength: 0.022 },
    { frequency: 659.25, offset: 0.22, duration: 0.28, strength: 0.024 }
  ]
};

type FootstepEcho = {
  delay: number;
  mix: number;
};

type ZoneAcoustics = {
  footstepEcho: FootstepEcho | null;
  ambience: FeedbackTone[];
};

const zoneAcoustics: Record<WorldZoneId, ZoneAcoustics> = {
  home: {
    footstepEcho: { delay: 0.045, mix: 0.11 },
    ambience: [{ frequency: 72, offset: 0, duration: 4.55, strength: 0.003, wave: "sine" }]
  },
  neighborhood: {
    footstepEcho: null,
    ambience: [
      { frequency: 1046.5, offset: 1.05, duration: 0.08, strength: 0.0035, wave: "triangle" },
      { frequency: 1318.5, offset: 1.17, duration: 0.07, strength: 0.0028, wave: "triangle" },
      { frequency: 880, offset: 3.2, duration: 0.1, strength: 0.0025, wave: "triangle" }
    ]
  },
  "subway-station": {
    footstepEcho: { delay: 0.105, mix: 0.22 },
    ambience: [
      { frequency: 46, offset: 0, duration: 4.55, strength: 0.005, wave: "triangle" },
      { frequency: 92, offset: 2.1, duration: 0.62, strength: 0.003, wave: "square" }
    ]
  },
  "subway-train": {
    footstepEcho: { delay: 0.055, mix: 0.17 },
    ambience: [
      { frequency: 42, offset: 0, duration: 4.55, strength: 0.006, wave: "triangle" },
      { frequency: 84, offset: 0.38, duration: 3.8, strength: 0.003, wave: "square" }
    ]
  },
  "venue-exterior": {
    footstepEcho: null,
    ambience: [
      { frequency: 987.77, offset: 0.9, duration: 0.09, strength: 0.003, wave: "triangle" },
      { frequency: 1174.66, offset: 1.04, duration: 0.08, strength: 0.0026, wave: "triangle" },
      { frequency: 783.99, offset: 3.35, duration: 0.12, strength: 0.0022, wave: "triangle" }
    ]
  },
  lobby: {
    footstepEcho: { delay: 0.075, mix: 0.15 },
    ambience: [{ frequency: 98, offset: 0, duration: 4.55, strength: 0.0027, wave: "sine" }]
  },
  "bridal-room": {
    footstepEcho: { delay: 0.045, mix: 0.09 },
    ambience: [{ frequency: 110, offset: 0, duration: 4.55, strength: 0.0022, wave: "sine" }]
  },
  "ceremony-hall": {
    footstepEcho: { delay: 0.14, mix: 0.24 },
    ambience: [{ frequency: 65.41, offset: 0, duration: 4.55, strength: 0.0032, wave: "sine" }]
  },
  banquet: {
    footstepEcho: { delay: 0.085, mix: 0.14 },
    ambience: [
      { frequency: 82.41, offset: 0, duration: 4.55, strength: 0.0028, wave: "triangle" },
      { frequency: 164.81, offset: 2.65, duration: 0.32, strength: 0.002, wave: "sine" }
    ]
  },
  restroom: {
    footstepEcho: { delay: 0.115, mix: 0.26 },
    ambience: [{ frequency: 120, offset: 0, duration: 4.55, strength: 0.0024, wave: "sine" }]
  }
};

const footstepTones: Record<FootstepSurface, FeedbackTone[]> = {
  wood: [
    { frequency: 160, offset: 0, duration: 0.045, strength: 0.024, wave: "triangle" },
    { frequency: 96, offset: 0.014, duration: 0.055, strength: 0.017 }
  ],
  asphalt: [
    { frequency: 125, offset: 0, duration: 0.035, strength: 0.022, wave: "square" },
    { frequency: 84, offset: 0.012, duration: 0.05, strength: 0.016, wave: "triangle" }
  ],
  concrete: [
    { frequency: 210, offset: 0, duration: 0.04, strength: 0.022, wave: "triangle" },
    { frequency: 135, offset: 0.012, duration: 0.05, strength: 0.016, wave: "square" }
  ],
  metal: [
    { frequency: 360, offset: 0, duration: 0.035, strength: 0.019, wave: "square" },
    { frequency: 220, offset: 0.012, duration: 0.07, strength: 0.014, wave: "triangle" }
  ],
  gravel: [
    { frequency: 240, offset: 0, duration: 0.025, strength: 0.018, wave: "square" },
    { frequency: 180, offset: 0.018, duration: 0.025, strength: 0.016, wave: "triangle" },
    { frequency: 300, offset: 0.032, duration: 0.022, strength: 0.013, wave: "square" }
  ],
  marble: [
    { frequency: 260, offset: 0, duration: 0.045, strength: 0.02 },
    { frequency: 180, offset: 0.018, duration: 0.09, strength: 0.013, wave: "triangle" }
  ],
  carpet: [
    { frequency: 135, offset: 0, duration: 0.032, strength: 0.012, wave: "triangle" }
  ],
  tile: [
    { frequency: 300, offset: 0, duration: 0.035, strength: 0.019, wave: "square" },
    { frequency: 190, offset: 0.012, duration: 0.055, strength: 0.014 }
  ]
};

const cueTones: Record<Exclude<FeedbackCue, "footstep">, FeedbackTone[]> = {
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
  photo: [
    { frequency: 880, offset: 0, duration: 0.045, strength: 0.075, wave: "square" },
    { frequency: 1174.66, offset: 0.08, duration: 0.18, strength: 0.065 }
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
  footstep: 4,
  portal: [18, 35, 28],
  stamp: [12, 28, 12],
  dialogue: 9,
  reaction: [8, 22, 8],
  photo: [10, 24, 14],
  complete: [16, 34, 20, 34, 32]
};

const portalDirectionHapticPatterns: Record<PortalGuideDirection, number | number[]> = {
  left: 28,
  right: [10, 34, 10],
  up: [10, 28, 22],
  down: [22, 28, 10],
  arrived: [12, 24, 12, 24, 24]
};

const routeTurnHapticPatterns: Record<Direction, number | number[]> = {
  left: [18, 20, 7],
  right: [7, 20, 18],
  up: [8, 16, 20],
  down: [20, 16, 8]
};

export type CollectionProximityHaptic = "near" | "close" | "arrived";

const collectionProximityHapticPatterns: Record<CollectionProximityHaptic, number | number[]> = {
  near: 8,
  close: [9, 28, 9],
  arrived: [12, 20, 12, 20, 22]
};

export type JourneyHapticPhase = "start" | "arrived";

const journeyHapticPatterns: Record<JourneyCheckpointId, Record<JourneyHapticPhase, number | number[]>> = {
  directions: { start: [8, 26, 8], arrived: [14, 24, 14] },
  gallery: { start: [8, 18, 8, 34, 8], arrived: [12, 18, 20] },
  bride: { start: [14, 34, 8], arrived: [18, 22, 10, 22, 18] },
  ceremony: { start: [20, 38, 20], arrived: [24, 28, 24, 28, 30] },
  guestbook: { start: [7, 16, 7, 16, 7], arrived: [12, 20, 12, 20, 22] }
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

export function triggerPortalDirectionHaptic(
  direction: PortalGuideDirection,
  vibrate: ((pattern: number | number[]) => boolean) | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.vibrate?.bind(navigator)
): boolean {
  if (!vibrate) return false;
  try {
    return vibrate(portalDirectionHapticPatterns[direction]);
  } catch {
    return false;
  }
}

export function triggerRouteTurnHaptic(
  direction: Direction,
  vibrate: ((pattern: number | number[]) => boolean) | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.vibrate?.bind(navigator)
): boolean {
  if (!vibrate) return false;
  try {
    return vibrate(routeTurnHapticPatterns[direction]);
  } catch {
    return false;
  }
}

export function triggerCollectionProximityHaptic(
  proximity: CollectionProximityHaptic,
  vibrate: ((pattern: number | number[]) => boolean) | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.vibrate?.bind(navigator)
): boolean {
  if (!vibrate) return false;
  try {
    return vibrate(collectionProximityHapticPatterns[proximity]);
  } catch {
    return false;
  }
}

export function triggerJourneyHaptic(
  checkpointId: JourneyCheckpointId,
  phase: JourneyHapticPhase,
  vibrate: ((pattern: number | number[]) => boolean) | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.vibrate?.bind(navigator)
): boolean {
  if (!vibrate) return false;
  try {
    return vibrate(journeyHapticPatterns[checkpointId][phase]);
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
  private musicBus: GainNode | null = null;
  private musicFadeInPending = false;
  private backgroundBus: GainNode | null = null;
  private portalMix: PortalAudioMix | null = null;
  private portalBus: GainNode | null = null;
  private portalPanner: StereoPannerNode | null = null;
  private portalOscillators: OscillatorNode[] = [];
  private portalToneGains: GainNode[] = [];
  private portalDestination: WorldZoneId | null = null;
  private portalStopTimer: number | null = null;
  private portalGuidanceTimer: number | null = null;
  private portalGuidanceDirection: PortalGuideDirection | null = null;
  private portalAppliedGain = 0.0001;
  private portalAppliedPan = 0;
  private footstepVariantIndexes: Record<FootstepSurface, number> = {
    wood: 0,
    asphalt: 0,
    concrete: 0,
    metal: 0,
    gravel: 0,
    marble: 0,
    carpet: 0,
    tile: 0
  };

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
    this.syncPortalAudio();
    return true;
  }

  configure(preferences: FeedbackPreferences) {
    this.preferences = preferences;
    this.syncMusic();
    this.syncPortalAudio();
  }

  setZone(zoneId: WorldZoneId) {
    if (this.zoneId === zoneId) return;
    if (this.canPlayMusic() && this.musicBus) {
      this.fadeOutCurrentMusic();
      this.zoneId = zoneId;
      this.musicFadeInPending = true;
      this.scheduleMusicCycle();
      return;
    }

    this.zoneId = zoneId;
    if (this.musicTimer !== null || this.musicOscillators.size > 0) {
      this.stopMusic();
      this.syncMusic();
    }
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.syncMusic();
    this.syncPortalAudio();
  }

  setPortalAudio(mix: PortalAudioMix | null) {
    this.portalMix = mix ? {
      intensity: Math.min(1, Math.max(0, mix.intensity)),
      pan: Math.min(1, Math.max(-1, mix.pan)),
      destination: mix.destination,
      direction: mix.direction
    } : null;
    this.syncPortalAudio();
  }

  playCue(cue: FeedbackCue, options: FeedbackCueOptions = {}) {
    if (!this.preferences.effectsEnabled || !this.canPlaySound()) return;
    if (cue === "footstep") {
      const surface = options.surface ?? "wood";
      const foot = options.foot ? footstepVariation[options.foot] : { pitch: 1, strength: 1 };
      const textureSequenceIndex = this.footstepVariantIndexes[surface];
      const textureIndex = footstepTextureSequence[textureSequenceIndex % footstepTextureSequence.length];
      const texture = footstepTextureVariations[textureIndex];
      this.footstepVariantIndexes[surface] = textureSequenceIndex + 1;
      const strengthScale = foot.strength
        * texture.strength
        * footstepVolumeGain[this.preferences.footstepVolume];
      footstepTones[surface].forEach((tone) => {
        this.playTone(
          tone.frequency * foot.pitch * texture.pitch,
          tone.offset * texture.spacing,
          tone.duration * texture.duration,
          tone.strength,
          tone.wave ?? "sine",
          false,
          strengthScale,
          zoneAcoustics[this.zoneId].footstepEcho
        );
      });
      return;
    }

    this.duckBackgroundForCue(cue);
    cueTones[cue].forEach((tone) => {
      this.playTone(tone.frequency, tone.offset, tone.duration, tone.strength, tone.wave ?? "sine", false);
    });
  }

  previewPortalAudio(destination: WorldZoneId = this.portalMix?.destination ?? "ceremony-hall") {
    if (!this.canPlayPortalAudio()) return;
    const strengthScale = portalAudioVolumeGain[this.preferences.portalAudioVolume];
    portalToneProfiles[destination].forEach((tone, index) => {
      this.playTone(
        tone.frequency,
        index * 0.08,
        0.44,
        0.034 * tone.strength,
        tone.wave,
        false,
        strengthScale
      );
    });
  }

  previewPortalDirection(direction: PortalGuideDirection) {
    if (!this.canPlayPortalGuidance()) return;
    this.playPortalDirectionCue(direction, 1);
  }

  dispose() {
    this.stopMusic();
    this.stopPortalGuidance();
    this.stopPortalAudio();
    this.backgroundBus = null;
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

  private canPlayPortalAudio() {
    return this.canPlaySound()
      && this.preferences.effectsEnabled
      && this.preferences.portalAudioEnabled;
  }

  private canPlayPortalGuidance() {
    return this.canPlayPortalAudio() && this.preferences.portalMonoEnabled;
  }

  private syncMusic() {
    if (!this.canPlayMusic()) {
      this.stopMusic();
      return;
    }
    if (this.musicTimer === null && this.musicOscillators.size === 0) this.scheduleMusicCycle();
  }

  private syncPortalAudio() {
    const mix = this.portalMix;
    if (!this.canPlayPortalAudio() || !mix || mix.intensity <= 0) {
      this.stopPortalGuidance();
      this.fadeOutPortalAudio();
      return;
    }

    const context = this.context;
    const bus = this.ensurePortalAudio();
    if (!context || !bus) return;
    this.updatePortalTone(mix.destination);
    if (this.portalStopTimer !== null) window.clearTimeout(this.portalStopTimer);
    this.portalStopTimer = null;

    const now = context.currentTime;
    const targetGain = portalAudioMaxGain
      * volumeGain[this.preferences.volume]
      * portalAudioVolumeGain[this.preferences.portalAudioVolume]
      * mix.intensity;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(this.portalAppliedGain, now);
    bus.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), now + portalAudioFadeSeconds);
    this.portalAppliedGain = Math.max(0.0001, targetGain);

    if (this.portalPanner) {
      const targetPan = this.preferences.portalMonoEnabled ? 0 : mix.pan;
      this.portalPanner.pan.cancelScheduledValues(now);
      this.portalPanner.pan.setValueAtTime(this.portalAppliedPan, now);
      this.portalPanner.pan.linearRampToValueAtTime(targetPan, now + portalAudioFadeSeconds);
      this.portalAppliedPan = targetPan;
    }
    this.syncPortalGuidance();
  }

  private syncPortalGuidance() {
    const mix = this.portalMix;
    if (!this.canPlayPortalGuidance() || !mix || mix.intensity <= 0) {
      this.stopPortalGuidance();
      return;
    }
    if (this.portalGuidanceDirection !== mix.direction) {
      this.stopPortalGuidance();
      this.portalGuidanceDirection = mix.direction;
      this.playPortalDirectionCue(mix.direction, mix.intensity);
    }
    if (this.portalGuidanceTimer === null) this.schedulePortalGuidance();
  }

  private schedulePortalGuidance() {
    const mix = this.portalMix;
    if (!this.canPlayPortalGuidance() || !mix) return;
    const interval = portalGuidanceMaxIntervalMs
      - (portalGuidanceMaxIntervalMs - portalGuidanceMinIntervalMs) * mix.intensity;
    this.portalGuidanceTimer = window.setTimeout(() => {
      this.portalGuidanceTimer = null;
      const current = this.portalMix;
      if (!this.canPlayPortalGuidance() || !current) {
        this.stopPortalGuidance();
        return;
      }
      this.portalGuidanceDirection = current.direction;
      this.playPortalDirectionCue(current.direction, current.intensity);
      this.schedulePortalGuidance();
    }, interval);
  }

  private playPortalDirectionCue(direction: PortalGuideDirection, intensity: number) {
    const strengthScale = portalAudioVolumeGain[this.preferences.portalAudioVolume]
      * (0.55 + Math.min(1, Math.max(0, intensity)) * 0.45);
    portalDirectionTones[direction].forEach((tone) => {
      this.playTone(
        tone.frequency,
        tone.offset,
        tone.duration,
        tone.strength,
        tone.wave ?? "sine",
        false,
        strengthScale
      );
    });
  }

  private stopPortalGuidance() {
    if (this.portalGuidanceTimer !== null) window.clearTimeout(this.portalGuidanceTimer);
    this.portalGuidanceTimer = null;
    this.portalGuidanceDirection = null;
  }

  private duckBackgroundForCue(cue: FeedbackCue) {
    const profile = backgroundDuckProfiles[cue];
    const context = this.context;
    const bus = this.backgroundBus;
    if (!profile || !context || !bus) return;

    const now = context.currentTime;
    if (typeof bus.gain.cancelAndHoldAtTime === "function") {
      bus.gain.cancelAndHoldAtTime(now);
    } else {
      const currentGain = bus.gain.value;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(currentGain, now);
    }
    const duckAt = now + profile.attack;
    const releaseAt = duckAt + profile.hold;
    bus.gain.linearRampToValueAtTime(profile.gain, duckAt);
    bus.gain.setValueAtTime(profile.gain, releaseAt);
    bus.gain.linearRampToValueAtTime(1, releaseAt + profile.release);
  }

  private ensureBackgroundBus() {
    if (this.backgroundBus) return this.backgroundBus;
    const context = this.context;
    if (!context || context.state !== "running") return null;
    const bus = context.createGain();
    bus.gain.setValueAtTime(1, context.currentTime);
    bus.connect(context.destination);
    this.backgroundBus = bus;
    return bus;
  }

  private ensurePortalAudio() {
    if (this.portalBus) return this.portalBus;
    const context = this.context;
    if (!context || context.state !== "running") return null;

    const bus = context.createGain();
    bus.gain.setValueAtTime(0.0001, context.currentTime);
    const panner = typeof context.createStereoPanner === "function"
      ? context.createStereoPanner()
      : null;
    if (panner) {
      panner.pan.setValueAtTime(0, context.currentTime);
      bus.connect(panner);
      panner.connect(this.ensureBackgroundBus() ?? context.destination);
    } else {
      bus.connect(this.ensureBackgroundBus() ?? context.destination);
    }

    const destination = this.portalMix?.destination ?? "neighborhood";
    portalToneProfiles[destination].forEach((tone) => {
      const oscillator = context.createOscillator();
      const toneGain = context.createGain();
      oscillator.type = tone.wave;
      oscillator.frequency.setValueAtTime(tone.frequency, context.currentTime);
      toneGain.gain.setValueAtTime(tone.strength, context.currentTime);
      oscillator.connect(toneGain);
      toneGain.connect(bus);
      this.portalOscillators.push(oscillator);
      this.portalToneGains.push(toneGain);
      oscillator.start(context.currentTime);
    });

    this.portalBus = bus;
    this.portalPanner = panner;
    this.portalAppliedGain = 0.0001;
    this.portalAppliedPan = 0;
    this.portalDestination = destination;
    return bus;
  }

  private updatePortalTone(destination: WorldZoneId) {
    if (this.portalDestination === destination) return;
    const context = this.context;
    if (!context || this.portalOscillators.length !== 2 || this.portalToneGains.length !== 2) return;

    const now = context.currentTime;
    portalToneProfiles[destination].forEach((tone, index) => {
      const oscillator = this.portalOscillators[index];
      const toneGain = this.portalToneGains[index];
      oscillator.frequency.cancelScheduledValues(now);
      oscillator.frequency.setValueAtTime(oscillator.frequency.value, now);
      oscillator.frequency.exponentialRampToValueAtTime(tone.frequency, now + portalToneTransitionSeconds);
      oscillator.type = tone.wave;
      toneGain.gain.cancelScheduledValues(now);
      toneGain.gain.setValueAtTime(toneGain.gain.value, now);
      toneGain.gain.linearRampToValueAtTime(tone.strength, now + portalToneTransitionSeconds);
    });
    this.portalDestination = destination;
  }

  private fadeOutPortalAudio() {
    const context = this.context;
    const bus = this.portalBus;
    if (!context || !bus || this.portalStopTimer !== null) return;

    const now = context.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(this.portalAppliedGain, now);
    bus.gain.linearRampToValueAtTime(0.0001, now + portalAudioFadeSeconds);
    this.portalAppliedGain = 0.0001;
    this.portalStopTimer = window.setTimeout(() => this.stopPortalAudio(), portalAudioFadeSeconds * 1_000 + 20);
  }

  private stopPortalAudio() {
    if (this.portalStopTimer !== null) window.clearTimeout(this.portalStopTimer);
    this.portalStopTimer = null;
    this.portalOscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // Already stopped.
      }
    });
    this.portalOscillators = [];
    this.portalToneGains = [];
    this.portalDestination = null;
    this.portalBus = null;
    this.portalPanner = null;
    this.portalAppliedGain = 0.0001;
    this.portalAppliedPan = 0;
  }

  private scheduleMusicCycle() {
    if (!this.canPlayMusic()) return;
    this.ensureMusicBus();
    const root = zoneRoots[this.zoneId];
    const motif = [1, 1.25, 1.5, 2, 1.5];

    this.playTone(root / 2, 0, 4.6, 0.012, "sine", true);
    motif.forEach((ratio, index) => {
      this.playTone(root * ratio, 0.22 + index * 0.72, 1.55, 0.018, index % 2 === 0 ? "sine" : "triangle", true);
    });
    zoneAcoustics[this.zoneId].ambience.forEach((tone) => {
      this.playTone(tone.frequency, tone.offset, tone.duration, tone.strength, tone.wave ?? "sine", true);
    });
    this.musicTimer = window.setTimeout(() => {
      this.musicTimer = null;
      this.scheduleMusicCycle();
    }, 4800);
  }

  private stopMusic() {
    if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.musicFadeInPending = false;
    this.musicOscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // Already stopped by its scheduled end.
      }
    });
    this.musicOscillators.clear();
    this.musicBus = null;
  }

  private fadeOutCurrentMusic() {
    if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    const context = this.context;
    const bus = this.musicBus;
    const oscillators = [...this.musicOscillators];
    this.musicBus = null;
    this.musicOscillators.clear();
    if (!context || !bus) {
      oscillators.forEach((oscillator) => oscillator.stop());
      return;
    }

    const fadeStart = context.currentTime;
    const fadeEnd = fadeStart + musicCrossfadeSeconds;
    bus.gain.cancelScheduledValues(fadeStart);
    bus.gain.setValueAtTime(1, fadeStart);
    bus.gain.linearRampToValueAtTime(0.0001, fadeEnd);
    oscillators.forEach((oscillator) => {
      try {
        oscillator.stop(fadeEnd + 0.02);
      } catch {
        // Already stopped by its scheduled end.
      }
    });
  }

  private ensureMusicBus() {
    if (this.musicBus) return this.musicBus;
    const context = this.context;
    if (!context || context.state !== "running") return null;
    const bus = context.createGain();
    const startAt = context.currentTime;
    if (this.musicFadeInPending) {
      bus.gain.setValueAtTime(0.0001, startAt);
      bus.gain.linearRampToValueAtTime(1, startAt + musicCrossfadeSeconds);
    } else {
      bus.gain.setValueAtTime(1, startAt);
    }
    bus.connect(this.ensureBackgroundBus() ?? context.destination);
    this.musicBus = bus;
    this.musicFadeInPending = false;
    return bus;
  }

  private playTone(
    frequency: number,
    offset: number,
    duration: number,
    strength: number,
    wave: OscillatorType,
    music: boolean,
    strengthScale = 1,
    echo: FootstepEcho | null = null
  ) {
    const context = this.context;
    if (!context || context.state !== "running") return;
    const startAt = context.currentTime + offset;
    const stopAt = startAt + duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const peak = strength * volumeGain[this.preferences.volume] * strengthScale;

    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), startAt + Math.min(0.05, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    oscillator.connect(gain);
    gain.connect(music ? this.musicBus ?? context.destination : context.destination);
    if (echo) {
      const delay = context.createDelay();
      const echoGain = context.createGain();
      delay.delayTime.setValueAtTime(echo.delay, startAt);
      echoGain.gain.setValueAtTime(echo.mix, startAt);
      gain.connect(delay);
      delay.connect(echoGain);
      echoGain.connect(context.destination);
    }
    if (music) {
      this.musicOscillators.add(oscillator);
      oscillator.addEventListener("ended", () => this.musicOscillators.delete(oscillator), { once: true });
    }
    oscillator.start(startAt);
    oscillator.stop(stopAt + 0.02);
  }
}

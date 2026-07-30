export type MemorialAmbienceTheme = "garden" | "starlight" | "promise";
export type MemorialAmbienceController = {
  setTheme: (theme: MemorialAmbienceTheme) => void;
  stop: () => void;
};

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const ambienceProfiles: Record<MemorialAmbienceTheme, {
  frequencies: readonly [number, number, number];
  gains: readonly [number, number, number];
}> = {
  garden: { frequencies: [261.63, 329.63, 392], gains: [0.66, 0.26, 0.14] },
  starlight: { frequencies: [220, 329.63, 493.88], gains: [0.56, 0.2, 0.12] },
  promise: { frequencies: [293.66, 369.99, 440], gains: [0.62, 0.24, 0.16] }
};

export function memorialAmbienceSupported() {
  if (typeof window === "undefined") return false;
  const audioWindow = window as AudioWindow;
  return Boolean(audioWindow.AudioContext || audioWindow.webkitAudioContext);
}

export function startMemorialAmbience(theme: MemorialAmbienceTheme = "garden"): MemorialAmbienceController | null {
  if (!memorialAmbienceSupported()) return null;
  try {
    const audioWindow = window as AudioWindow;
    const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext!;
    const context = new AudioContextConstructor();
    const master = context.createGain();
    master.gain.value = 0.018;
    master.connect(context.destination);

    const gains: GainNode[] = [];
    const voices = ambienceProfiles[theme].frequencies.map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.value = ambienceProfiles[theme].gains[index];
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      gains.push(gain);
      return oscillator;
    });

    const shimmer = context.createOscillator();
    const shimmerDepth = context.createGain();
    shimmer.type = "sine";
    shimmer.frequency.value = 0.11;
    shimmerDepth.gain.value = 0.008;
    shimmer.connect(shimmerDepth);
    shimmerDepth.connect(master.gain);
    shimmer.start();
    void context.resume();

    return {
      setTheme: (nextTheme) => {
        const profile = ambienceProfiles[nextTheme];
        voices.forEach((oscillator, index) => {
          oscillator.frequency.setTargetAtTime(profile.frequencies[index], context.currentTime, 0.7);
          gains[index].gain.setTargetAtTime(profile.gains[index], context.currentTime, 0.7);
        });
      },
      stop: () => {
        [...voices, shimmer].forEach((oscillator) => {
          try { oscillator.stop(); } catch { /* Already stopped. */ }
        });
        void context.close();
      }
    };
  } catch {
    return null;
  }
}

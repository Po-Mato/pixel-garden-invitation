export type MemorialAmbienceController = { stop: () => void };

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export function memorialAmbienceSupported() {
  if (typeof window === "undefined") return false;
  const audioWindow = window as AudioWindow;
  return Boolean(audioWindow.AudioContext || audioWindow.webkitAudioContext);
}

export function startMemorialAmbience(): MemorialAmbienceController | null {
  if (!memorialAmbienceSupported()) return null;
  try {
    const audioWindow = window as AudioWindow;
    const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext!;
    const context = new AudioContextConstructor();
    const master = context.createGain();
    master.gain.value = 0.018;
    master.connect(context.destination);

    const voices = [261.63, 392].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.72 : 0.22;
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
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

export type DestinationVoiceNoiseLevel = "quiet" | "moderate" | "noisy";

export type DestinationVoiceNoiseAssessment = {
  level: DestinationVoiceNoiseLevel;
  rms: number;
  label: string;
  tip: string;
};

export function assessDestinationVoiceNoise(rms: number): DestinationVoiceNoiseAssessment {
  const normalized = Number.isFinite(rms) ? Math.max(0, Math.min(1, rms)) : 1;
  if (normalized < 0.035) return {
    level: "quiet",
    rms: normalized,
    label: "조용함",
    tip: "현재 환경에서는 평소 목소리로 명령해도 잘 들려요."
  };
  if (normalized < 0.085) return {
    level: "moderate",
    rms: normalized,
    label: "보통",
    tip: "휴대폰을 가까이 두고 짧은 호출어를 또렷하게 말해 주세요."
  };
  return {
    level: "noisy",
    rms: normalized,
    label: "시끄러움",
    tip: "짧은 명령 프로필을 사용하거나 화면 버튼을 함께 이용해 주세요."
  };
}

export async function measureDestinationVoiceNoise(
  durationMs = 900,
  targetNavigator: Navigator | null = typeof navigator === "undefined" ? null : navigator,
  targetWindow: Window | null = typeof window === "undefined" ? null : window
): Promise<DestinationVoiceNoiseAssessment> {
  if (!targetNavigator?.mediaDevices?.getUserMedia || !targetWindow) throw new Error("microphone-unavailable");
  const audioWindow = targetWindow as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("audio-context-unavailable");
  const stream = await targetNavigator.mediaDevices.getUserMedia({ audio: true });
  const context = new AudioContextConstructor();
  try {
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const startedAt = Date.now();
    let sum = 0;
    let count = 0;
    while (Date.now() - startedAt < durationMs) {
      analyser.getByteTimeDomainData(samples);
      let frameSum = 0;
      samples.forEach((value) => { frameSum += ((value - 128) / 128) ** 2; });
      sum += Math.sqrt(frameSum / samples.length);
      count += 1;
      await new Promise((resolve) => targetWindow.setTimeout(resolve, 80));
    }
    return assessDestinationVoiceNoise(count > 0 ? sum / count : 0);
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    await context.close().catch(() => undefined);
  }
}

type DestinationSpeechRecognitionResult = {
  results?: ArrayLike<{ 0?: { transcript?: string } }>;
};

type DestinationSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: DestinationSpeechRecognitionResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type DestinationSpeechRecognitionConstructor = new () => DestinationSpeechRecognition;

type SpeechWindow = Window & {
  SpeechRecognition?: DestinationSpeechRecognitionConstructor;
  webkitSpeechRecognition?: DestinationSpeechRecognitionConstructor;
};

const KoreanDestinationNumbers: Record<string, number> = {
  일: 1,
  하나: 1,
  한: 1,
  첫: 1,
  이: 2,
  둘: 2,
  두: 2,
  삼: 3,
  셋: 3,
  세: 3,
  사: 4,
  넷: 4,
  네: 4,
  오: 5,
  다섯: 5,
  육: 6,
  여섯: 6,
  칠: 7,
  일곱: 7,
  팔: 8,
  여덟: 8,
  구: 9,
  아홉: 9,
  십: 10,
  열: 10
};

export function parseDestinationVoiceNumber(transcript: string, total: number): number | null {
  const normalized = transcript.trim().replaceAll(" ", "");
  const numeric = normalized.match(/\d{1,2}/)?.[0];
  const number = numeric ? Number(numeric) : Object.entries(KoreanDestinationNumbers)
    .find(([word]) => new RegExp(`${word}(?:번|번째)(?:목적지)?|^${word}$`).test(normalized))?.[1];
  return number && number >= 1 && number <= total ? number - 1 : null;
}

export type DestinationVoiceCommand =
  | { type: "number"; index: number }
  | { type: "next" }
  | { type: "move" }
  | { type: "cancel" }
  | { type: "close" };

export type DestinationVoiceResult = {
  command: DestinationVoiceCommand | null;
  transcript: string;
};

export function parseDestinationVoiceCommand(
  transcript: string,
  total: number
): DestinationVoiceCommand | null {
  const normalized = transcript.trim().replaceAll(" ", "");
  if (!normalized) return null;
  if (/(?:닫기|닫아)/.test(normalized)) return { type: "close" };
  if (/(?:취소|멈춰|그만)/.test(normalized)) return { type: "cancel" };
  if (/(?:이동|출발|안내시작|가자|여기로)/.test(normalized)) return { type: "move" };
  if (/(?:다음|넘겨|다음목적지)/.test(normalized)) return { type: "next" };
  const index = parseDestinationVoiceNumber(normalized, total);
  return index === null ? null : { type: "number", index };
}

export function destinationVoiceSelectionAvailable(
  target: SpeechWindow | null = typeof window === "undefined" ? null : window
): boolean {
  return Boolean(target && (target.SpeechRecognition ?? target.webkitSpeechRecognition));
}

export function listenForDestinationVoiceNumber(
  total: number,
  target: SpeechWindow | null = typeof window === "undefined" ? null : window,
  timeoutMs = 6_000
): Promise<number | null> {
  return listenForDestinationVoiceCommand(total, target, timeoutMs).then((command) => (
    command?.type === "number" ? command.index : null
  ));
}

export function listenForDestinationVoiceCommand(
  total: number,
  target: SpeechWindow | null = typeof window === "undefined" ? null : window,
  timeoutMs = 6_000
): Promise<DestinationVoiceCommand | null> {
  return listenForDestinationVoiceResult(total, target, timeoutMs).then(({ command }) => command);
}

export function listenForDestinationVoiceResult(
  total: number,
  target: SpeechWindow | null = typeof window === "undefined" ? null : window,
  timeoutMs = 6_000
): Promise<DestinationVoiceResult> {
  const Recognition = target?.SpeechRecognition ?? target?.webkitSpeechRecognition;
  if (!target || !Recognition || total <= 0) return Promise.resolve({ command: null, transcript: "" });

  return new Promise((resolve) => {
    const recognition = new Recognition();
    let finished = false;
    const finish = (value: DestinationVoiceResult) => {
      if (finished) return;
      finished = true;
      target.clearTimeout(timer);
      try { recognition.stop(); } catch { /* Some engines end before firing onend. */ }
      resolve(value);
    };
    const timer = target.setTimeout(() => finish({ command: null, transcript: "" }), timeoutMs);
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      finish({ command: parseDestinationVoiceCommand(transcript, total), transcript });
    };
    recognition.onerror = () => finish({ command: null, transcript: "" });
    recognition.onend = () => finish({ command: null, transcript: "" });
    try {
      recognition.start();
    } catch {
      finish({ command: null, transcript: "" });
    }
  });
}

export type DestinationVoiceCue = "confirm" | "selected" | "cancel" | "error";

export function playDestinationVoiceCue(
  cue: DestinationVoiceCue,
  target: Window | null = typeof window === "undefined" ? null : window
) {
  if (!target) return false;
  const audioWindow = target as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) return false;
  try {
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const frequencies: Record<DestinationVoiceCue, [number, number]> = {
      confirm: [620, 820],
      selected: [520, 660],
      cancel: [440, 330],
      error: [240, 210]
    };
    const [start, end] = frequencies[cue];
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.linearRampToValueAtTime(end, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.17);
    oscillator.addEventListener("ended", () => void context.close(), { once: true });
    return true;
  } catch {
    return false;
  }
}

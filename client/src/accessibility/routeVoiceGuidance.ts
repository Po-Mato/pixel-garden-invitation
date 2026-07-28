import type { ViewPreferences } from "./viewPreferences";

export function routeVoiceRateValue(rate: ViewPreferences["routeVoiceRate"]) {
  return rate === "slow" ? 0.88 : rate === "fast" ? 1.2 : 1.05;
}

export function formatRouteVoiceMessage(
  message: string,
  detail: ViewPreferences["routeVoiceDetail"],
  zoneLabel?: string,
  landmarkLabel?: string
) {
  if (detail === "brief") return message;
  return `길찾기 안내. ${zoneLabel ? `현재 ${zoneLabel}. ` : ""}${landmarkLabel ? `${landmarkLabel} 근처. ` : ""}${message}`;
}

type SpeechSynthesisLike = Pick<SpeechSynthesis, "getVoices">;

export function koreanRouteVoice(synthesis: SpeechSynthesisLike | null = (
  typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null
)) {
  return synthesis?.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("ko")) ?? null;
}

export function routeVoiceAvailability(synthesis?: SpeechSynthesisLike | null) {
  const resolved = synthesis === undefined
    ? typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null
    : synthesis;
  if (!resolved) return "unsupported" as const;
  return koreanRouteVoice(resolved) ? "korean" as const : "fallback" as const;
}

export function speakRouteVoiceMessage({
  message,
  rate,
  detail,
  zoneLabel,
  landmarkLabel
}: {
  message: string;
  rate: ViewPreferences["routeVoiceRate"];
  detail: ViewPreferences["routeVoiceDetail"];
  zoneLabel?: string;
  landmarkLabel?: string;
}) {
  if (
    typeof window === "undefined"
    || !("speechSynthesis" in window)
    || typeof SpeechSynthesisUtterance !== "function"
  ) return false;
  const utterance = new SpeechSynthesisUtterance(formatRouteVoiceMessage(message, detail, zoneLabel, landmarkLabel));
  const voice = koreanRouteVoice(window.speechSynthesis);
  utterance.lang = voice?.lang ?? "ko-KR";
  if (voice) utterance.voice = voice;
  utterance.rate = routeVoiceRateValue(rate);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

import type { ViewPreferences } from "./viewPreferences";

export function routeVoiceRateValue(rate: ViewPreferences["routeVoiceRate"]) {
  return rate === "slow" ? 0.88 : rate === "fast" ? 1.2 : 1.05;
}

export function formatRouteVoiceMessage(
  message: string,
  detail: ViewPreferences["routeVoiceDetail"],
  zoneLabel?: string
) {
  if (detail === "brief") return message;
  return `길찾기 안내. ${zoneLabel ? `현재 ${zoneLabel}. ` : ""}${message}`;
}

export function speakRouteVoiceMessage({
  message,
  rate,
  detail,
  zoneLabel
}: {
  message: string;
  rate: ViewPreferences["routeVoiceRate"];
  detail: ViewPreferences["routeVoiceDetail"];
  zoneLabel?: string;
}) {
  if (
    typeof window === "undefined"
    || !("speechSynthesis" in window)
    || typeof SpeechSynthesisUtterance !== "function"
  ) return false;
  const utterance = new SpeechSynthesisUtterance(formatRouteVoiceMessage(message, detail, zoneLabel));
  utterance.lang = "ko-KR";
  utterance.rate = routeVoiceRateValue(rate);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

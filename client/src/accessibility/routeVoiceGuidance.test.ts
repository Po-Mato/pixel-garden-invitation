import { describe, expect, it } from "vitest";
import {
  formatRouteVoiceMessage,
  koreanRouteVoice,
  routeVoiceAvailability,
  routeVoiceRateValue
} from "./routeVoiceGuidance";

describe("routeVoiceGuidance", () => {
  it("keeps brief guidance concise and adds context in detailed mode", () => {
    expect(formatRouteVoiceMessage("오른쪽으로 이동하세요.", "brief", "로비"))
      .toBe("오른쪽으로 이동하세요.");
    expect(formatRouteVoiceMessage("오른쪽으로 이동하세요.", "detailed", "로비", "안내데스크"))
      .toBe("길찾기 안내. 현재 로비. 안내데스크 근처. 오른쪽으로 이동하세요.");
  });

  it("maps the saved speech speed to stable synthesis rates", () => {
    expect(routeVoiceRateValue("slow")).toBeLessThan(routeVoiceRateValue("normal"));
    expect(routeVoiceRateValue("fast")).toBeGreaterThan(routeVoiceRateValue("normal"));
  });

  it("prefers a Korean system voice and reports a fallback when it is absent", () => {
    const korean = { lang: "ko-KR", name: "Korean" } as SpeechSynthesisVoice;
    expect(koreanRouteVoice({ getVoices: () => [{ lang: "en-US" }, korean] as SpeechSynthesisVoice[] }))
      .toBe(korean);
    expect(routeVoiceAvailability({ getVoices: () => [korean] })).toBe("korean");
    expect(routeVoiceAvailability({ getVoices: () => [] })).toBe("fallback");
    expect(routeVoiceAvailability(null)).toBe("unsupported");
  });
});

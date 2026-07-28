import { describe, expect, it } from "vitest";
import { formatRouteVoiceMessage, routeVoiceRateValue } from "./routeVoiceGuidance";

describe("routeVoiceGuidance", () => {
  it("keeps brief guidance concise and adds context in detailed mode", () => {
    expect(formatRouteVoiceMessage("오른쪽으로 이동하세요.", "brief", "로비"))
      .toBe("오른쪽으로 이동하세요.");
    expect(formatRouteVoiceMessage("오른쪽으로 이동하세요.", "detailed", "로비"))
      .toBe("길찾기 안내. 현재 로비. 오른쪽으로 이동하세요.");
  });

  it("maps the saved speech speed to stable synthesis rates", () => {
    expect(routeVoiceRateValue("slow")).toBeLessThan(routeVoiceRateValue("normal"));
    expect(routeVoiceRateValue("fast")).toBeGreaterThan(routeVoiceRateValue("normal"));
  });
});

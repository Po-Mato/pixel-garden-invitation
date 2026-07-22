import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  postInvitationAnalyticsEvents: vi.fn(),
  invitationAnalyticsEventsUrl: vi.fn(() => "https://worker.test/analytics/events")
}));

vi.mock("../api/invitationAnalyticsApi", () => api);

import {
  analyticsContext,
  flushInvitationAnalytics,
  startInvitationAnalytics,
  trackAnalyticsModeOpen,
  trackInvitationAnalytics
} from "./invitationAnalytics";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); }
  };
}

describe("invitation analytics client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.postInvitationAnalyticsEvents.mockResolvedValue(undefined);
    Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
  });

  it("이벤트를 개인 식별자 없이 묶어서 전송한다", async () => {
    trackInvitationAnalytics("map_click", "naver");
    trackInvitationAnalytics("share_click", "copy");
    await flushInvitationAnalytics();
    expect(api.postInvitationAnalyticsEvents).toHaveBeenCalledWith({ events: [
      { name: "map_click", dimension: "naver" },
      { name: "share_click", dimension: "copy" }
    ] });
    expect(JSON.stringify(api.postInvitationAnalyticsEvents.mock.calls[0][0])).not.toMatch(/visitor|session|ip/i);
  });

  it("재방문 여부와 기기 유형을 로컬 상태에서만 계산한다", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    window.localStorage.setItem("wedding:analytics:visited:sample-garden", "1");
    startInvitationAnalytics("entry");
    trackAnalyticsModeOpen("simple");
    await flushInvitationAnalytics();
    expect(api.postInvitationAnalyticsEvents).toHaveBeenCalledWith({ events: expect.arrayContaining([
      { name: "visit", dimension: "entry:returning:mobile" },
      { name: "mode_open", dimension: "simple" }
    ]) });
    expect(analyticsContext()).toBe("simple");
  });
});

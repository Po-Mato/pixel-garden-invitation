import { describe, expect, it, vi } from "vitest";
import {
  isFirstWorldVisit,
  loadWorldTravelHistory,
  recentWorldTravelRecords,
  recordWorldTravel,
  worldTravelTimelineStops,
  worldTravelHistoryStorageKey
} from "./worldTravelHistory";

describe("worldTravelHistory", () => {
  it("첫 구역을 방문 처리하고 새 목적지는 첫 방문으로 구분한다", () => {
    const history = loadWorldTravelHistory("home", null);
    expect(isFirstWorldVisit(history, "home")).toBe(false);
    expect(isFirstWorldVisit(history, "neighborhood")).toBe(true);
  });

  it("포털 이동을 저장하고 최근 이동부터 보여준다", () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    let history = loadWorldTravelHistory("home", storage);
    history = recordWorldTravel(history, {
      from: "home",
      to: "neighborhood",
      portalId: "home-to-neighborhood",
      method: "portal",
      visitedAt: "2026-07-30T10:00:00.000Z"
    }, storage);
    history = recordWorldTravel(history, {
      from: "neighborhood",
      to: "subway-station",
      portalId: "neighborhood-to-station",
      method: "portal",
      visitedAt: "2026-07-30T10:01:00.000Z"
    }, storage);

    expect(isFirstWorldVisit(history, "subway-station")).toBe(false);
    expect(recentWorldTravelRecords(history, 1)[0]).toMatchObject({ to: "subway-station" });
    expect(storage.setItem).toHaveBeenLastCalledWith(worldTravelHistoryStorageKey, expect.any(String));
    expect(worldTravelTimelineStops(history)).toEqual([
      { zoneId: "home", method: "start", visitedAt: null },
      { zoneId: "neighborhood", method: "portal", visitedAt: "2026-07-30T10:00:00.000Z" },
      { zoneId: "subway-station", method: "portal", visitedAt: "2026-07-30T10:01:00.000Z" }
    ]);
  });

  it("깨진 저장값은 안전하게 초기화한다", () => {
    const storage = { getItem: vi.fn(() => "{"), setItem: vi.fn() };
    expect(loadWorldTravelHistory("home", storage)).toEqual({
      version: 1,
      visitedZoneIds: ["home"],
      records: []
    });
  });
});

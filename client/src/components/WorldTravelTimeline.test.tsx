import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { gardenWorld } from "../game/world";
import type { WorldTravelHistory } from "../game/worldTravelHistory";
import { WorldTravelTimeline } from "./WorldTravelTimeline";

describe("WorldTravelTimeline", () => {
  it("실제 이동 순서를 보여주고 이전 방문지 이동을 요청한다", () => {
    const onSelectZone = vi.fn();
    const history: WorldTravelHistory = {
      version: 1,
      visitedZoneIds: ["home", "neighborhood", "subway-station"],
      records: [
        { id: "1", from: "home", to: "neighborhood", method: "portal", visitedAt: "2026-07-30T10:00:00Z" },
        { id: "2", from: "neighborhood", to: "subway-station", method: "portal", visitedAt: "2026-07-30T10:01:00Z" }
      ]
    };
    render(<WorldTravelTimeline
      zones={gardenWorld.zones}
      history={history}
      activeZoneId="subway-station"
      onSelectZone={onSelectZone}
    />);

    expect(screen.getByLabelText("최근 방문 여정")).toHaveTextContent("3/10");
    fireEvent.click(screen.getByRole("button", { name: "우리 집 다시 이동" }));
    expect(onSelectZone).toHaveBeenCalledWith("home");
    expect(screen.getByRole("button", { name: "지하철 역사, 현재 위치" })).toBeDisabled();
  });
});

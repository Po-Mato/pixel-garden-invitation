import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyJourneyProgress, journeyCheckpoints } from "../game/journeyProgress";
import { getWorldZone, gardenWorld } from "../game/world";
import { JourneyRouteSheet } from "./JourneyRouteSheet";

afterEach(cleanup);

describe("JourneyRouteSheet", () => {
  it("전체 여정 요약과 비시각 이동 순서를 제공한다", () => {
    const onStart = vi.fn();
    render(
      <JourneyRouteSheet
        activeZone={getWorldZone(gardenWorld, "home")}
        checkpoint={journeyCheckpoints[1]}
        progress={createEmptyJourneyProgress()}
        guidance={{ available: true, direction: "up", tileCount: 7, path: [], destinationPoint: { x: 0, y: 0 }, portalId: "home-out" }}
        onClose={vi.fn()}
        onStart={onStart}
      />
    );

    expect(screen.getByRole("dialog", { name: "쉬운 길찾기" })).toBeInTheDocument();
    expect(screen.getByLabelText("남은 전체 여정 요약")).toHaveTextContent("5남은 추억");
    expect(screen.getByRole("list", { name: /이동 순서/ })).toHaveTextContent("우리 집");
    fireEvent.click(screen.getByRole("button", { name: "길 안내 시작" }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});

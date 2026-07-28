import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyJourneyProgress, journeyCheckpoints } from "../game/journeyProgress";
import { getWorldZone, gardenWorld } from "../game/world";
import { JourneyRouteSheet } from "./JourneyRouteSheet";

afterEach(cleanup);

describe("JourneyRouteSheet", () => {
  it("전체 여정 요약과 비시각 이동 순서를 제공한다", () => {
    const onStart = vi.fn();
    const onOpenSimpleDestination = vi.fn();
    render(
      <JourneyRouteSheet
        activeZone={getWorldZone(gardenWorld, "home")}
        checkpoint={journeyCheckpoints[1]}
        progress={createEmptyJourneyProgress()}
        guidance={{ available: true, direction: "up", tileCount: 7, path: [], destinationPoint: { x: 0, y: 0 }, portalId: "home-out" }}
        onClose={vi.fn()}
        onStart={onStart}
        onOpenSimpleDestination={onOpenSimpleDestination}
      />
    );

    expect(screen.getByRole("dialog", { name: "쉬운 길찾기" })).toBeInTheDocument();
    expect(screen.getByLabelText("남은 전체 여정 요약")).toHaveTextContent("5남은 추억");
    expect(screen.getByRole("list", { name: /이동 순서/ })).toHaveTextContent("우리 집");
    fireEvent.click(screen.getByRole("button", { name: "길 안내 시작" }));
    expect(onStart).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /간편 초대장에서 이 목적지 보기/ }));
    expect(onOpenSimpleDestination).toHaveBeenCalledWith(journeyCheckpoints[1]);
  });

  it("계단 없는 길을 켜면 엘리베이터와 화장실 확인 안내를 펼친다", () => {
    const onStepFreeRouteChange = vi.fn();
    render(
      <JourneyRouteSheet
        activeZone={getWorldZone(gardenWorld, "home")}
        checkpoint={journeyCheckpoints[0]}
        progress={createEmptyJourneyProgress()}
        guidance={null}
        estimatedTotalLabel="약 2분"
        estimatedTileCount={128}
        estimatedPortalCount={3}
        stepFreeRouteEnabled
        onStepFreeRouteChange={onStepFreeRouteChange}
        onClose={vi.fn()}
        onStart={vi.fn()}
      />
    );

    expect(screen.getByText("엘리베이터")).toBeInTheDocument();
    expect(screen.getByText("도착 랜드마크")).toBeInTheDocument();
    expect(screen.getByText("좌석·도착 도움")).toBeInTheDocument();
    expect(screen.getByText("접근 가능한 화장실")).toBeInTheDocument();
    expect(screen.getByText(/현재 위치 기준 128타일 · 포털 3회/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /032-347-5500 편의시설 전화 확인/ })).toHaveAttribute("href", "tel:0323475500");
    expect(screen.getByText(/공개 안내에 없어 방문 전 확인/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "계단 없는 길 우선" }));
    expect(onStepFreeRouteChange).toHaveBeenCalledWith(false);
  });

  it("추천·최단·계단 없는 경로를 수치로 비교하고 선택한다", () => {
    const onRoutePreferenceChange = vi.fn();
    render(
      <JourneyRouteSheet
        activeZone={getWorldZone(gardenWorld, "home")}
        checkpoint={journeyCheckpoints[0]}
        progress={createEmptyJourneyProgress()}
        guidance={null}
        routePreference="recommended"
        routeComparisonOptions={[
          {
            id: "recommended",
            label: "추천 경로",
            detail: "예식 흐름에 맞춘 순서",
            tileCount: 120,
            portalCount: 8,
            estimatedLabel: "약 1분"
          },
          {
            id: "shortest",
            label: "최단 경로",
            detail: "총 이동을 가장 짧게",
            tileCount: 98,
            portalCount: 6,
            estimatedLabel: "약 50초"
          },
          {
            id: "step-free",
            label: "계단 없는 길",
            detail: "엘리베이터·편의 안내 포함",
            tileCount: 120,
            portalCount: 8,
            estimatedLabel: "약 1분"
          }
        ]}
        onRoutePreferenceChange={onRoutePreferenceChange}
        onClose={vi.fn()}
        onStart={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /추천 경로/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /최단 경로/ })).toHaveTextContent("98타일 · 포털 6회");
    fireEvent.click(screen.getByRole("button", { name: /계단 없는 길 엘리베이터/ }));
    expect(onRoutePreferenceChange).toHaveBeenCalledWith("step-free");
  });
});

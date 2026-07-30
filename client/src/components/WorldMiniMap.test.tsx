import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeCameraTransform } from "../game/camera";
import { createMiniMapLayout, projectMiniMapRect } from "../game/minimap";
import { gardenWorld, getWorldZone, portalEntryRect } from "../game/world";
import { WorldMiniMap } from "./WorldMiniMap";

afterEach(cleanup);

describe("WorldMiniMap", () => {
  it("renders the active map structure, viewport, player, and target portal", () => {
    const zone = getWorldZone(gardenWorld, "home");
    const viewport = { width: 390, height: 520 };
    const player = { x: 135, y: 405 };
    render(
      <WorldMiniMap
        zone={zone}
        player={player}
        direction="up"
        camera={computeCameraTransform({ player, viewport, bounds: zone.bounds, zoom: 1 })}
        viewport={viewport}
        targetPortalId="home-to-neighborhood"
        journeyMarkers={[{ id: "directions", point: { x: 150, y: 225 }, completed: true }]}
        collectibleMarkers={[{
          id: "home-petal",
          point: { x: 225, y: 405 },
          kind: "petal",
          highlighted: true
        }]}
        relationshipStampMarkers={[{
          id: "bride:bridal-room",
          label: "신부 대기실의 인사",
          point: { x: 210, y: 330 },
          unlocked: false,
          recommended: true
        }]}
      />
    );

    const minimap = screen.getByRole("complementary", { name: "현재 구역 미니맵" });
    expect(within(minimap).getByText("우리 집")).toBeInTheDocument();
    expect(within(minimap).getByTestId("minimap-map-boundary")).toBeInTheDocument();
    expect(within(minimap).getAllByTestId("minimap-path")).toHaveLength(zone.paths.length);
    expect(within(minimap).getAllByTestId("minimap-obstacle")).toHaveLength(zone.blocked.length);
    expect(within(minimap).getAllByTestId("minimap-portal")).toHaveLength(zone.portals.length);
    expect(within(minimap).getAllByTestId("minimap-spot")).toHaveLength(zone.spots.length);
    expect(within(minimap).queryAllByTestId("minimap-photo-spot")).toHaveLength(zone.photoSpots.length);
    expect(within(minimap).getByTestId("minimap-viewport")).toBeInTheDocument();
    expect(within(minimap).getByTestId("minimap-player")).toHaveAttribute("data-direction", "up");
    expect(within(minimap).getByTestId("minimap-journey-marker")).toHaveClass("world-minimap__journey-marker--complete");
    expect(within(minimap).getByTestId("minimap-collectible-marker"))
      .toHaveAttribute("data-highlighted", "true");
    expect(within(minimap).getByTestId("minimap-collectible-marker"))
      .toHaveAttribute("data-shape", "petal");
    expect(within(minimap).getByTestId("minimap-relationship-stamp"))
      .toHaveAttribute("data-recommended", "true");
    expect(within(minimap).getByRole("heading", { name: "우리 집 지도 안내" })).toBeInTheDocument();
    const portal = within(minimap).getByTestId("minimap-portal");
    expect(portalEntryRect(zone.portals[0])).toEqual({ x: 240, y: 90, width: 90, height: 30 });
    const projectedPortal = projectMiniMapRect(
      portalEntryRect(zone.portals[0]),
      zone.bounds,
      createMiniMapLayout(zone.bounds)
    );
    expect(portal).toHaveClass("world-minimap__portal--target");
    expect(portal).toHaveAttribute("x", String(projectedPortal.x));
    expect(portal).toHaveAttribute("y", String(projectedPortal.y));
    expect(portal).toHaveAttribute("width", String(projectedPortal.width));
    expect(portal).toHaveAttribute("height", String(projectedPortal.height));
  });

  it("preserves the tall ceremony hall shape", () => {
    const zone = getWorldZone(gardenWorld, "ceremony-hall");
    const viewport = { width: 390, height: 640 };
    const player = zone.spawn;
    const { container } = render(
      <WorldMiniMap
        zone={zone}
        player={player}
        direction="down"
        camera={computeCameraTransform({ player, viewport, bounds: zone.bounds, zoom: 1 })}
        viewport={viewport}
        targetPortalId={null}
      />
    );

    const svg = container.querySelector(".world-minimap__canvas");
    expect(Number(svg?.getAttribute("width"))).toBeLessThanOrEqual(72);
    expect(Number(svg?.getAttribute("height"))).toBe(120);
    expect(screen.getByTestId("minimap-photo-spot")).toBeInTheDocument();
  });

  it("highlights the recommended destination and draws a route from the player", () => {
    const zone = getWorldZone(gardenWorld, "home");
    const viewport = { width: 390, height: 520 };
    const player = zone.spawn;
    const { container } = render(
      <WorldMiniMap
        zone={zone}
        player={player}
        direction="down"
        camera={computeCameraTransform({ player, viewport, bounds: zone.bounds, zoom: 1 })}
        viewport={viewport}
        targetPortalId={null}
        destinationLabel="오시는 길"
        routeActive
        routeKind="selected"
        routePoints={[
          player,
          { x: 285, y: 525 },
          { x: 255, y: 525 },
          { x: 255, y: 495 }
        ]}
        routeProgressLabel="3타일 · 약 1초"
        journeyMarkers={[{
          id: "directions",
          point: { x: 150, y: 225 },
          completed: false,
          recommended: true
        }]}
      />
    );

    const minimap = container.querySelector(".world-minimap");
    expect(minimap).not.toBeNull();
    expect(within(minimap as HTMLElement).getByText("목적지 · 오시는 길")).toBeInTheDocument();
    expect(within(minimap as HTMLElement).getByTestId("minimap-route-progress")).toHaveTextContent("이동 중 · 3타일 · 약 1초");
    const route = within(minimap as HTMLElement).getByTestId("minimap-destination-route");
    expect(route).toHaveAttribute("data-route-active", "true");
    expect(route).toHaveAttribute("data-route-kind", "selected");
    expect(route.querySelector('[data-surface="wood"]')).toBeInTheDocument();
    expect(route.querySelector(".world-minimap__route-outline")).toBeInTheDocument();
    expect(route.querySelector(".world-minimap__route-path")).toBeInTheDocument();
    expect(within(minimap as HTMLElement).getByTestId("minimap-journey-marker")).toHaveClass("world-minimap__journey-marker--recommended");
  });

  it("draws the companion trail and reserved rendezvous on both map sizes", () => {
    const zone = getWorldZone(gardenWorld, "home");
    const viewport = { width: 390, height: 520 };
    render(
      <WorldMiniMap
        zone={zone}
        player={zone.spawn}
        direction="right"
        camera={computeCameraTransform({ player: zone.spawn, viewport, bounds: zone.bounds, zoom: 1 })}
        viewport={viewport}
        targetPortalId={null}
        companionTrailPoints={[zone.spawn, { x: zone.spawn.x + 30, y: zone.spawn.y }]}
        rendezvousPoint={{ x: zone.spawn.x + 60, y: zone.spawn.y }}
      />
    );

    expect(screen.getByTestId("minimap-companion-trail")).toBeInTheDocument();
    expect(screen.getByTestId("minimap-rendezvous")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "미니맵 확대 보기" }));
    expect(screen.getAllByTestId("minimap-companion-trail")).toHaveLength(2);
    expect(screen.getAllByTestId("minimap-rendezvous")).toHaveLength(2);
  });

  it("splits the projected route when the map material changes", () => {
    const zone = getWorldZone(gardenWorld, "neighborhood");
    const viewport = { width: 390, height: 520 };
    const player = { x: 450, y: 375 };
    const { container } = render(
      <WorldMiniMap
        zone={zone}
        player={player}
        direction="right"
        camera={computeCameraTransform({ player, viewport, bounds: zone.bounds, zoom: 1 })}
        viewport={viewport}
        targetPortalId={null}
        routePoints={[
          player,
          { x: 480, y: 375 },
          { x: 510, y: 375 },
          { x: 540, y: 375 },
          { x: 570, y: 375 }
        ]}
      />
    );

    const route = container.querySelector('[data-testid="minimap-destination-route"]');
    expect(route).not.toBeNull();
    expect([...route!.querySelectorAll("[data-surface]")].map((segment) => segment.getAttribute("data-surface")))
      .toEqual(["asphalt", "concrete"]);
  });

  it("opens a full-route preview without forwarding map clicks", () => {
    const zone = getWorldZone(gardenWorld, "home");
    const viewport = { width: 390, height: 520 };
    const player = zone.spawn;
    render(
      <WorldMiniMap
        zone={zone}
        player={player}
        direction="up"
        camera={computeCameraTransform({ player, viewport, bounds: zone.bounds, zoom: 1 })}
        viewport={viewport}
        targetPortalId="home-to-neighborhood"
        destinationLabel="웨딩 갤러리"
        routeActive
        routeContinuing
        routeKind="journey"
        routePoints={[player, { x: 285, y: 525 }, { x: 255, y: 525 }]}
        routeProgressLabel="18타일 · 포털 2회 · 약 6초"
        routeNotice={{ deltaTiles: 3, notice: "우회 +3타일", kind: "detour" }}
        journeyStops={[
          { id: "home-0", zoneLabel: "우리 집", portalLabel: "동네로 나가기", current: true },
          { id: "neighborhood-1", zoneLabel: "동네 거리", portalLabel: "지하철 타기" },
          { id: "subway-2", zoneLabel: "지하철역", portalLabel: null }
        ]}
        journeyDestinationLabels={["오시는 길", "웨딩 갤러리"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "미니맵 확대 보기" }));
    const dialog = screen.getByRole("dialog", { name: "현재 경로 전체 미리보기" });
    expect(within(dialog).getAllByText("웨딩 갤러리", { exact: false })).toHaveLength(2);
    expect(within(dialog).getByText("연속 안내")).toBeInTheDocument();
    expect(within(dialog).getByTestId("minimap-destination-route")).toHaveAttribute("data-route-active", "true");
    expect(within(dialog).getByRole("region", { name: "남은 전체 여정" })).toHaveTextContent("포털 2회");
    expect(within(dialog).getByText("동네 거리")).toBeInTheDocument();
    expect(within(dialog).getByText("웨딩 갤러리")).toBeInTheDocument();
    expect(within(dialog).getByText("우회 +3타일")).toBeInTheDocument();

    const visualMap = within(dialog).getByRole("region", { name: "미니맵 시각 탐색" });
    const expandedCanvas = visualMap.querySelector(".world-minimap__canvas--expanded");
    fireEvent.click(within(visualMap).getByRole("button", { name: "미니맵 확대" }));
    expect(expandedCanvas).toHaveAttribute("data-view-scale", "1.25");
    fireEvent.pointerDown(visualMap, { pointerId: 1, clientX: 120, clientY: 100 });
    fireEvent.pointerMove(visualMap, { pointerId: 1, clientX: 145, clientY: 115 });
    fireEvent.pointerUp(visualMap, { pointerId: 1, clientX: 145, clientY: 115 });
    expect(expandedCanvas?.getAttribute("style")).not.toContain("NaN");
    fireEvent.click(within(visualMap).getByRole("button", { name: "미니맵 원위치" }));
    expect(expandedCanvas).toHaveAttribute("data-view-scale", "1");

    fireEvent.click(within(dialog).getByRole("button", { name: "미니맵 닫기" }));
    expect(screen.queryByRole("dialog", { name: "현재 경로 전체 미리보기" })).not.toBeInTheDocument();
  });

  it("cycles landmarks with switch-friendly controls and starts navigation", () => {
    const zone = getWorldZone(gardenWorld, "lobby");
    const viewport = { width: 390, height: 520 };
    const onNavigate = vi.fn();
    render(<WorldMiniMap
      zone={zone}
      player={zone.spawn}
      direction="down"
      camera={computeCameraTransform({ player: zone.spawn, viewport, bounds: zone.bounds, zoom: 1 })}
      viewport={viewport}
      targetPortalId={null}
      onNavigateAccessibilityLandmark={onNavigate}
    />);
    fireEvent.click(screen.getByRole("button", { name: "미니맵 확대 보기" }));
    const dialog = screen.getByRole("dialog", { name: "현재 경로 전체 미리보기" });
    const firstLabel = within(dialog).getByRole("region", { name: "목적지 순차 탐색" }).textContent;
    fireEvent.click(within(dialog).getByRole("button", { name: "다음 목적지" }));
    expect(within(dialog).getByRole("region", { name: "목적지 순차 탐색" }).textContent).not.toBe(firstLabel);
    expect(within(dialog).getByRole("list", { name: "목적지 번호 목록" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "이곳으로 이동" }));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String), point: expect.any(Object) }));
  });

  it("activates the highlighted destination with a single switch during automatic scanning", () => {
    const zone = getWorldZone(gardenWorld, "lobby");
    const viewport = { width: 390, height: 520 };
    const onNavigate = vi.fn();
    render(<WorldMiniMap
      zone={zone}
      player={zone.spawn}
      direction="down"
      camera={computeCameraTransform({ player: zone.spawn, viewport, bounds: zone.bounds, zoom: 1 })}
      viewport={viewport}
      targetPortalId={null}
      onNavigateAccessibilityLandmark={onNavigate}
    />);
    fireEvent.click(screen.getByRole("button", { name: "미니맵 확대 보기" }));
    const autoScan = screen.getByRole("button", { name: "자동 스캔" });
    fireEvent.click(autoScan);
    expect(autoScan).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(window, { key: " " });
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }));
  });

  it("repeats landmark guidance and edits custom voice call phrases", () => {
    const zone = getWorldZone(gardenWorld, "lobby");
    const viewport = { width: 390, height: 520 };
    render(<WorldMiniMap
      zone={zone}
      player={zone.spawn}
      direction="down"
      camera={computeCameraTransform({ player: zone.spawn, viewport, bounds: zone.bounds, zoom: 1 })}
      viewport={viewport}
      targetPortalId={null}
    />);
    fireEvent.click(screen.getByRole("button", { name: "미니맵 확대 보기" }));
    fireEvent.click(screen.getByRole("button", { name: "안내 반복" }));
    expect(screen.getByText(/안내를 다시 읽었어요/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "음성 명령 설정" }));
    const movePhrase = screen.getByRole("textbox", { name: "이동" });
    expect(screen.getByRole("group", { name: "음성 명령 프로필" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "짧은 명령" }));
    expect(movePhrase).toHaveValue("가자");
    fireEvent.change(movePhrase, { target: { value: "출발해" } });
    expect(movePhrase).toHaveValue("출발해");
  });
});

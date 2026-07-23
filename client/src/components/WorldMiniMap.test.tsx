import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { computeCameraTransform } from "../game/camera";
import { createMiniMapLayout, projectMiniMapRect } from "../game/minimap";
import { gardenWorld, getWorldZone, portalEntryRect } from "../game/world";
import { WorldMiniMap } from "./WorldMiniMap";

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

    const svg = container.querySelector("svg");
    expect(Number(svg?.getAttribute("width"))).toBeLessThanOrEqual(72);
    expect(Number(svg?.getAttribute("height"))).toBe(120);
    expect(screen.getByTestId("minimap-photo-spot")).toBeInTheDocument();
  });
});

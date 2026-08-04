import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  gardenWorld,
  getWorldZone,
  worldForegroundPlacements
} from "../game/world";
import { defaultWorldGeometryAuditLayers } from "../game/worldGeometryAuditLayers";
import { WorldGeometryAuditOverlay } from "./WorldGeometryAuditOverlay";

afterEach(cleanup);

describe("WorldGeometryAuditOverlay", () => {
  it("keeps collision and depth diagnostics out of the normal game view", () => {
    const lobby = getWorldZone(gardenWorld, "lobby");
    render(<WorldGeometryAuditOverlay zone={lobby} enabled={false} />);

    expect(screen.queryByTestId("world-geometry-audit")).not.toBeInTheDocument();
  });

  it("labels the active zone collision regions and foreground depth lines", () => {
    const lobby = getWorldZone(gardenWorld, "lobby");
    const { container } = render(<WorldGeometryAuditOverlay zone={lobby} enabled />);

    expect(screen.getByTestId("world-geometry-audit")).toHaveAttribute("data-zone", "lobby");
    expect(container.querySelectorAll(".world-geometry-audit__collision")).toHaveLength(lobby.blocked.length);
    expect(container.querySelectorAll(".world-geometry-audit__foreground"))
      .toHaveLength(worldForegroundPlacements.lobby.length);

    const desk = container.querySelector<HTMLElement>('[data-decoration-id="lobby-desk"]');
    const depthLine = desk?.querySelector<HTMLElement>(".world-geometry-audit__depth");
    expect(desk).toHaveStyle({ left: "450px", top: "360px", width: "180px", height: "120px" });
    expect(depthLine).toHaveAttribute("data-depth-y", "480");
    expect(depthLine).toHaveStyle({ top: "120px" });
    expect(screen.getByText(/청록 전경 · 금색 충돌 · 분홍 깊이선/)).toBeInTheDocument();
  });

  it("independently filters the grid, collision, depth, and identifier layers", () => {
    const lobby = getWorldZone(gardenWorld, "lobby");
    const { container, rerender } = render(
      <WorldGeometryAuditOverlay
        zone={lobby}
        enabled
        layers={{ ...defaultWorldGeometryAuditLayers, grid: false, collision: false }}
      />
    );

    expect(container.querySelectorAll(".world-geometry-audit__tile")).toHaveLength(0);
    expect(container.querySelectorAll(".world-geometry-audit__collision")).toHaveLength(0);
    expect(container.querySelectorAll(".world-geometry-audit__depth")).toHaveLength(1);
    expect(screen.getByText("lobby-desk")).toBeInTheDocument();

    rerender(
      <WorldGeometryAuditOverlay
        zone={lobby}
        enabled
        layers={{ ...defaultWorldGeometryAuditLayers, depth: false, labels: false }}
      />
    );
    expect(container.querySelectorAll(".world-geometry-audit__depth")).toHaveLength(0);
    expect(screen.queryByText("lobby-desk")).not.toBeInTheDocument();
  });
});

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

    const desk = container.querySelector<HTMLElement>(
      '.world-geometry-audit__foreground[data-decoration-id="lobby-desk"]'
    );
    const depthLine = desk?.querySelector<HTMLElement>(".world-geometry-audit__depth");
    expect(desk).toHaveStyle({ left: "450px", top: "360px", width: "180px", height: "120px" });
    expect(depthLine).toHaveAttribute("data-depth-y", "480");
    expect(depthLine).toHaveStyle({ top: "120px" });
    const recommendedDepthLine = desk?.querySelector<HTMLElement>(".world-geometry-audit__depth--recommended");
    expect(recommendedDepthLine).toHaveAttribute("data-recommended-depth-y", "475");
    expect(recommendedDepthLine).toHaveStyle({ top: "115px" });
    const currentCollision = container.querySelector<HTMLElement>(
      '.world-geometry-audit__foreground-collision--current[data-decoration-id="lobby-desk"]'
    );
    const recommendedCollision = container.querySelector<HTMLElement>(
      '.world-geometry-audit__foreground-collision--recommended[data-decoration-id="lobby-desk"]'
    );
    expect(currentCollision).toHaveStyle({ left: "450px", top: "390px", width: "180px", height: "90px" });
    expect(recommendedCollision).toHaveStyle({ left: "456px", top: "437px", width: "158px", height: "42px" });
    expect(recommendedCollision).toHaveAttribute("data-review-decision", "pending");
    expect(screen.getByText(/깊이 분홍\/보라 · 충돌 청록\/보라 추천/)).toBeInTheDocument();
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
    expect(container.querySelectorAll(".world-geometry-audit__foreground-collision")).toHaveLength(0);
    expect(container.querySelectorAll(".world-geometry-audit__depth")).toHaveLength(2);
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

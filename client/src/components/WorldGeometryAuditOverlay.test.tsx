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
    expect(depthLine).toHaveAttribute("data-depth-y", "475");
    expect(depthLine).toHaveStyle({ top: "115px" });
    const recommendedDepthLine = desk?.querySelector<HTMLElement>(".world-geometry-audit__depth--recommended");
    expect(recommendedDepthLine).not.toBeInTheDocument();
    const currentCollision = container.querySelector<HTMLElement>('.world-geometry-audit__collision[data-collision-index="0"]');
    expect(currentCollision).toHaveStyle({ left: "456px", top: "437px", width: "158px", height: "42px" });
    expect(container.querySelector('.world-geometry-audit__foreground-collision--recommended[data-decoration-id="lobby-desk"]'))
      .not.toBeInTheDocument();
    expect(container.querySelectorAll('.world-geometry-audit__heatmap[data-decoration-id="lobby-desk"]')).toHaveLength(0);
    expect(screen.getByText(/차이 히트 COLOR/)).toBeInTheDocument();
  });

  it("renders imported patch geometry with colorblind and high-contrast heatmap modes", () => {
    const lobby = getWorldZone(gardenWorld, "lobby");
    const preview = [{
      key: "lobby/lobby-desk",
      zoneId: "lobby" as const,
      decorationId: "lobby-desk",
      current: { depthY: 475, collision: { x: 456, y: 437, width: 158, height: 42 } },
      recommended: { depthY: 472, collision: { x: 460, y: 440, width: 150, height: 36 } },
      depthChanged: true,
      collisionChanged: true
    }];
    const { container, rerender } = render(
      <WorldGeometryAuditOverlay zone={lobby} enabled heatmapMode="pattern" previewRecommendations={preview} />
    );
    expect(screen.getByTestId("world-geometry-audit")).toHaveAttribute("data-patch-preview", "true");
    expect(screen.getByTestId("world-geometry-audit")).toHaveAttribute("data-heatmap-mode", "pattern");
    expect(container.querySelector(".world-geometry-audit__depth--recommended"))
      .toHaveAttribute("data-recommended-depth-y", "472");
    rerender(<WorldGeometryAuditOverlay zone={lobby} enabled heatmapMode="contrast" previewRecommendations={preview} />);
    expect(screen.getByTestId("world-geometry-audit")).toHaveAttribute("data-heatmap-mode", "contrast");
  });

  it("independently filters the grid, collision, depth, and identifier layers", () => {
    const lobby = getWorldZone(gardenWorld, "lobby");
    const { container, rerender } = render(
      <WorldGeometryAuditOverlay
        zone={lobby}
        enabled
        layers={{ ...defaultWorldGeometryAuditLayers, grid: false, collision: false, heatmap: false }}
      />
    );

    expect(container.querySelectorAll(".world-geometry-audit__tile")).toHaveLength(0);
    expect(container.querySelectorAll(".world-geometry-audit__collision")).toHaveLength(0);
    expect(container.querySelectorAll(".world-geometry-audit__foreground-collision")).toHaveLength(0);
    expect(container.querySelectorAll(".world-geometry-audit__heatmap")).toHaveLength(0);
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

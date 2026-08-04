import { render } from "@testing-library/react";
import type { WorldDecoration as WorldDecorationData } from "../game/world";
import { describe, expect, it } from "vitest";
import { WorldDecoration } from "./WorldDecoration";

const assetDecoration = {
  id: "tree-canopy",
  kind: "tree",
  label: "전경 나무",
  x: 120,
  y: 240,
  width: 90,
  height: 150,
  asset: "tree-canopy.png",
  depthY: 390
};

describe("WorldDecoration", () => {
  it("renders an asset decoration at its map URL and shared Y depth", () => {
    const { container } = render(
      <WorldDecoration zoneId="neighborhood" decoration={assetDecoration as WorldDecorationData} />
    );
    const decoration = container.querySelector("img");
    const shadow = container.querySelector('[data-shadow-for="tree-canopy"]');

    expect(decoration).toHaveAttribute("src", "/assets/maps/v2/neighborhood/tree-canopy.png");
    expect(decoration).toHaveStyle({ zIndex: "1390" });
    expect(shadow).toHaveStyle({ left: "132.6px", top: "384px", width: "64.8px", height: "12px", zIndex: "1389" });
  });

  it("keeps overhead foreground assets free of a ground shadow", () => {
    const { container } = render(
      <WorldDecoration
        zoneId="subway-train"
        decoration={{ ...assetDecoration, depthMode: "overhead" } as WorldDecorationData}
      />
    );

    expect(container.querySelector(".world-decoration-ground-shadow")).not.toBeInTheDocument();
  });

  it("does not create DOM for a decoration without an asset", () => {
    const { container } = render(
      <WorldDecoration
        zoneId="neighborhood"
        decoration={{ ...assetDecoration, asset: undefined } as WorldDecorationData}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

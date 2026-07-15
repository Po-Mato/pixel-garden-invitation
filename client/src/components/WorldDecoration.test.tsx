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

    expect(decoration).toHaveAttribute("src", "/assets/maps/v2/neighborhood/tree-canopy.png");
    expect(decoration).toHaveStyle({ zIndex: "1390" });
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

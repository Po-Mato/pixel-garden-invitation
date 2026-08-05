import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorldDecoration as WorldDecorationData, WorldPath } from "../game/world";
import { WorldDecorationLayer, WorldPathLayer } from "./WorldStaticMapLayers";

const decorationRender = vi.fn();
vi.mock("./WorldDecoration", () => ({
  WorldDecoration: (props: { decoration: WorldDecorationData }) => {
    decorationRender(props.decoration.id);
    return <i data-decoration={props.decoration.id} />;
  }
}));

describe("static world render boundaries", () => {
  it("does not rebuild map paths when a moving parent renders again", () => {
    const paths = [{ id: "aisle", kind: "floor", x: 0, y: 0, width: 100, height: 20 }] as WorldPath[];
    const view = render(<WorldPathLayer paths={paths} />);
    const path = view.container.firstElementChild;
    view.rerender(<WorldPathLayer paths={paths} />);
    expect(view.container.firstElementChild).toBe(path);
  });

  it("does not rerender decoration assets while only the player moves", () => {
    decorationRender.mockClear();
    const decorations = [{
      id: "tree",
      kind: "tree",
      label: "나무",
      x: 0,
      y: 0,
      width: 40,
      height: 60,
      asset: "tree.png"
    }] as WorldDecorationData[];
    const view = render(<WorldDecorationLayer zoneId="home" decorations={decorations} />);
    view.rerender(<WorldDecorationLayer zoneId="home" decorations={decorations} />);
    expect(decorationRender).toHaveBeenCalledTimes(1);
  });
});

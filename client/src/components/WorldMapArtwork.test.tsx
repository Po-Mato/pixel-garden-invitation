import { fireEvent, render } from "@testing-library/react";
import { expect, it } from "vitest";
import { WorldMapArtwork } from "./WorldMapArtwork";

it("renders the zone background as a non-draggable decorative image", () => {
  const { container } = render(<WorldMapArtwork zoneId="home" />);
  const image = container.querySelector(".world-map-artwork__background");

  expect(image).toHaveAttribute("src", "/assets/maps/v2/home/background.webp");
  expect(image).toHaveAttribute("alt", "");
  expect(image).toHaveAttribute("draggable", "false");
});

it("hides the background image when it cannot be loaded", () => {
  const { container } = render(<WorldMapArtwork zoneId="banquet" />);
  const image = container.querySelector(".world-map-artwork__background");

  fireEvent.error(image as HTMLImageElement);

  expect(image).toHaveAttribute("hidden");
});

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

it("creates a visible background image when the zone changes after an image error", () => {
  const { container, rerender } = render(<WorldMapArtwork zoneId="home" />);
  const failedImage = container.querySelector(".world-map-artwork__background");

  fireEvent.error(failedImage as HTMLImageElement);
  rerender(<WorldMapArtwork zoneId="banquet" />);

  const nextImage = container.querySelector(".world-map-artwork__background");
  expect(nextImage).not.toBe(failedImage);
  expect(nextImage).toHaveAttribute("src", "/assets/maps/v2/banquet/background.webp");
  expect(nextImage).not.toHaveAttribute("hidden");
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { afterEach, expect, it, vi } from "vitest";
import { CharacterSprite } from "./CharacterSprite";

afterEach(() => {
  cleanup();
});

it("renders layers in stable back-to-front order", () => {
  const appearance = {
    ...defaultCharacterAppearance,
    accessories: {
      face: "glasses-round-gold",
      jewelry: "earrings-pearl",
      neckwear: "brooch-floral",
      carry: "shoulder-bag-structured"
    }
  };

  render(
    <CharacterSprite
      appearance={appearance}
      direction="right"
      moving={true}
      stepFrame={2}
      label="하객 캐릭터"
    />
  );

  const sprite = screen.getByLabelText("하객 캐릭터");
  expect([...sprite.querySelectorAll("[data-character-layer]")].map((node) => node.getAttribute("data-character-layer")))
    .toEqual(["back-accessory", "back-hair", "base", "outfit", "front-hair", "face", "jewelry", "neckwear"]);
});

it("uses the two-frame idle class only when facing down and stopped", () => {
  const { rerender } = render(
    <CharacterSprite appearance={defaultCharacterAppearance} direction="down" moving={false} label="캐릭터" />
  );
  expect(screen.getByLabelText("캐릭터")).toHaveClass("character-sprite--idle-front");

  rerender(<CharacterSprite appearance={defaultCharacterAppearance} direction="left" moving={false} label="캐릭터" />);
  expect(screen.getByLabelText("캐릭터")).not.toHaveClass("character-sprite--idle-front");
});

it("hides only a failed layer and keeps sibling layers", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(
    <CharacterSprite
      appearance={defaultCharacterAppearance}
      direction="down"
      moving={false}
      label="캐릭터"
    />
  );

  const sprite = screen.getByLabelText("캐릭터");
  const failedLayer = sprite.querySelector('[data-character-layer="back-hair"]');
  const failedImage = failedLayer?.querySelector("img");
  expect(failedImage).toBeInTheDocument();

  fireEvent.error(failedImage as HTMLImageElement);

  expect(sprite.querySelector('[data-character-layer="back-hair"]')).not.toBeInTheDocument();
  expect(sprite.querySelector('[data-character-layer="base"]')).toBeInTheDocument();
  expect(sprite.querySelector('[data-character-layer="outfit"]')).toBeInTheDocument();
  errorSpy.mockRestore();
});

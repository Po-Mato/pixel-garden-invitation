import { render, screen } from "@testing-library/react";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { expect, it } from "vitest";
import { CharacterSprite } from "./CharacterSprite";

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

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { afterEach, expect, it, vi } from "vitest";
import { CharacterSprite } from "./CharacterSprite";

afterEach(() => {
  cleanup();
});

it("완성 프리셋 단일 레이어만 렌더링한다", () => {
  render(
    <CharacterSprite
      appearance={defaultCharacterAppearance}
      direction="right"
      moving={true}
      stepFrame={2}
      label="하객 캐릭터"
    />
  );

  const sprite = screen.getByLabelText("하객 캐릭터");
  expect([...sprite.querySelectorAll("[data-character-layer]")].map((node) => node.getAttribute("data-character-layer")))
    .toEqual(["base"]);
});

it("uses the two-frame idle class only when facing down and stopped", () => {
  const { rerender } = render(
    <CharacterSprite appearance={defaultCharacterAppearance} direction="down" moving={false} label="캐릭터" />
  );
  expect(screen.getByLabelText("캐릭터")).toHaveClass("character-sprite--idle-front");

  rerender(<CharacterSprite appearance={defaultCharacterAppearance} direction="left" moving={false} label="캐릭터" />);
  expect(screen.getByLabelText("캐릭터")).not.toHaveClass("character-sprite--idle-front");
});

it("월드에서 96x144 프레임을 동일 비율로 48x72에 렌더링한다", () => {
  render(
    <CharacterSprite
      appearance={defaultCharacterAppearance}
      direction="right"
      moving={true}
      stepFrame={2}
      label="고밀도 하객"
    />
  );

  const sprite = screen.getByLabelText("고밀도 하객");
  const baseLayer = sprite.querySelector('[data-character-layer="base"]');

  expect(sprite).toHaveClass("character-sprite--world");
  expect(sprite).toHaveStyle({
    "--character-source-width": "96px",
    "--character-source-height": "144px",
    "--character-display-width": "48px",
    "--character-display-height": "72px",
    "--character-display-scale-x": "0.5",
    "--character-display-scale-y": "0.5"
  });
  expect(baseLayer).toHaveStyle({ backgroundPosition: "-192px -288px" });
});

it("미리보기에서는 기존 96x144 프레임을 유지한다", () => {
  render(
    <CharacterSprite
      appearance={defaultCharacterAppearance}
      direction="down"
      moving={false}
      displayMode="preview"
      label="미리보기 하객"
    />
  );

  const sprite = screen.getByLabelText("미리보기 하객");
  expect(sprite).not.toHaveClass("character-sprite--world");
  expect(sprite).toHaveStyle({
    "--character-source-width": "96px",
    "--character-source-height": "144px",
    "--character-display-width": "96px",
    "--character-display-height": "144px",
    "--character-display-scale-x": "1",
    "--character-display-scale-y": "1"
  });
});

it("선택 목록 썸네일은 고해상도 원본을 48x72로 표시한다", () => {
  render(
    <CharacterSprite
      appearance={defaultCharacterAppearance}
      direction="down"
      moving={false}
      displayMode="thumbnail"
      label="목록 하객"
    />
  );

  const sprite = screen.getByLabelText("목록 하객");
  expect(sprite).not.toHaveClass("character-sprite--world");
  expect(sprite).toHaveStyle({
    "--character-source-width": "96px",
    "--character-source-height": "144px",
    "--character-display-width": "48px",
    "--character-display-height": "72px",
    "--character-display-scale-x": "0.5",
    "--character-display-scale-y": "0.5"
  });
});

it("완성 프리셋 이미지 로드 실패 시 해당 레이어만 숨긴다", () => {
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
  const failedLayer = sprite.querySelector('[data-character-layer="base"]');
  const failedImage = failedLayer?.querySelector("img");
  expect(failedImage).toBeInTheDocument();

  fireEvent.error(failedImage as HTMLImageElement);

  expect(sprite.querySelector('[data-character-layer="base"]')).not.toBeInTheDocument();
  errorSpy.mockRestore();
});

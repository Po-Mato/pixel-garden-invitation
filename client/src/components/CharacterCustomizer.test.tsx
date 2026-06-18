import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { afterEach, expect, it, vi } from "vitest";
import { CharacterCustomizer } from "./CharacterCustomizer";

afterEach(() => {
  cleanup();
});

it("shows the large live preview and category tabs", () => {
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  expect(screen.getByLabelText("선택한 하객 캐릭터")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "헤어" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "의상" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "액세서리" })).toBeInTheDocument();
});

it("exposes selected tab and text-labelled color choices", () => {
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  expect(screen.getByRole("tablist", { name: "캐릭터 꾸미기" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "헤어" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("button", { name: "짙은 갈색" })).toHaveTextContent("짙은 갈색");
});

it("changes the preview from an image option tile", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("tab", { name: "헤어" }));
  fireEvent.click(screen.getByRole("button", { name: "롱 스트레이트" }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    hairStyle: "feminine-long-straight"
  }));
});

it("supports randomize and reset", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "무작위 꾸미기" }));
  expect(onChange).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "초기화" }));
  expect(onChange).toHaveBeenLastCalledWith(defaultCharacterAppearance);
});

it("resets incompatible choices when the family changes", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("tab", { name: "기본" }));
  fireEvent.click(screen.getByRole("button", { name: "남성 스타일" }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    family: "masculine",
    hairStyle: "masculine-side-part",
    outfit: "masculine-classic-suit"
  }));
});

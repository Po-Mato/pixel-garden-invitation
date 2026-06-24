import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { afterEach, expect, it, vi } from "vitest";
import { CharacterCustomizer } from "./CharacterCustomizer";

afterEach(() => {
  cleanup();
});

it("선택된 완성 하객 캐릭터 미리보기와 카드 목록을 보여준다", () => {
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  expect(screen.getByLabelText("선택한 하객 캐릭터")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "크림 롱 웨이브 원피스" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "네이비 클래식 수트" })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "헤어" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "액세서리" })).not.toBeInTheDocument();
});

it("완성 캐릭터 카드를 선택하면 presetId를 변경한다", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "네이비 클래식 수트" }));
  expect(onChange).toHaveBeenCalledWith({ presetId: "masculine-navy-suit" });
});

it("무작위 선택과 기본 캐릭터 선택을 지원한다", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "무작위 선택" }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    presetId: expect.any(String)
  }));
  fireEvent.click(screen.getByRole("button", { name: "기본 캐릭터" }));
  expect(onChange).toHaveBeenLastCalledWith(defaultCharacterAppearance);
});

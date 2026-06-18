import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WeddingNpc } from "./WeddingNpc";

it("renders an accessible exclusive npc button", () => {
  const onSelect = vi.fn();
  render(<WeddingNpc id="bride" label="신부 김하린" onSelect={onSelect} />);

  fireEvent.click(screen.getByRole("button", { name: "신부 김하린 소개 보기" }));

  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(screen.getByText("신부 김하린")).toBeInTheDocument();
});

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WeddingNpc } from "./WeddingNpc";

it("renders an accessible exclusive npc button", () => {
  const onSelect = vi.fn();
  const { container } = render(<WeddingNpc id="bride" label="신부 김하린" onSelect={onSelect} />);

  fireEvent.click(screen.getByRole("button", { name: "신부 김하린 소개 보기" }));

  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(screen.getByText("신부 김하린")).toBeInTheDocument();
  const sprite = container.querySelector(".wedding-npc__sprite");
  expect(sprite).toHaveStyle({
    "--npc-frame-width": "96px",
    "--npc-frame-height": "144px"
  });
});

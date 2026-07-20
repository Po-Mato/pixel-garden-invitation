import { fireEvent, render, screen } from "@testing-library/react";
import { invitationContent } from "@wedding-game/shared";
import { expect, it, vi } from "vitest";
import { WeddingNpc } from "./WeddingNpc";

it("renders an accessible exclusive npc button", () => {
  const onSelect = vi.fn();
  const label = `신부 ${invitationContent.event.couple.bride}`;
  const { container } = render(<WeddingNpc id="bride" label={label} onSelect={onSelect} />);

  fireEvent.click(screen.getByRole("button", { name: `${label} 소개 보기` }));

  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(screen.getByText(label)).toBeInTheDocument();
  const sprite = container.querySelector(".wedding-npc__sprite");
  expect(sprite).toHaveStyle({
    "--npc-frame-width": "96px",
    "--npc-frame-height": "144px"
  });
});

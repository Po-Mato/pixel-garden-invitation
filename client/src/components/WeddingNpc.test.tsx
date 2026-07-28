import { fireEvent, render, screen } from "@testing-library/react";
import { invitationContent } from "@wedding-game/shared";
import { expect, it, vi } from "vitest";
import { WeddingNpc } from "./WeddingNpc";

it("renders an accessible exclusive npc button", () => {
  const onSelect = vi.fn();
  const label = `신부 ${invitationContent.event.couple.bride}`;
  const { container } = render(<WeddingNpc id="bride" label={label} onSelect={onSelect} />);

  fireEvent.click(screen.getByRole("button", { name: `${label}와 대화하기` }));

  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(screen.getByText(label)).toBeInTheDocument();
  const sprite = container.querySelector(".wedding-npc__sprite");
  expect(sprite).toHaveStyle({
    "--npc-frame-width": "96px",
    "--npc-frame-height": "144px"
  });
});

it("보행 방향과 인사 반응을 실제 스프라이트에 반영한다", () => {
  const { container } = render(
    <WeddingNpc
      id="groom"
      label="신랑"
      direction="left"
      moving
      stepFrame={2}
      reaction="greet"
      onSelect={vi.fn()}
    />
  );

  expect(screen.getByText("어서 오세요")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "신랑와 대화하기" })).toHaveAttribute("data-moving", "true");
  expect(container.querySelector(".wedding-npc__sprite")).toHaveStyle({
    backgroundPosition: "-96px -72px",
    "--npc-sheet-display-width": "144px",
    "--npc-sheet-display-height": "288px"
  });
});

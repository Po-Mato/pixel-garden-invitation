import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorldInteractiveProp, WorldPropMoment } from "./WorldInteractiveProp";

const decoration = {
  id: "venue-fountain",
  kind: "fountain" as const,
  label: "작은 수경 요소",
  x: 240,
  y: 450,
  width: 120,
  height: 120
};
const interaction = {
  decorationId: decoration.id,
  actionLabel: "소원 빌기",
  resultMessage: "두 사람의 행복을 빌었어요",
  reaction: "heart" as const,
  effect: "sparkle" as const,
  actionRadius: 48
};

describe("WorldInteractiveProp", () => {
  it("장식 전체를 접근 가능한 터치 대상으로 제공한다", () => {
    const onSelect = vi.fn();
    render(
      <WorldInteractiveProp
        decoration={decoration}
        interaction={interaction}
        active={false}
        onSelect={onSelect}
      />
    );
    const button = screen.getByRole("button", { name: "작은 수경 요소, 소원 빌기" });
    expect(button).toHaveStyle({ left: "240px", top: "450px", width: "120px", height: "120px" });
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("상호작용 결과를 짧은 상태 메시지로 보여준다", () => {
    render(<WorldPropMoment decoration={decoration} interaction={interaction} />);
    expect(screen.getByRole("status")).toHaveTextContent("작은 수경 요소");
    expect(screen.getByRole("status")).toHaveTextContent("두 사람의 행복을 빌었어요");
  });
});

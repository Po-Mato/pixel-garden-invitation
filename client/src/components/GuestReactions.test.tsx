import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestReactionBubble, GuestReactionDock } from "./GuestReactions";

afterEach(cleanup);

describe("GuestReactionDock", () => {
  it("offers four icon reactions and closes after selection", () => {
    const onReact = vi.fn();
    render(<GuestReactionDock onReact={onReact} />);

    fireEvent.click(screen.getByRole("button", { name: "하객 리액션 열기" }));
    expect(screen.getByLabelText("하객 리액션 선택")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "하트 보내기" }));
    expect(onReact).toHaveBeenCalledWith("heart");
    expect(screen.queryByLabelText("하객 리액션 선택")).not.toBeInTheDocument();
  });

  it("renders an accessible reaction bubble", () => {
    render(<GuestReactionBubble reaction="celebrate" guestName="하객1" />);
    expect(screen.getByRole("status", { name: "하객1님의 축하" })).toBeInTheDocument();
  });

  it("closes the picker when portal movement disables reactions", () => {
    const { rerender } = render(<GuestReactionDock onReact={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "하객 리액션 열기" }));

    rerender(<GuestReactionDock disabled onReact={vi.fn()} />);

    expect(screen.queryByLabelText("하객 리액션 선택")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "하객 리액션 열기" })).toBeDisabled();
  });
});

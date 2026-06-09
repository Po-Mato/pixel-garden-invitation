import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GameWorld } from "./GameWorld";

afterEach(() => {
  cleanup();
});

describe("GameWorld", () => {
  const profile = { nickname: "하객1", avatar: "classic", color: "rose" } as const;

  it("renders all MVP spots", () => {
    render(<GameWorld profile={profile} />);
    expect(screen.getByText("예식 안내")).toBeInTheDocument();
    expect(screen.getByText("오시는 길")).toBeInTheDocument();
    expect(screen.getByText("RSVP")).toBeInTheDocument();
    expect(screen.getByText("방명록")).toBeInTheDocument();
    expect(screen.getByText("신랑신부")).toBeInTheDocument();
    expect(screen.getByText("갤러리")).toBeInTheDocument();
    expect(screen.getByText("스토리")).toBeInTheDocument();
  });

  it("opens a spot modal from an action button", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "예식 보기" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("예식 안내");
  });

  it("opens a spot modal from a map spot button", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "스토리 스토리 보기" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("연애 스토리 꽃길");
  });

  it("closes the spot modal from the close button", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "예식 보기" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("focuses the close button and closes the spot modal with Escape", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "예식 보기" }));

    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders spots inside a scalable logical map stage", () => {
    const { container } = render(<GameWorld profile={profile} />);
    const stage = container.querySelector(".world-map__stage");
    const rsvpSpot = screen.getByRole("button", { name: "RSVP 답변하기" });

    expect(stage).toBeInTheDocument();
    expect(stage).toHaveAttribute("data-logical-width", "390");
    expect(stage).toHaveAttribute("data-logical-height", "720");
    expect(rsvpSpot.style.left).toMatch(/%$/);
    expect(rsvpSpot.style.width).toMatch(/%$/);
    expect(rsvpSpot.style.left).not.toBe("274px");
    expect(rsvpSpot.style.width).not.toBe("82px");
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GameWorld } from "./GameWorld";

afterEach(() => {
  cleanup();
});

describe("GameWorld", () => {
  it("renders all MVP spots", () => {
    render(<GameWorld profile={{ nickname: "하객1", avatar: "classic", color: "rose" }} />);
    expect(screen.getByText("예식 안내")).toBeInTheDocument();
    expect(screen.getByText("오시는 길")).toBeInTheDocument();
    expect(screen.getByText("RSVP")).toBeInTheDocument();
    expect(screen.getByText("방명록")).toBeInTheDocument();
    expect(screen.getByText("신랑신부")).toBeInTheDocument();
    expect(screen.getByText("갤러리")).toBeInTheDocument();
    expect(screen.getByText("스토리")).toBeInTheDocument();
  });

  it("opens a spot modal from an action button", () => {
    render(<GameWorld profile={{ nickname: "하객1", avatar: "classic", color: "rose" }} />);
    fireEvent.click(screen.getByRole("button", { name: "예식 보기" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("예식 안내");
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntryScreen } from "./EntryScreen";

afterEach(() => {
  cleanup();
});

describe("EntryScreen", () => {
  it("disables entry for initial or whitespace-only nickname", () => {
    const onEnter = vi.fn();
    render(<EntryScreen onEnter={onEnter} />);

    const enterButton = screen.getByRole("button", { name: "정원 입장" });

    expect(enterButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "   " } });

    expect(enterButton).toBeDisabled();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("submits trimmed nickname", () => {
    const onEnter = vi.fn();
    render(<EntryScreen onEnter={onEnter} />);

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "  하객2  " } });
    fireEvent.click(screen.getByRole("button", { name: "정원 입장" }));

    expect(onEnter).toHaveBeenCalledWith({
      nickname: "하객2",
      avatar: "classic",
      color: "rose"
    });
  });

  it("submits nickname, avatar, and color", () => {
    const onEnter = vi.fn();
    render(<EntryScreen onEnter={onEnter} />);

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "하객1" } });
    fireEvent.click(screen.getByRole("button", { name: "드레스" }));
    fireEvent.click(screen.getByRole("button", { name: "하늘" }));
    fireEvent.click(screen.getByRole("button", { name: "정원 입장" }));

    expect(onEnter).toHaveBeenCalledWith({
      nickname: "하객1",
      avatar: "dress",
      color: "sky"
    });
  });

  it("exposes selected choice state", () => {
    render(<EntryScreen onEnter={vi.fn()} />);

    const classic = screen.getByRole("button", { name: "클래식" });
    const dress = screen.getByRole("button", { name: "드레스" });
    const rose = screen.getByRole("button", { name: "장미" });
    const sky = screen.getByRole("button", { name: "하늘" });

    expect(classic).toHaveAttribute("aria-pressed", "true");
    expect(dress).toHaveAttribute("aria-pressed", "false");
    expect(rose).toHaveAttribute("aria-pressed", "true");
    expect(sky).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(dress);
    fireEvent.click(sky);

    expect(classic).toHaveAttribute("aria-pressed", "false");
    expect(dress).toHaveAttribute("aria-pressed", "true");
    expect(rose).toHaveAttribute("aria-pressed", "false");
    expect(sky).toHaveAttribute("aria-pressed", "true");
  });
});

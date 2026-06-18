import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultCharacterAppearance } from "@wedding-game/shared";
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
      appearance: defaultCharacterAppearance
    });
  });

  it("submits nickname and customized appearance", () => {
    const onEnter = vi.fn();
    render(<EntryScreen onEnter={onEnter} />);

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "하객1" } });
    fireEvent.click(screen.getByRole("tab", { name: "헤어" }));
    fireEvent.click(screen.getByRole("button", { name: "롱 스트레이트" }));
    fireEvent.click(screen.getByRole("button", { name: "정원 입장" }));

    expect(onEnter).toHaveBeenCalledWith({
      nickname: "하객1",
      appearance: {
        ...defaultCharacterAppearance,
        hairStyle: "feminine-long-straight"
      }
    });
  });

  it("exposes the character customizer", () => {
    render(<EntryScreen onEnter={vi.fn()} />);
    expect(screen.getByRole("tablist", { name: "캐릭터 꾸미기" })).toBeInTheDocument();
    expect(screen.getByLabelText("선택한 하객 캐릭터")).toBeInTheDocument();
  });
});

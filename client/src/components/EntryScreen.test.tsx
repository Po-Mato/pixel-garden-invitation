import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntryScreen } from "./EntryScreen";

describe("EntryScreen", () => {
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
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GuestbookPanel } from "./GuestbookPanel";

describe("GuestbookPanel", () => {
  it("submits a guestbook message", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GuestbookPanel nickname="하객1" messages={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("축하 메시지"), { target: { value: "축하합니다" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 남기기" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        nickname: "하객1",
        message: "축하합니다"
      })
    );
  });
});

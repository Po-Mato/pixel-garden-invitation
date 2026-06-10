import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestbookPanel } from "./GuestbookPanel";

afterEach(() => {
  cleanup();
});

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

  it("does not submit a blank trimmed message", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GuestbookPanel nickname="하객1" messages={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("축하 메시지"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 남기기" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("축하 메시지를 입력해 주세요.");
  });

  it("announces successful submission", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GuestbookPanel nickname="하객1" messages={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("축하 메시지"), { target: { value: "축하합니다" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 남기기" }));

    expect(await screen.findByRole("status")).toHaveTextContent("메시지를 남겼습니다.");
  });

  it("announces failed submission", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network"));
    render(<GuestbookPanel nickname="하객1" messages={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("축하 메시지"), { target: { value: "축하합니다" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 남기기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("전송에 실패했습니다. 다시 시도해 주세요.");
  });
});

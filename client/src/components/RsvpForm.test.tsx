import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RsvpForm } from "./RsvpForm";

afterEach(() => {
  cleanup();
});

describe("RsvpForm", () => {
  it("submits attendance data", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RsvpForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "이승재" } });
    fireEvent.change(screen.getByLabelText("참석 여부"), { target: { value: "yes" } });
    fireEvent.change(screen.getByLabelText("동행 인원"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        guestName: "이승재",
        attendance: "yes",
        partySize: 2,
        note: ""
      })
    );
  });

  it("does not submit a blank trimmed name", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RsvpForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("이름을 입력해 주세요.");
  });

  it("announces successful submission", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RsvpForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "이승재" } });
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    expect(await screen.findByRole("status")).toHaveTextContent("답변을 받았습니다.");
  });

  it("announces failed submission", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network"));
    render(<RsvpForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "이승재" } });
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("전송에 실패했습니다. 다시 시도해 주세요.");
  });
});

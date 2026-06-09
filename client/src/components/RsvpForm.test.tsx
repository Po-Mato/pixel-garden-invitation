import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RsvpForm } from "./RsvpForm";

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
});

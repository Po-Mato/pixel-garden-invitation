import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PendingSubmissionManager } from "./PendingSubmissionManager";

afterEach(cleanup);

describe("PendingSubmissionManager", () => {
  it("연결 상태와 삭제 동작을 안내한다", () => {
    const onDiscard = vi.fn();
    const { rerender } = render(
      <PendingSubmissionManager queuedAt="2027-04-20T03:30:00.000Z" online={false} label="참석 답변" onDiscard={onDiscard} />
    );
    expect(screen.getByText(/연결되면 안전하게/)).toBeInTheDocument();
    rerender(<PendingSubmissionManager queuedAt="2027-04-20T03:30:00.000Z" online label="참석 답변" onDiscard={onDiscard} />);
    expect(screen.getByText(/내용을 확인하고/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "전송 대기 삭제" }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });
});

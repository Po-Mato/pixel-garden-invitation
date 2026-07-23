import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormDraftManager } from "./FormDraftManager";

afterEach(cleanup);

describe("공개 폼 임시 저장 관리", () => {
  it("저장 시각과 보관 기간을 표시하고 삭제 명령을 전달한다", () => {
    const onDiscard = vi.fn();
    render(<FormDraftManager savedAt="2027-04-20T03:30:00.000Z" onDiscard={onDiscard} />);

    expect(screen.getByText(/4월 20일/)).toHaveTextContent("7일간 보관");
    fireEvent.click(screen.getByRole("button", { name: "임시 저장 삭제" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});

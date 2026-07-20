import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RsvpSubmission } from "@wedding-game/shared";
import { RsvpForm } from "./RsvpForm";

const policy = {
  responseDeadline: "2027-04-24T23:59:59+09:00",
  deleteAt: "2027-05-31T23:59:59+09:00",
  consentVersion: "2026-07-20"
};

function completeRequiredFields() {
  fireEvent.change(screen.getByLabelText("이름"), { target: { value: "  이승재  " } });
  fireEvent.change(screen.getByLabelText("연락처"), { target: { value: "010-1234-5678" } });
  fireEvent.click(screen.getByLabelText(/개인정보 수집/));
}

describe("RsvpForm", () => {
  beforeEach(() => vi.setSystemTime(new Date("2027-04-20T00:00:00+09:00")));

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("uses accessible radio groups and submits a canonical attending payload", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RsvpForm policy={policy} submitLabel="참석 답변 보내기" onSubmit={onSubmit} />);

    expect(screen.getByRole("radiogroup", { name: "어느 분의 하객인가요?" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "참석 여부" })).toBeInTheDocument();
    expect(screen.getByLabelText("연락처")).toHaveAttribute("type", "tel");
    expect(screen.getByLabelText("연락처")).toHaveAttribute("inputmode", "tel");
    expect(screen.getByText("2027년 4월 24일까지 알려주세요")).toBeInTheDocument();

    completeRequiredFields();
    fireEvent.click(screen.getByLabelText("신부측"));
    fireEvent.change(screen.getByLabelText("본인 포함 참석 인원"), { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("식사 안 함"));
    fireEvent.change(screen.getByLabelText("전달사항"), { target: { value: "  축하합니다  " } });
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      side: "bride",
      guestName: "이승재",
      phone: "01012345678",
      attendance: "yes",
      partySize: 3,
      mealStatus: "no",
      note: "축하합니다",
      consentVersion: "2026-07-20"
    } satisfies RsvpSubmission));
  });

  it("normalizes declined and unsure conditional fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RsvpForm policy={policy} submitLabel="보내기" onSubmit={onSubmit} />);
    completeRequiredFields();

    fireEvent.click(screen.getByLabelText("불참"));
    expect(screen.queryByLabelText("본인 포함 참석 인원")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "식사 여부" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    await waitFor(() => expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({
      attendance: "no", partySize: 0, mealStatus: "not_applicable"
    })));

    cleanup();
    render(<RsvpForm policy={policy} submitLabel="보내기" onSubmit={onSubmit} />);
    completeRequiredFields();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "참석 여부" })).getByLabelText("미정"));
    expect(screen.getByLabelText("예상 인원")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "식사 여부" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    await waitFor(() => expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({
      attendance: "unsure", partySize: 1, mealStatus: "unsure"
    })));
  });

  it("disables submission until name, normalized phone, and consent are valid", () => {
    render(<RsvpForm policy={policy} submitLabel="참석 답변 보내기" onSubmit={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "참석 답변 보내기" });

    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "이승재" } });
    fireEvent.change(screen.getByLabelText("연락처"), { target: { value: "010-12" } });
    fireEvent.click(screen.getByLabelText(/개인정보 수집/));
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("연락처"), { target: { value: "010-1234-5678" } });
    expect(submit).toBeEnabled();
    fireEvent.change(screen.getByLabelText("본인 포함 참석 인원"), { target: { value: "11" } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("본인 포함 참석 인원"), { target: { value: "2" } });
    expect(submit).toBeEnabled();
    expect(screen.getByText(/2027년 5월 31일까지 보관 후 자동 삭제/)).toBeInTheDocument();
  });

  it("keeps submission enabled after the recommended deadline", () => {
    vi.setSystemTime(new Date("2027-04-25T00:00:00+09:00"));
    render(<RsvpForm policy={policy} submitLabel="보내기" onSubmit={vi.fn()} />);
    completeRequiredFields();

    expect(screen.getByText("마감일이 지났지만 답변을 보내실 수 있습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "보내기" })).toBeEnabled();
  });

  it("prefills edits and preserves values when submission fails", async () => {
    const initialValue: RsvpSubmission = {
      side: "groom", guestName: "김하객", phone: "01011112222", attendance: "yes",
      partySize: 2, mealStatus: "yes", note: "기존 메모", consentVersion: policy.consentVersion
    };
    render(<RsvpForm initialValue={initialValue} policy={policy} submitLabel="수정 저장" onSubmit={vi.fn().mockRejectedValue(new Error("잠시 후 다시 시도해 주세요."))} />);

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김수정" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("잠시 후 다시 시도해 주세요.");
    expect(screen.getByLabelText("이름")).toHaveValue("김수정");
  });

  it("blocks duplicate submits and does not update state after unmount", async () => {
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { resolveSubmit = resolve; }));
    const { unmount } = render(<RsvpForm policy={policy} submitLabel="보내기" onSubmit={onSubmit} />);
    completeRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    fireEvent.click(screen.getByRole("button", { name: "보내는 중" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    unmount();
    resolveSubmit?.();
    await Promise.resolve();
  });

  it.each(Array.from({ length: 8 }, (_, index) => "010123456789012".slice(0, index + 8)))(
    "preserves every digit in an 8-15 digit 010 phone number: %s",
    async (phone) => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<RsvpForm policy={policy} submitLabel="보내기" onSubmit={onSubmit} />);
      fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김하객" } });
      fireEvent.change(screen.getByLabelText("연락처"), { target: { value: phone } });
      fireEvent.click(screen.getByLabelText(/개인정보 수집/));
      fireEvent.click(screen.getByRole("button", { name: "보내기" }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ phone })));
      expect(screen.getByLabelText("연락처").getAttribute("value")?.replace(/\D/g, "")).toBe(phone);
    }
  );
});

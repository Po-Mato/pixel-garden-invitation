import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JourneyNextActionCard } from "./JourneyNextActionCard";

describe("JourneyNextActionCard", () => {
  const action = {
    completedLabel: "예식홀",
    nextCheckpointId: "guestbook" as const,
    nextLabel: "축하 메시지",
    detail: "연회장으로 이동해 축하 메시지를 남겨보세요"
  };

  it("완료한 행동과 다음 행동을 함께 보여준다", () => {
    render(<JourneyNextActionCard action={action} onContinue={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByLabelText("도착 후 다음 행동")).toHaveTextContent("예식홀 완료");
    expect(screen.getByLabelText("도착 후 다음 행동")).toHaveTextContent("다음 · 축하 메시지");
  });

  it("다음 목적지 안내와 닫기 동작을 제공한다", () => {
    const onContinue = vi.fn();
    const onDismiss = vi.fn();
    const { container } = render(<JourneyNextActionCard action={action} onContinue={onContinue} onDismiss={onDismiss} />);
    fireEvent.click(within(container).getByRole("button", { name: /이어서 안내/ }));
    fireEvent.click(within(container).getByRole("button", { name: "다음 행동 안내 닫기" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

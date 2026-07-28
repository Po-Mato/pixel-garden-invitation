import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WeddingJourneyClock } from "./WeddingJourneyClock";

describe("WeddingJourneyClock", () => {
  it("긴 카운트다운은 간결하게 표시한다", () => {
    render(<WeddingJourneyClock timing={{
      phase: "countdown",
      label: "예식까지 D-30",
      detail: "2027. 5. 1. 오후 5:10",
      urgent: false,
      showFastCeremonyRoute: false
    }} onFastRoute={vi.fn()} />);
    expect(screen.getByText("예식까지 D-30")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("예식이 임박하면 최단 경로를 시작한다", () => {
    const onFastRoute = vi.fn();
    render(<WeddingJourneyClock timing={{
      phase: "soon",
      label: "예식까지 10분",
      detail: "예식홀 최단 경로를 바로 이용할 수 있어요",
      urgent: true,
      showFastCeremonyRoute: true
    }} onFastRoute={onFastRoute} />);
    fireEvent.click(screen.getByRole("button", { name: /예식홀 최단 안내/ }));
    expect(onFastRoute).toHaveBeenCalledTimes(1);
  });
});

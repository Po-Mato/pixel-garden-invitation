import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeddingDayActionBar } from "./WeddingDayActionBar";

afterEach(cleanup);

describe("예식 당일 핵심 기능 고정 바", () => {
  it("평상시에는 표시하지 않는다", () => {
    render(<WeddingDayActionBar variant="quick" now={new Date("2027-04-30T08:00:00+09:00")} onSchedule={vi.fn()} onRsvp={vi.fn()} />);
    expect(screen.queryByRole("navigation", { name: /예식 당일 바로가기/ })).not.toBeInTheDocument();
  });

  it("당일 미리보기에서 지도, 전화, 일정, 참석 동작을 제공한다", () => {
    const onSchedule = vi.fn();
    const onRsvp = vi.fn();
    render(<WeddingDayActionBar variant="quick" preview onSchedule={onSchedule} onRsvp={onRsvp} />);

    expect(screen.getByRole("navigation", { name: /예식 당일 바로가기/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /MJ컨벤션에 전화하기/ })).toHaveAttribute("href", "tel:0323475500");
    fireEvent.click(screen.getByRole("button", { name: "지도" }));
    expect(screen.getByRole("dialog", { name: "오시는 길" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "일정" }));
    fireEvent.click(screen.getByRole("button", { name: "참석" }));
    expect(onSchedule).toHaveBeenCalledOnce();
    expect(onRsvp).toHaveBeenCalledOnce();
  });
});

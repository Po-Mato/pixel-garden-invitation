import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameFirstVisitGuide } from "./GameFirstVisitGuide";

afterEach(() => cleanup());

describe("GameFirstVisitGuide", () => {
  it("walks through movement, portal, and destination guidance", () => {
    const onDismiss = vi.fn();
    render(<GameFirstVisitGuide onDismiss={onDismiss} />);

    expect(screen.getByRole("button", { name: "게임 안내 닫기" })).toHaveFocus();
    expect(screen.getByText("한 칸씩 차분하게 걸어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("빛나는 타일이 다음 맵의 문이에요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("분홍 목적지 표시를 따라가요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "정원 산책 시작" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("supports keyboard navigation and Escape dismissal", () => {
    const onDismiss = vi.fn();
    render(<GameFirstVisitGuide onDismiss={onDismiss} />);

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("빛나는 타일이 다음 맵의 문이에요")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("한 칸씩 차분하게 걸어요")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NpcGroupCelebrationNotice } from "./NpcGroupCelebrationNotice";

describe("NpcGroupCelebrationNotice", () => {
  it("신랑 신부와 주변 하객이 함께하는 인연 피날레를 알린다", () => {
    render(<NpcGroupCelebrationNotice onClose={vi.fn()} />);
    expect(screen.getByRole("status", { name: "인연 단체 축하 이벤트" })).toHaveTextContent("주변 하객들이 함께 축하");
  });
});

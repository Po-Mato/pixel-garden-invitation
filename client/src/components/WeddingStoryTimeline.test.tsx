import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WeddingStoryTimeline } from "./WeddingStoryTimeline";

afterEach(cleanup);

describe("결혼 스토리 타임라인", () => {
  it("공통 콘텐츠의 네 단계를 순서 있는 목록으로 표시한다", () => {
    render(<WeddingStoryTimeline />);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual([
      "첫 인사",
      "함께한 시간",
      "결혼을 약속한 마음",
      "우리의 결혼식"
    ]);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorldSecretMemorial } from "./WorldSecretMemorial";

describe("WorldSecretMemorial", () => {
  it("숨은 추억 완주 기념물을 월드 오브젝트로 표시한다", () => {
    render(<WorldSecretMemorial collection={{
      version: 1,
      discoveredIds: ["first-invitation", "garden-pause", "promise-route", "passing-scenery", "fountain-wish", "welcome-letter", "bridal-bouquet", "aisle-light", "ready-reflection", "celebration-table"],
      unlockedAchievementIds: ["first-discovery", "garden-explorer", "wedding-archivist"],
      equippedRewardId: "wedding-memory-crown"
    }} />);
    const memorial = screen.getByLabelText("숨은 추억을 모두 모아 완성한 기억의 등불 열기");
    expect(memorial).toHaveTextContent("기억의 등불");
    fireEvent.click(memorial);
    expect(screen.getByRole("dialog", { name: "기억의 등불 추억 다시 보기" })).toHaveTextContent("첫 초대의 설렘");
    fireEvent.click(screen.getByRole("button", { name: "다음 추억" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("꽃길의 쉼표");
    expect(screen.getByRole("button", { name: "자동 감상 시작" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "추억 장면 선택" })).toBeInTheDocument();
  });
});

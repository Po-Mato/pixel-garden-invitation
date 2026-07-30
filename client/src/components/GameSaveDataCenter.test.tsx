import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameSaveDataCenter } from "./GameSaveDataCenter";

describe("GameSaveDataCenter", () => {
  it("게임 진행 백업과 복원 동작의 범위를 명확히 안내한다", () => {
    render(<GameSaveDataCenter />);
    expect(screen.getByText("게임 저장 백업")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "백업 저장" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "백업 복원" })).toBeInTheDocument();
    expect(screen.getByText(/참석 답변·방명록·관리자 정보는 포함하지 않습니다/)).toBeInTheDocument();
  });
});

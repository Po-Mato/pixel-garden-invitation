import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameDeviceReadinessCenter } from "./GameDeviceReadinessCenter";

describe("GameDeviceReadinessCenter", () => {
  it("자동 점검과 실제 사용 체크 항목을 함께 제공한다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);
    render(<GameDeviceReadinessCenter />);
    fireEvent.click(screen.getByText("내 휴대폰 최종 점검"));
    fireEvent.click(screen.getByRole("button", { name: "자동 점검 실행" }));
    expect(screen.getByRole("region", { name: "휴대폰 자동 점검 결과" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /조이스틱과 타일 이동/ })).toBeInTheDocument();
  });
});

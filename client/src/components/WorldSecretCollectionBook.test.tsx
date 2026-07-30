import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorldSecretCollectionBook } from "./WorldSecretCollectionBook";

describe("WorldSecretCollectionBook", () => {
  it("발견한 추억만 이름을 공개하고 장소 이동을 제공한다", () => {
    const onSelectZone = vi.fn();
    render(<WorldSecretCollectionBook
      collection={{ version: 1, discoveredIds: ["first-invitation"], unlockedAchievementIds: ["first-discovery"] }}
      activeZoneId="home"
      onSelectZone={onSelectZone}
    />);
    fireEvent.click(screen.getByText("숨은 추억 컬렉션북"));
    expect(screen.getByRole("list", { name: "숨은 추억 목록" }).children).toHaveLength(10);
    expect(screen.getByText("첫 초대의 설렘")).toBeInTheDocument();
    expect(screen.getAllByText("미발견 추억")).toHaveLength(9);
    fireEvent.click(screen.getByRole("button", { name: /2번 미발견 추억, 동네 거리로 이동/ }));
    expect(onSelectZone).toHaveBeenCalledWith("neighborhood");
  });
});

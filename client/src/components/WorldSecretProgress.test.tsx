import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorldSecretProgress } from "./WorldSecretProgress";

describe("WorldSecretProgress", () => {
  it("발견 수와 현재 맵 힌트를 간결하게 보여준다", () => {
    render(<WorldSecretProgress
      collection={{ version: 1, discoveredIds: ["one"], unlockedAchievementIds: ["first-discovery"] }}
      totalCount={10}
      currentHint={{ secretHint: "분수의 물빛을 찾아보세요" }}
      currentClue={{ band: "near", distance: 48, directionLabel: "바로 근처", message: "단서가 아주 선명해요 · 물빛이 반짝여요" }}
    />);
    expect(screen.getByLabelText("숨은 추억 수집 현황")).toHaveTextContent("1/10");
    expect(screen.getByText(/단서가 아주 선명/)).toBeInTheDocument();
  });
});

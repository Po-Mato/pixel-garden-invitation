import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorldSecretProgress } from "./WorldSecretProgress";

describe("WorldSecretProgress", () => {
  it("발견 수와 현재 맵 힌트를 간결하게 보여준다", () => {
    render(<WorldSecretProgress
      collection={{ version: 1, discoveredIds: ["one"], unlockedAchievementIds: ["first-discovery"] }}
      totalCount={10}
      currentHint={{ secretHint: "분수의 물빛을 찾아보세요" }}
    />);
    expect(screen.getByLabelText("숨은 추억 수집 현황")).toHaveTextContent("1/10");
    expect(screen.getByText(/분수의 물빛/)).toBeInTheDocument();
  });
});

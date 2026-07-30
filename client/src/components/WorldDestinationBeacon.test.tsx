import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorldDestinationBeacon } from "./WorldDestinationBeacon";

describe("목적지 도착 표식", () => {
  it("캐릭터보다 낮은 깊이에 남은 타일을 표시한다", () => {
    render(
      <WorldDestinationBeacon
        point={{ x: 120, y: 240 }}
        label="예식홀 입구"
        remainingTiles={4}
        kind="portal"
      />
    );
    const beacon = screen.getByTestId("world-destination-beacon");
    expect(beacon).toHaveStyle({ left: "120px", top: "240px", zIndex: "1060" });
    expect(beacon).toHaveTextContent("예식홀 입구4칸 남음");
    expect(beacon).toHaveAttribute("aria-hidden", "true");
  });
});

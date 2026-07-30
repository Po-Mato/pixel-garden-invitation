import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { gardenWorld, getWorldZone } from "../game/world";
import { PortalDestinationPreview } from "./PortalDestinationPreview";

describe("PortalDestinationPreview", () => {
  it("다음 맵과 실제 도착 타일을 함께 표시한다", () => {
    const home = getWorldZone(gardenWorld, "home");
    const portal = home.portals[0];
    const destination = getWorldZone(gardenWorld, portal.to);

    render(<PortalDestinationPreview
      portal={portal}
      destinationZone={destination}
      congestion={{ level: "busy", label: "우회 가능", openCount: 2, totalCount: 3, entries: [] }}
      waitEstimate={{ seconds: 5, label: "예상 5초" }}
      firstVisit
      recentDestinations={["우리 집", "동네 거리"]}
    />);

    expect(screen.getByLabelText("동네로 나가기 다음 맵 미리보기")).toHaveTextContent("동네 거리");
    expect(screen.getByRole("img", { name: "동네 거리 도착 지점" }))
      .toContainElement(document.querySelector(".portal-destination-preview__arrival"));
    expect(screen.getByText("도착 타일")).toBeInTheDocument();
    expect(screen.getByText(/현재 포털 우회 가능/)).toBeInTheDocument();
    expect(screen.getByText(/예상 5초/)).toBeInTheDocument();
    expect(screen.getByText("첫 방문")).toBeInTheDocument();
    expect(screen.getByText("새로운 장소예요")).toBeInTheDocument();
    expect(screen.getByText(/우리 집 → 동네 거리/)).toBeInTheDocument();
  });
});

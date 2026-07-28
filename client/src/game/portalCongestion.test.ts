import { describe, expect, it } from "vitest";
import { gardenWorld, getWorldZone } from "./world";
import { portalCongestion } from "./portalCongestion";

describe("portalCongestion", () => {
  const portal = getWorldZone(gardenWorld, "home").portals[0];

  it("세 진입 타일이 비어 있으면 여유 상태다", () => {
    expect(portalCongestion(portal, [])).toMatchObject({
      level: "open",
      label: "여유",
      openCount: 3
    });
  });

  it("일부 타일이 차면 우회 가능한 타일을 구분한다", () => {
    const result = portalCongestion(portal, [portal.entryTiles[1]]);
    expect(result).toMatchObject({ level: "busy", openCount: 2 });
    expect(result.entries.map(({ occupied }) => occupied)).toEqual([false, true, false]);
  });

  it("모든 타일이 차면 대기 상태다", () => {
    expect(portalCongestion(portal, portal.entryTiles)).toMatchObject({
      level: "full",
      label: "잠시 대기",
      openCount: 0
    });
  });
});

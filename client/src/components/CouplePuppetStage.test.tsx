import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { allowsCouplePuppetMotion, resolveCouplePuppetAssetPath } from "../character/couplePuppet";
import {
  CouplePuppetStage,
  resolveCouplePuppetSlotXs,
  resolvePuppetPlacement
} from "./CouplePuppetStage";

afterEach(cleanup);

describe("신랑·신부 2D 퍼펫", () => {
  it("배포 기본 경로에서도 정적 대체 이미지를 찾는다", () => {
    expect(resolveCouplePuppetAssetPath("bride", "preview.webp", "/pixel-garden-invitation"))
      .toBe("/pixel-garden-invitation/characters/puppets/bride/preview.webp");
  });

  it("두 캐릭터의 순서에 맞춰 접근 가능한 퍼펫 무대를 표시한다", () => {
    const { container } = render(
      <CouplePuppetStage label="이승재 · 이건희 2D 퍼펫" order="groom-first" priority />
    );
    const stage = screen.getByRole("img", { name: "이승재 · 이건희 2D 퍼펫" });
    const sources = Array.from(container.querySelectorAll("img")).map((image) => image.getAttribute("src"));

    expect(stage).toHaveAttribute("data-renderer-ready", "false");
    expect(stage).toHaveAttribute("data-renderer-enabled", "false");
    expect(stage).toHaveAttribute("data-renderer", "canvas-2d");
    expect(sources[0]).toContain("/groom/preview.webp");
    expect(sources[1]).toContain("/bride/preview.webp");
  });

  it("게임 진입 의도가 생긴 뒤에만 동적 렌더러를 허용한다", () => {
    render(<CouplePuppetStage label="동적 퍼펫" motionEnabled priority />);

    expect(screen.getByRole("img", { name: "동적 퍼펫" })).toHaveAttribute("data-renderer-enabled", "true");
  });

  it("입장 화면에서는 전신이 상하 여백 안에 들어오도록 축소한다", () => {
    const placement = resolvePuppetPlacement(560, 768, 736, true);
    const top = placement.rootY - 736 * placement.scale;
    const bottom = placement.rootY + (768 - 736) * placement.scale;

    expect(top).toBeCloseTo(20, 5);
    expect(bottom).toBeCloseTo(528, 5);
    expect(placement.scale).toBeLessThan(1);
  });

  it("입장 화면용 밀착 배치는 두 사람을 중앙 가까이에 둔다", () => {
    expect(resolveCouplePuppetSlotXs("close")).toEqual([400, 624]);
    expect(resolveCouplePuppetSlotXs("standard")).toEqual([324, 700]);
  });

  it("전신 무대에서는 원본 배율과 기준선을 유지한다", () => {
    expect(resolvePuppetPlacement(768, 768, 736, false)).toEqual({
      scale: 1,
      rootY: 736
    });
  });

  it("모션 감소와 저사양 모드에서는 런타임 애니메이션을 생략한다", () => {
    const root = document.createElement("html");
    root.dataset.performanceMode = "lite";
    expect(allowsCouplePuppetMotion(root)).toBe(false);
    delete root.dataset.performanceMode;
    root.dataset.reduceMotion = "true";
    expect(allowsCouplePuppetMotion(root)).toBe(false);
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { allowsCouplePuppetMotion, resolveCouplePuppetAssetPath } from "../character/couplePuppet";
import { CouplePuppetStage } from "./CouplePuppetStage";

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
    expect(sources[0]).toContain("/groom/preview.webp");
    expect(sources[1]).toContain("/bride/preview.webp");
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

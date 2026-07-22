import { describe, expect, it } from "vitest";
import { isolateAppForModal } from "./modalIsolation";

describe("모달 배경 비활성화", () => {
  it("앱 본문을 스크린리더와 키보드에서 숨기고 기존 상태를 복원한다", () => {
    const appRoot = document.createElement("div");
    const restore = isolateAppForModal(appRoot);

    expect(appRoot).toHaveAttribute("aria-hidden", "true");
    expect(appRoot).toHaveAttribute("inert");

    restore();
    expect(appRoot).not.toHaveAttribute("aria-hidden");
    expect(appRoot).not.toHaveAttribute("inert");
  });

  it("호출 전 설정된 속성은 닫은 뒤 유지한다", () => {
    const appRoot = document.createElement("div");
    appRoot.setAttribute("aria-hidden", "false");
    appRoot.setAttribute("inert", "");

    isolateAppForModal(appRoot)();
    expect(appRoot).toHaveAttribute("aria-hidden", "false");
    expect(appRoot).toHaveAttribute("inert");
  });
});

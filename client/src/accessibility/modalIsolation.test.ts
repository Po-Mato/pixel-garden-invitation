import { describe, expect, it } from "vitest";
import { isolateAppForModal, lockModalBody } from "./modalIsolation";

describe("모달 배경 비활성화", () => {
  it("중첩 창을 생성 순서대로 닫아도 마지막 창까지 배경과 스크롤을 잠근다", () => {
    const root = document.createElement("div");
    const before = document.body.style.overflow;
    const a = isolateAppForModal(root), b = isolateAppForModal(root);
    const unlockA = lockModalBody(), unlockB = lockModalBody();
    a(); unlockA();
    expect(root).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");
    b(); unlockB();
    expect(root).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe(before);
    a(); unlockA();
    expect(document.body.style.overflow).toBe(before);
  });
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

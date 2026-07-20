import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { invitationContent } from "@wedding-game/shared";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomSheet } from "./BottomSheet";
import { PhotoLightbox } from "./PhotoLightbox";

const photos = invitationContent.content.gallery;

class MockPointerEvent extends MouseEvent {
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    Object.defineProperty(this, "pointerId", { value: init.pointerId ?? 0 });
  }
}

beforeEach(() => {
  vi.stubGlobal("PointerEvent", MockPointerEvent);
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  vi.unstubAllGlobals();
});

describe("전체 화면 웨딩 사진 뷰어", () => {
  it("document.body 포털에 선택 사진, 카운터와 캡션을 표시한다", () => {
    render(<PhotoLightbox photos={photos} index={0} onIndexChange={vi.fn()} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "웨딩 사진 전체 화면" });
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("img", { name: photos[0].alt })).toBeInTheDocument();
    expect(screen.getByText(`1 / ${photos.length}`)).toBeInTheDocument();
    expect(screen.getByText(photos[0].caption ?? "")).toBeInTheDocument();
  });

  it("버튼과 방향키로 비순환 탐색하고 양 끝의 버튼을 비활성화한다", () => {
    const onIndexChange = vi.fn();
    const { rerender } = render(
      <PhotoLightbox photos={photos} index={1} onIndexChange={onIndexChange} onClose={vi.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: "이전 사진" }));
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    expect(onIndexChange).toHaveBeenLastCalledWith(2);

    const dialog = screen.getByRole("dialog", { name: "웨딩 사진 전체 화면" });
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(onIndexChange).toHaveBeenLastCalledWith(2);

    onIndexChange.mockClear();
    rerender(<PhotoLightbox photos={photos} index={0} onIndexChange={onIndexChange} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "이전 사진" })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(onIndexChange).not.toHaveBeenCalled();

    rerender(
      <PhotoLightbox photos={photos} index={photos.length - 1} onIndexChange={onIndexChange} onClose={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "다음 사진" })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("같은 포인터의 48px 이상 수평 우세 스와이프만 탐색한다", () => {
    const onIndexChange = vi.fn();
    const { rerender } = render(
      <PhotoLightbox photos={photos} index={2} onIndexChange={onIndexChange} onClose={vi.fn()} />
    );
    const stage = screen.getByTestId("photo-lightbox-stage");

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 20 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 53, clientY: 20 });
    fireEvent.pointerDown(stage, { pointerId: 2, clientX: 100, clientY: 20 });
    fireEvent.pointerUp(stage, { pointerId: 2, clientX: 45, clientY: 90 });
    fireEvent.pointerDown(stage, { pointerId: 3, clientX: 100, clientY: 20 });
    fireEvent.pointerUp(stage, { pointerId: 4, clientX: 40, clientY: 20 });
    expect(onIndexChange).not.toHaveBeenCalled();

    fireEvent.pointerDown(stage, { pointerId: 5, clientX: 100, clientY: 20 });
    fireEvent.pointerUp(stage, { pointerId: 5, clientX: 40, clientY: 25 });
    expect(onIndexChange).toHaveBeenLastCalledWith(3);

    fireEvent.pointerDown(stage, { pointerId: 6, clientX: 40, clientY: 25 });
    fireEvent.pointerUp(stage, { pointerId: 6, clientX: 100, clientY: 20 });
    expect(onIndexChange).toHaveBeenLastCalledWith(1);

    onIndexChange.mockClear();
    rerender(<PhotoLightbox photos={photos} index={0} onIndexChange={onIndexChange} onClose={vi.fn()} />);
    fireEvent.pointerDown(stage, { pointerId: 7, clientX: 40, clientY: 20 });
    fireEvent.pointerUp(stage, { pointerId: 7, clientX: 100, clientY: 20 });
    expect(onIndexChange).not.toHaveBeenCalled();

    rerender(
      <PhotoLightbox photos={photos} index={photos.length - 1} onIndexChange={onIndexChange} onClose={vi.fn()} />
    );
    fireEvent.pointerDown(stage, { pointerId: 8, clientX: 100, clientY: 20 });
    fireEvent.pointerUp(stage, { pointerId: 8, clientX: 40, clientY: 20 });
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("Escape 한 번은 라이트박스만 닫고 하단 시트를 유지한다", () => {
    const closeSheet = vi.fn();

    function NestedViewer() {
      const [lightboxOpen, setLightboxOpen] = useState(true);

      return (
        <BottomSheet title="사진 갤러리" onClose={closeSheet}>
          <p>갤러리 내용</p>
          {lightboxOpen ? (
            <PhotoLightbox photos={photos} index={0} onIndexChange={vi.fn()} onClose={() => setLightboxOpen(false)} />
          ) : null}
        </BottomSheet>
      );
    }

    render(<NestedViewer />);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "웨딩 사진 전체 화면" }), { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "웨딩 사진 전체 화면" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "사진 갤러리" })).toBeInTheDocument();
    expect(closeSheet).not.toHaveBeenCalled();
  });

  it("Tab과 Shift+Tab 포커스를 대화상자 안에 고정한다", () => {
    render(<PhotoLightbox photos={photos} index={1} onIndexChange={vi.fn()} onClose={vi.fn()} />);

    const closeButton = screen.getByRole("button", { name: "전체 화면 닫기" });
    const nextButton = screen.getByRole("button", { name: "다음 사진" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(nextButton).toHaveFocus();
    fireEvent.keyDown(nextButton, { key: "Tab" });
    expect(closeButton).toHaveFocus();
  });

  it("열린 동안 body 스크롤을 잠그고 해제 시 이전 값과 포커스를 복원한다", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    document.body.style.overflow = "clip";

    const { unmount } = render(
      <PhotoLightbox photos={photos} index={0} onIndexChange={vi.fn()} onClose={vi.fn()} />
    );
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("clip");
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("이미지 로드가 실패해도 닫기와 사진 탐색을 유지한다", () => {
    const onIndexChange = vi.fn();
    const onClose = vi.fn();
    render(<PhotoLightbox photos={photos} index={1} onIndexChange={onIndexChange} onClose={onClose} />);

    fireEvent.error(screen.getByRole("img", { name: photos[1].alt }));
    expect(screen.getByRole("img", { name: photos[1].alt })).toHaveClass("responsive-gallery-image--fallback");
    fireEvent.click(screen.getByRole("button", { name: "이전 사진" }));
    expect(onIndexChange).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    expect(onIndexChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: "전체 화면 닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

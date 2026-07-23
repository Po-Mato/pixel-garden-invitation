import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { invitationContent } from "@wedding-game/shared";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomSheet } from "./BottomSheet";
import { ViewPreferencesProvider } from "../accessibility/ViewPreferencesContext";
import { defaultViewPreferences } from "../accessibility/viewPreferences";
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
  it.each([
    ["빈 사진 목록", [] as const, 0],
    ["음수 인덱스", photos, -1],
    ["목록 범위를 넘은 인덱스", photos, photos.length]
  ])("%s에서는 전역 화면과 키보드 상태를 변경하지 않는다", (_, invalidPhotos, invalidIndex) => {
    const onIndexChange = vi.fn();
    const onClose = vi.fn();
    document.body.style.overflow = "clip";

    render(
      <PhotoLightbox
        photos={invalidPhotos}
        index={invalidIndex}
        onIndexChange={onIndexChange}
        onClose={onClose}
      />
    );

    expect(screen.queryByRole("dialog", { name: "웨딩 사진 전체 화면" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("clip");

    for (const key of ["Escape", "ArrowLeft", "ArrowRight"]) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onClose).not.toHaveBeenCalled();
    expect(onIndexChange).not.toHaveBeenCalled();
  });

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

  it("탐색 버튼에서 시작한 포인터 제스처는 클릭 한 번만 처리한다", () => {
    const onIndexChange = vi.fn();
    render(<PhotoLightbox photos={photos} index={2} onIndexChange={onIndexChange} onClose={vi.fn()} />);
    const nextButton = screen.getByRole("button", { name: "다음 사진" });
    const nextIcon = nextButton.querySelector("svg");

    expect(nextIcon).not.toBeNull();
    fireEvent.pointerDown(nextIcon!, { pointerId: 9, clientX: 100, clientY: 20 });
    fireEvent.pointerUp(nextIcon!, { pointerId: 9, clientX: 40, clientY: 20 });
    fireEvent.click(nextButton);

    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(3);
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

  it("데이터 절약 중에도 현재 사진만 고화질로 다시 요청할 수 있다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={{ ...defaultViewPreferences, dataSaver: true }}>
        <PhotoLightbox photos={photos} index={0} onIndexChange={vi.fn()} onClose={vi.fn()} />
      </ViewPreferencesProvider>
    );

    expect(screen.getByRole("img", { name: photos[0].alt })).toHaveAttribute("data-network-mode", "economy");
    fireEvent.click(screen.getByRole("button", { name: "이 사진 고화질로 보기" }));
    expect(screen.getByRole("img", { name: photos[0].alt })).toHaveAttribute("data-network-mode", "full");
    expect(screen.queryByRole("button", { name: "이 사진 고화질로 보기" })).not.toBeInTheDocument();
  });
});

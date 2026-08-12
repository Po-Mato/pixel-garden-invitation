import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { useModalDialogFocus } from "../accessibility/useModalDialogFocus";

type BottomSheetScrollState = "static" | "more" | "end";

type BottomSheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function BottomSheet({ title, onClose, children, className = "", returnFocusRef }: BottomSheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [scrollState, setScrollState] = useState<BottomSheetScrollState>("static");

  const updateScrollState = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const scrollable = body.scrollHeight - body.clientHeight > 12;
    const nextState: BottomSheetScrollState = !scrollable
      ? "static"
      : body.scrollHeight - body.clientHeight - body.scrollTop <= 20
        ? "end"
        : "more";
    setScrollState((current) => current === nextState ? current : nextState);
  }, []);

  useModalDialogFocus({
    open: true,
    dialogRef,
    initialFocusRef: titleRef,
    returnFocusRef,
    onEscape: onClose,
    isolateApp: true
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateScrollState);
    resizeObserver?.observe(dialog);
    const body = bodyRef.current;
    if (body) resizeObserver?.observe(body);
    return () => {
      window.removeEventListener("resize", updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [updateScrollState]);

  return createPortal(
    <>
      <button
        type="button"
        className="sheet-backdrop"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        className={`bottom-sheet ${className}`.trim()}
        role="dialog"
        aria-modal={true}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-scroll-state={scrollState}
        tabIndex={-1}
      >
        <header className="bottom-sheet__header">
          <h2 ref={titleRef} id={titleId} tabIndex={-1}>{title}</h2>
          <button type="button" aria-label="닫기" onClick={onClose}>
            <X aria-hidden="true" />
            <span>닫기</span>
          </button>
        </header>
        <p id={descriptionId} className="sr-only">{title} 창입니다. 닫기 버튼 다음에 주요 내용이 이어집니다.</p>
        <div ref={bodyRef} className="bottom-sheet__body" onScroll={updateScrollState}>{children}</div>
        {scrollState !== "static" ? (
          <div className="bottom-sheet__scroll-cue" role="status" aria-live="polite">
            {scrollState === "more" ? <ChevronDown aria-hidden="true" /> : <Check aria-hidden="true" />}
            <span>{scrollState === "more" ? "아래로 더 보기" : "모두 확인했습니다"}</span>
          </div>
        ) : null}
      </section>
    </>,
    document.body
  );
}

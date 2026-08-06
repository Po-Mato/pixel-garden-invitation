import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalDialogFocus } from "../accessibility/useModalDialogFocus";

type BottomSheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function BottomSheet({ title, onClose, children, className = "" }: BottomSheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useModalDialogFocus({
    open: true,
    dialogRef,
    initialFocusRef: titleRef,
    onEscape: onClose,
    isolateApp: true
  });

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
        tabIndex={-1}
      >
        <header className="bottom-sheet__header">
          <h2 ref={titleRef} id={titleId} tabIndex={-1}>{title}</h2>
          <button type="button" aria-label="닫기" onClick={onClose}>
            닫기
          </button>
        </header>
        <p id={descriptionId} className="sr-only">{title} 창입니다. 닫기 버튼 다음에 주요 내용이 이어집니다.</p>
        <div className="bottom-sheet__body">{children}</div>
      </section>
    </>,
    document.body
  );
}

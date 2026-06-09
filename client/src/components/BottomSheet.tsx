import { useEffect, useRef, type ReactNode } from "react";

type BottomSheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <>
      <div className="sheet-backdrop" />
      <section className="bottom-sheet" role="dialog" aria-modal={true} aria-label={title}>
        <header className="bottom-sheet__header">
          <h2>{title}</h2>
          <button ref={closeButtonRef} type="button" aria-label="닫기" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="bottom-sheet__body">{children}</div>
      </section>
    </>
  );
}

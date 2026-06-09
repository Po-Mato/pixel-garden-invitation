import type { ReactNode } from "react";

type BottomSheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  return (
    <>
      <div className="sheet-backdrop" />
      <section className="bottom-sheet" role="dialog" aria-modal={true} aria-label={title}>
        <header className="bottom-sheet__header">
          <h2>{title}</h2>
          <button type="button" aria-label="닫기" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="bottom-sheet__body">{children}</div>
      </section>
    </>
  );
}

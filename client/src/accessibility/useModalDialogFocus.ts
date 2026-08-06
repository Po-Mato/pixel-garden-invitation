import { useEffect, useRef, type RefObject } from "react";
import { isolateAppForModal } from "./modalIsolation";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => (
    element.tabIndex >= 0
    && element.getAttribute("aria-hidden") !== "true"
    && !element.closest("[inert]")
  ));
}

type ModalDialogFocusOptions = {
  open: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onEscape: () => void;
  suspended?: boolean;
  isolateApp?: boolean;
  lockBody?: boolean;
};

export function useModalDialogFocus({
  open,
  dialogRef,
  initialFocusRef,
  returnFocusRef,
  onEscape,
  suspended = false,
  isolateApp = false,
  lockBody = true
}: ModalDialogFocusOptions) {
  const onEscapeRef = useRef(onEscape);
  const suspendedRef = useRef(suspended);

  onEscapeRef.current = onEscape;
  suspendedRef.current = suspended;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = returnFocusRef?.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousOverflow = document.body.style.overflow;
    const restoreApp = isolateApp ? isolateAppForModal() : () => undefined;

    if (lockBody) document.body.style.overflow = "hidden";
    (initialFocusRef?.current ?? dialogRef.current)?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (suspendedRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const elements = focusableElements(dialog);
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === dialog || active === initialFocusRef?.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (lockBody) document.body.style.overflow = previousOverflow;
      restoreApp();
      const active = document.activeElement;
      if (
        previouslyFocused?.isConnected
        && (!active || active === document.body || dialogRef.current?.contains(active))
      ) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [dialogRef, initialFocusRef, isolateApp, lockBody, open, returnFocusRef]);
}

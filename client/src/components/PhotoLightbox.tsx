import type { WeddingGalleryPhoto } from "@wedding-game/shared";
import { ChevronLeft, ChevronRight, ImageUp, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { isolateAppForModal } from "../accessibility/modalIsolation";
import { useViewPreferences } from "../accessibility/ViewPreferencesContext";
import { useNetworkMode } from "../performance/networkQuality";
import { galleryPrefetchUrl, nextGalleryPrefetchIndex } from "../performance/galleryPrefetch";
import { preloadImage } from "../performance/imagePreloader";
import { ResponsiveGalleryImage } from "./ResponsiveGalleryImage";

type PhotoLightboxProps = {
  photos: readonly WeddingGalleryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

type PointerStart = {
  pointerId: number;
  x: number;
  y: number;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

const interactiveSwipeSelector = "button, a, input, select, textarea, [role='button']";

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.tabIndex >= 0 && element.getAttribute("aria-hidden") !== "true"
  );
}

export function PhotoLightbox({ photos, index, onIndexChange, onClose }: PhotoLightboxProps) {
  const { preferences } = useViewPreferences();
  const networkMode = useNetworkMode(preferences.dataSaver);
  const [fullQualityPhotoId, setFullQualityPhotoId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pointerStartRef = useRef<PointerStart | null>(null);
  const indexRef = useRef(index);
  const photoCountRef = useRef(photos.length);
  const onIndexChangeRef = useRef(onIndexChange);
  const onCloseRef = useRef(onClose);
  const previousIndexRef = useRef(index);

  indexRef.current = index;
  photoCountRef.current = photos.length;
  onIndexChangeRef.current = onIndexChange;
  onCloseRef.current = onClose;

  const photo = Number.isInteger(index) && index >= 0 && index < photos.length ? photos[index] : undefined;
  const hasValidPhoto = photo !== undefined;

  useEffect(() => {
    if (!hasValidPhoto) {
      pointerStartRef.current = null;
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const restoreApp = isolateAppForModal();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        const nextIndex = event.key === "ArrowLeft" ? indexRef.current - 1 : indexRef.current + 1;
        if (nextIndex >= 0 && nextIndex < photoCountRef.current) {
          onIndexChangeRef.current(nextIndex);
        }
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const dialog = dialogRef.current;

      if (!dialog) {
        return;
      }

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!dialog.contains(activeElement)) {
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
      }

      const activeIndex = focusableElements.indexOf(activeElement as HTMLElement);
      if (event.shiftKey) {
        focusableElements[activeIndex > 0 ? activeIndex - 1 : focusableElements.length - 1].focus();
      } else {
        focusableElements[activeIndex >= 0 && activeIndex < focusableElements.length - 1 ? activeIndex + 1 : 0].focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreApp();
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [hasValidPhoto]);

  useEffect(() => {
    const previous = previousIndexRef.current;
    previousIndexRef.current = index;
    if (networkMode === "economy") return;
    const nextIndex = nextGalleryPrefetchIndex(index, previous, photos.length);
    const nextPhoto = nextIndex === null ? null : photos[nextIndex];
    const url = nextPhoto ? galleryPrefetchUrl(nextPhoto, networkMode) : null;
    if (!url) return;

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let timer: number | null = null;
    let idleId: number | null = null;
    const preload = () => { void preloadImage(url, "low"); };
    if (idleWindow.requestIdleCallback) idleId = idleWindow.requestIdleCallback(preload, { timeout: 800 });
    else timer = window.setTimeout(preload, 240);
    return () => {
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [index, networkMode, photos]);

  if (!photo) {
    return null;
  }
  const fullQuality = fullQualityPhotoId === photo.id;

  const captionId = photo.caption ? `photo-lightbox-caption-${photo.id}` : undefined;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest(interactiveSwipeSelector)) {
      pointerStartRef.current = null;
      return;
    }

    pointerStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;

    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const horizontal = event.clientX - start.x;
    const vertical = event.clientY - start.y;
    const isSwipe = Math.abs(horizontal) >= 48 && Math.abs(horizontal) > Math.abs(vertical);

    if (!isSwipe) {
      return;
    }

    const nextIndex = horizontal < 0 ? index + 1 : index - 1;
    if (nextIndex >= 0 && nextIndex < photos.length) {
      onIndexChange(nextIndex);
    }
  };

  return createPortal(
    <div
      ref={dialogRef}
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="웨딩 사진 전체 화면"
      aria-describedby={captionId}
      tabIndex={-1}
    >
      <header className="photo-lightbox__header">
        <p className="photo-lightbox__counter" aria-live="polite">
          {index + 1} / {photos.length}
        </p>
        <button
          ref={closeButtonRef}
          className="photo-lightbox__close"
          type="button"
          aria-label="전체 화면 닫기"
          title="전체 화면 닫기"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </header>

      <div
        className="photo-lightbox__stage"
        data-testid="photo-lightbox-stage"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStartRef.current = null;
        }}
      >
        <button
          className="photo-lightbox__previous"
          type="button"
          aria-label="이전 사진"
          title="이전 사진"
          disabled={index === 0}
          onClick={() => onIndexChange(index - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="photo-lightbox__media">
          <ResponsiveGalleryImage
            key={`${photo.id}-${fullQuality ? "full" : "auto"}`}
            photo={photo}
            priority
            quality={fullQuality ? "full" : "auto"}
            sizes="100vw"
          />
        </div>
        <button
          className="photo-lightbox__next"
          type="button"
          aria-label="다음 사진"
          title="다음 사진"
          disabled={index === photos.length - 1}
          onClick={() => onIndexChange(index + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <footer className="photo-lightbox__footer">
        {networkMode === "economy" && !fullQuality ? (
          <button className="photo-lightbox__quality" type="button" onClick={() => setFullQualityPhotoId(photo.id)}>
            <ImageUp aria-hidden="true" /> 이 사진 고화질로 보기
          </button>
        ) : null}
        {photo.caption ? (
          <p id={captionId} className="photo-lightbox__caption">
            {photo.caption}
          </p>
        ) : null}
      </footer>
    </div>,
    document.body
  );
}

import type { WeddingGalleryPhoto } from "@wedding-game/shared";
import { useRef, useState } from "react";
import { Images } from "lucide-react";
import { useViewPreferences } from "../accessibility/ViewPreferencesContext";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { useNetworkMode } from "../performance/networkQuality";
import { PhotoLightbox } from "./PhotoLightbox";
import { ResponsiveGalleryImage } from "./ResponsiveGalleryImage";
import { trackAnalyticsContextEvent } from "../analytics/invitationAnalytics";

type WeddingGalleryProps = {
  photos?: readonly WeddingGalleryPhoto[];
  onPhotoOpen?: (index: number) => void;
};

function galleryImageSizes(layout: WeddingGalleryPhoto["layout"]): string {
  return layout === "half" ? "(max-width: 520px) 44vw, 180px" : "(max-width: 520px) 88vw, 354px";
}

export function WeddingGallery({ photos: photosOverride, onPhotoOpen }: WeddingGalleryProps) {
  const { content } = usePublishedInvitationContent();
  const photos = photosOverride ?? content.gallery;
  const { preferences } = useViewPreferences();
  const networkMode = useNetworkMode(preferences.dataSaver);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const photoButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const initialPhotoCount = 4;
  const deferredCount = Math.max(0, photos.length - initialPhotoCount);
  const visiblePhotos = networkMode === "economy" && !expanded
    ? photos.slice(0, initialPhotoCount)
    : photos;

  const openPhoto = (index: number) => {
    const trigger = photoButtonRefs.current[index];
    returnFocusRef.current = trigger;
    trigger?.focus();
    onPhotoOpen?.(index);
    trackAnalyticsContextEvent("gallery_zoom");
    setSelectedIndex(index);
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
    returnFocusRef.current?.focus();
  };

  return (
    <>
      <section className="wedding-gallery" aria-label="웨딩 사진 갤러리">
        {visiblePhotos.map((photo, index) => (
          <figure key={photo.id} className={`wedding-gallery__item wedding-gallery__item--${photo.layout}`}>
            <button
              ref={(element) => {
                photoButtonRefs.current[index] = element;
              }}
              className="wedding-gallery__photo-button"
              type="button"
              aria-label={`사진 ${index + 1}: ${photo.alt}`}
              onClick={() => openPhoto(index)}
            >
              <ResponsiveGalleryImage photo={photo} priority={index === 0} sizes={galleryImageSizes(photo.layout)} />
            </button>
            {photo.caption ? <figcaption className="wedding-gallery__caption">{photo.caption}</figcaption> : null}
          </figure>
        ))}
      </section>
      {networkMode === "economy" && deferredCount > 0 ? (
        <div className="wedding-gallery__network-control" role="status">
          <span>데이터 절약 중 · 사진 {visiblePhotos.length}/{photos.length}장 표시</span>
          {!expanded ? (
            <button type="button" onClick={() => setExpanded(true)}>
              <Images aria-hidden="true" /> 나머지 {deferredCount}장 불러오기
            </button>
          ) : null}
        </div>
      ) : null}
      {selectedIndex !== null ? (
        <PhotoLightbox
          photos={photos}
          index={selectedIndex}
          onIndexChange={setSelectedIndex}
          onClose={closeLightbox}
        />
      ) : null}
    </>
  );
}

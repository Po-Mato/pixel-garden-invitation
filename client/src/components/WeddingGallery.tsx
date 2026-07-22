import type { WeddingGalleryPhoto } from "@wedding-game/shared";
import { useRef, useState } from "react";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { PhotoLightbox } from "./PhotoLightbox";
import { ResponsiveGalleryImage } from "./ResponsiveGalleryImage";

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const photoButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  const openPhoto = (index: number) => {
    const trigger = photoButtonRefs.current[index];
    returnFocusRef.current = trigger;
    trigger?.focus();
    onPhotoOpen?.(index);
    setSelectedIndex(index);
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
    returnFocusRef.current?.focus();
  };

  return (
    <>
      <section className="wedding-gallery" aria-label="웨딩 사진 갤러리">
        {photos.map((photo, index) => (
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

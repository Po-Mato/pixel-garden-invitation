import { invitationContent, type WeddingGalleryPhoto } from "@wedding-game/shared";
import { ResponsiveGalleryImage } from "./ResponsiveGalleryImage";

type WeddingGalleryProps = {
  photos?: readonly WeddingGalleryPhoto[];
  onPhotoOpen?: (index: number) => void;
};

function galleryImageSizes(layout: WeddingGalleryPhoto["layout"]): string {
  return layout === "half" ? "(max-width: 520px) 44vw, 180px" : "(max-width: 520px) 88vw, 354px";
}

export function WeddingGallery({ photos = invitationContent.content.gallery, onPhotoOpen }: WeddingGalleryProps) {
  return (
    <section className="wedding-gallery" aria-label="웨딩 사진 갤러리">
      {photos.map((photo, index) => (
        <figure key={photo.id} className={`wedding-gallery__item wedding-gallery__item--${photo.layout}`}>
          <button
            className="wedding-gallery__photo-button"
            type="button"
            aria-label={`사진 ${index + 1}: ${photo.alt}`}
            onClick={() => onPhotoOpen?.(index)}
          >
            <ResponsiveGalleryImage photo={photo} priority={index === 0} sizes={galleryImageSizes(photo.layout)} />
          </button>
          {photo.caption ? <figcaption className="wedding-gallery__caption">{photo.caption}</figcaption> : null}
        </figure>
      ))}
    </section>
  );
}

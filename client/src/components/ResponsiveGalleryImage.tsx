import { useState } from "react";
import type { WeddingGalleryPhoto } from "@wedding-game/shared";
import { buildGallerySrcSet, resolveGalleryAssetPath } from "../invitation/galleryAssets";

type ResponsiveGalleryImageProps = {
  photo: WeddingGalleryPhoto;
  priority?: boolean;
  sizes: string;
};

export function ResponsiveGalleryImage({ photo, priority = false, sizes }: ResponsiveGalleryImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="responsive-gallery-image responsive-gallery-image--fallback"
        role="img"
        aria-label={photo.alt}
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
      >
        {photo.alt}
      </div>
    );
  }

  return (
    <img
      className="responsive-gallery-image"
      src={resolveGalleryAssetPath(photo.assetPath)}
      srcSet={buildGallerySrcSet(photo.sources)}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={photo.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

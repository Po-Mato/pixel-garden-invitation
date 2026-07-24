import { useEffect, useMemo, useState } from "react";
import type { WeddingGalleryPhoto } from "@wedding-game/shared";
import { useViewPreferences } from "../accessibility/ViewPreferencesContext";
import {
  buildGalleryFormatSrcSet,
  buildGallerySrcSet,
  gallerySourcePathForFormat,
  resolveGalleryAssetPath
} from "../invitation/galleryAssets";
import { useNetworkMode } from "../performance/networkQuality";

type ResponsiveGalleryImageProps = {
  photo: WeddingGalleryPhoto;
  priority?: boolean;
  quality?: "auto" | "full";
  sizes: string;
};

export function ResponsiveGalleryImage({ photo, priority = false, quality = "auto", sizes }: ResponsiveGalleryImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { preferences } = useViewPreferences();
  const networkMode = useNetworkMode(preferences.dataSaver);
  const effectiveMode = quality === "full" ? "balanced" : networkMode;
  const economySource = useMemo(() => (
    [...photo.sources].sort((left, right) => left.width - right.width)[0]
  ), [photo.sources]);
  const source = effectiveMode === "economy" && economySource
    ? economySource.assetPath
    : photo.assetPath;
  const avifSource = gallerySourcePathForFormat(source, "avif");
  const avifSrcSet = effectiveMode === "balanced"
    ? buildGalleryFormatSrcSet(photo.sources, "avif")
    : avifSource ? resolveGalleryAssetPath(avifSource) : null;
  const priorityAttribute = { fetchpriority: priority ? "high" : "auto" };

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [effectiveMode, photo.id, retryCount]);

  useEffect(() => {
    if (!failed) return;
    const retry = () => setRetryCount((current) => current + 1);
    window.addEventListener("online", retry, { once: true });
    return () => window.removeEventListener("online", retry);
  }, [failed]);

  if (failed) {
    return (
      <div
        className="responsive-gallery-image responsive-gallery-image--fallback"
        role="img"
        aria-label={photo.alt}
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
      >
        <span>{photo.alt}</span>
        <small>연결되면 이 사진만 다시 불러옵니다</small>
      </div>
    );
  }

  return (
    <picture className="responsive-gallery-picture">
      {avifSrcSet ? <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} /> : null}
      <img
        className={`responsive-gallery-image responsive-gallery-image--${loaded ? "loaded" : "loading"}`}
        data-network-mode={quality === "full" ? "full" : networkMode}
        data-retry-count={retryCount}
        src={resolveGalleryAssetPath(source)}
        srcSet={effectiveMode === "balanced" ? buildGallerySrcSet(photo.sources) : undefined}
        sizes={sizes}
        width={photo.width}
        height={photo.height}
        alt={photo.alt}
        loading={priority ? "eager" : "lazy"}
        {...priorityAttribute}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setFailed(true);
        }}
      />
    </picture>
  );
}

export function resolveGalleryAssetPath(assetPath: string, baseUrl = import.meta.env.BASE_URL): string {
  if (/^https?:\/\//.test(assetPath)) return assetPath;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return `${normalizedBase}${assetPath.replace(/^\/+/, "")}`;
}

type GallerySource = {
  assetPath: string;
  width: number;
};

export type GalleryImageFormat = "webp" | "avif";

export function buildGallerySrcSet(sources: readonly GallerySource[], baseUrl = import.meta.env.BASE_URL): string {
  return sources.map((source) => `${resolveGalleryAssetPath(source.assetPath, baseUrl)} ${source.width}w`).join(", ");
}

export function gallerySourcePathForFormat(assetPath: string, format: GalleryImageFormat): string | null {
  if (format === "webp") return assetPath;
  if (/^https?:\/\//.test(assetPath) || !assetPath.toLowerCase().endsWith(".webp")) return null;
  return assetPath.replace(/\.webp$/i, ".avif");
}

export function buildGalleryFormatSrcSet(
  sources: readonly GallerySource[],
  format: GalleryImageFormat,
  baseUrl = import.meta.env.BASE_URL
): string | null {
  const formatted = sources.map((source) => {
    const assetPath = gallerySourcePathForFormat(source.assetPath, format);
    return assetPath ? { ...source, assetPath } : null;
  });
  if (formatted.some((source) => source === null)) return null;
  return buildGallerySrcSet(formatted as GallerySource[], baseUrl);
}

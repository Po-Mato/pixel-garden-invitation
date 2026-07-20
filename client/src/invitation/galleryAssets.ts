export function resolveGalleryAssetPath(assetPath: string, baseUrl = import.meta.env.BASE_URL): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return `${normalizedBase}${assetPath.replace(/^\/+/, "")}`;
}

type GallerySource = {
  assetPath: string;
  width: number;
};

export function buildGallerySrcSet(sources: readonly GallerySource[], baseUrl = import.meta.env.BASE_URL): string {
  return sources.map((source) => `${resolveGalleryAssetPath(source.assetPath, baseUrl)} ${source.width}w`).join(", ");
}

export function resolveGalleryAssetPath(assetPath: string, baseUrl = import.meta.env.BASE_URL): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return `${normalizedBase}${assetPath.replace(/^\/+/, "")}`;
}

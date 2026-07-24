import type { WeddingGalleryPhoto } from "@wedding-game/shared";
import { resolveGalleryAssetPath } from "../invitation/galleryAssets";
import type { NetworkMode } from "./networkQuality";

export function nextGalleryPrefetchIndex(current: number, previous: number, count: number): number | null {
  if (count < 2 || current < 0 || current >= count) return null;
  const direction = current < previous ? -1 : 1;
  const forward = current + direction;
  if (forward >= 0 && forward < count) return forward;
  const reverse = current - direction;
  return reverse >= 0 && reverse < count ? reverse : null;
}

export function galleryPrefetchUrl(photo: WeddingGalleryPhoto, mode: NetworkMode): string | null {
  if (mode === "economy") return null;
  const source = [...photo.sources].sort((left, right) => right.width - left.width)[0];
  return source ? resolveGalleryAssetPath(source.assetPath) : resolveGalleryAssetPath(photo.assetPath);
}

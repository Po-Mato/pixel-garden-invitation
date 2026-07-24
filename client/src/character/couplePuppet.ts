import { shouldReduceMotion } from "../accessibility/viewPreferences";
import type { CoupleSide } from "../invitation/coupleOrder";

const PUPPET_ASSET_ROOT = "characters/puppets";

export function resolveCouplePuppetAssetPath(
  character: CoupleSide,
  fileName: string,
  baseUrl = import.meta.env.BASE_URL
) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${PUPPET_ASSET_ROOT}/${character}/${fileName}`;
}

export function allowsCouplePuppetMotion(root = document.documentElement): boolean {
  return root.dataset.performanceMode !== "lite"
    && root.dataset.dataSaver !== "true"
    && !shouldReduceMotion(root);
}

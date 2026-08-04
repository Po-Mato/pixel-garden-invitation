import type { WorldZoneId } from "@wedding-game/shared";
import {
  foregroundRecommendationReviewsForZone,
  type ForegroundRecommendationDecision
} from "./worldForegroundRecommendations";

export const worldForegroundReviewStorageKey = "wedding-game:map-foreground-review:v1";
export const worldForegroundReviewQueryParameter = "mapAuditReview";

type ForegroundRecommendationDecisions = Partial<Record<string, ForegroundRecommendationDecision>>;
type ReviewStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const validReviewKeys = new Set(
  ([
    "home",
    "neighborhood",
    "subway-station",
    "subway-train",
    "venue-exterior",
    "lobby",
    "bridal-room",
    "ceremony-hall",
    "banquet",
    "restroom"
  ] as WorldZoneId[]).flatMap((zoneId) => (
    foregroundRecommendationReviewsForZone(zoneId).map((review) => review.key)
  ))
);

function normalizedDecisionEntries(decisions: ForegroundRecommendationDecisions) {
  return Object.entries(decisions)
    .filter((entry): entry is [string, "accepted" | "rejected"] => (
      validReviewKeys.has(entry[0]) && (entry[1] === "accepted" || entry[1] === "rejected")
    ))
    .sort(([left], [right]) => left.localeCompare(right));
}

export function normalizeWorldForegroundReviewDecisions(value: unknown): ForegroundRecommendationDecisions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(normalizedDecisionEntries(value as ForegroundRecommendationDecisions));
}

export function serializeWorldForegroundReviewDecisions(decisions: ForegroundRecommendationDecisions): string {
  return normalizedDecisionEntries(decisions)
    .map(([key, decision]) => `${decision === "accepted" ? "a" : "r"}:${key}`)
    .join(",");
}

export function parseWorldForegroundReviewDecisions(value: string | null): ForegroundRecommendationDecisions {
  if (!value) return {};
  return normalizeWorldForegroundReviewDecisions(Object.fromEntries(value.split(",").flatMap((token) => {
    const separator = token.indexOf(":");
    if (separator < 1) return [];
    const prefix = token.slice(0, separator);
    const key = token.slice(separator + 1);
    if (!validReviewKeys.has(key) || (prefix !== "a" && prefix !== "r")) return [];
    return [[key, prefix === "a" ? "accepted" : "rejected"]];
  })));
}

export function loadWorldForegroundReviewDecisions(
  queryValue: string | null,
  storage: ReviewStorage
): ForegroundRecommendationDecisions {
  if (queryValue !== null) return parseWorldForegroundReviewDecisions(queryValue);
  try {
    const stored = storage.getItem(worldForegroundReviewStorageKey);
    if (!stored) return {};
    const envelope = JSON.parse(stored) as { version?: unknown; decisions?: unknown };
    return envelope.version === 1 ? normalizeWorldForegroundReviewDecisions(envelope.decisions) : {};
  } catch {
    return {};
  }
}

export function saveWorldForegroundReviewDecisions(
  decisions: ForegroundRecommendationDecisions,
  storage: ReviewStorage
): void {
  const normalized = normalizeWorldForegroundReviewDecisions(decisions);
  try {
    if (Object.keys(normalized).length === 0) {
      storage.removeItem(worldForegroundReviewStorageKey);
      return;
    }
    storage.setItem(worldForegroundReviewStorageKey, JSON.stringify({ version: 1, decisions: normalized }));
  } catch {
    // Private browsing and full storage quotas must not break the diagnostic controls.
  }
}

export function writeWorldForegroundReviewDecisionsToUrl(
  url: URL,
  decisions: ForegroundRecommendationDecisions
): URL {
  const serialized = serializeWorldForegroundReviewDecisions(decisions);
  if (serialized) url.searchParams.set(worldForegroundReviewQueryParameter, serialized);
  else url.searchParams.delete(worldForegroundReviewQueryParameter);
  return url;
}

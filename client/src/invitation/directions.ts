import type { WeddingEvent } from "@wedding-game/shared";

export type DirectionsLinks = {
  naver: string | null;
  kakao: string | null;
  google: string | null;
  telephone: string | null;
};

export function buildTelephoneHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return /^\d{9,11}$/.test(digits) ? `tel:${digits}` : null;
}

export function buildDirectionsLinks(venue: WeddingEvent["venue"]): DirectionsLinks {
  const mapSearchName = venue.directions.mapSearchName.trim();
  const address = venue.address.trim();
  const telephone = buildTelephoneHref(venue.directions.phone);

  if (!mapSearchName || !address) {
    return { naver: null, kakao: null, google: null, telephone };
  }

  const destination = `${mapSearchName} ${address}`;
  const kakao = new URL("https://map.kakao.com/");
  kakao.searchParams.set("q", destination);
  const google = new URL("https://www.google.com/maps/dir/");
  google.searchParams.set("api", "1");
  google.searchParams.set("destination", destination);

  return {
    naver: `https://map.naver.com/p/search/${encodeURIComponent(destination)}`,
    kakao: kakao.toString(),
    google: google.toString(),
    telephone
  };
}

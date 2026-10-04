import extendedFontCssUrl from "@fontsource-variable/noto-sans-kr/wght.css?url";
import { criticalKoreanGlyphs, extendedNonKoreanRanges } from "./gameTypographyGlyphs";

function isExtendedTypographyCodePoint(codePoint: number) {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x11ff)
    || (codePoint >= 0x3130 && codePoint <= 0x318f)
    || (codePoint >= 0x3400 && codePoint <= 0x9fff)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || extendedNonKoreanRanges.some(([start, end]) => codePoint >= start && codePoint <= end)
  );
}

export function requiresExtendedGameTypography(values: readonly string[]) {
  for (const value of values) {
    for (const glyph of value.normalize("NFC")) {
      const codePoint = glyph.codePointAt(0);
      if (codePoint !== undefined && isExtendedTypographyCodePoint(codePoint) && !criticalKoreanGlyphs.includes(glyph)) {
        return true;
      }
    }
  }
  return false;
}

let extendedGameTypography: Promise<boolean> | null = null;

export function loadExtendedGameTypography() {
  if (extendedGameTypography) return extendedGameTypography;
  extendedGameTypography = new Promise<boolean>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = extendedFontCssUrl;
    link.addEventListener("load", () => resolve(true), { once: true });
    link.addEventListener("error", () => {
      link.remove();
      extendedGameTypography = null;
      resolve(false);
    }, { once: true });
    document.head.appendChild(link);
  });
  return extendedGameTypography;
}

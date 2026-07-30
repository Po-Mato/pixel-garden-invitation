export type PhotoFrameTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export const defaultPhotoFrameTransform: PhotoFrameTransform = { zoom: 1, offsetX: 0, offsetY: 0 };

export type PhotoStickerTone = "ivory" | "rose" | "sage";
export type PhotoStickerFont = "serif" | "hand" | "sans";
export type PhotoStickerStyle = { tone: PhotoStickerTone; font: PhotoStickerFont };

export const defaultPhotoStickerStyle: PhotoStickerStyle = { tone: "ivory", font: "serif" };
export const photoStickerToneLabels: Record<PhotoStickerTone, string> = { ivory: "아이보리", rose: "로즈", sage: "세이지" };
export const photoStickerFontLabels: Record<PhotoStickerFont, string> = { serif: "명조", hand: "손글씨", sans: "고딕" };

const stickerTones: Record<PhotoStickerTone, { background: string; color: string }> = {
  ivory: { background: "rgba(255, 248, 224, .96)", color: "#714d59" },
  rose: { background: "rgba(166, 83, 105, .96)", color: "#fff9ed" },
  sage: { background: "rgba(84, 119, 99, .96)", color: "#fff9ed" }
};

const stickerFonts: Record<PhotoStickerFont, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  hand: '"Nanum Pen Script", "Comic Sans MS", cursive',
  sans: '"Apple SD Gothic Neo", sans-serif'
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 0));
}

export function normalizePhotoFrameTransform(value?: Partial<PhotoFrameTransform> | null): PhotoFrameTransform {
  return {
    zoom: clamp(value?.zoom ?? 1, 1, 1.6),
    offsetX: clamp(value?.offsetX ?? 0, -1, 1),
    offsetY: clamp(value?.offsetY ?? 0, -1, 1)
  };
}

export function panPhotoFrameTransform(
  value: Partial<PhotoFrameTransform> | null,
  deltaX: number,
  deltaY: number,
  frameWidth: number,
  frameHeight: number
) {
  const current = normalizePhotoFrameTransform(value);
  return normalizePhotoFrameTransform({
    ...current,
    offsetX: current.offsetX - deltaX / Math.max(1, frameWidth * 0.42),
    offsetY: current.offsetY - deltaY / Math.max(1, frameHeight * 0.42)
  });
}

export function zoomPhotoFrameTransform(value: Partial<PhotoFrameTransform> | null, factor: number) {
  const current = normalizePhotoFrameTransform(value);
  return normalizePhotoFrameTransform({ ...current, zoom: current.zoom * (Number.isFinite(factor) ? factor : 1) });
}

export function resolveCoverCrop(input: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  transform?: Partial<PhotoFrameTransform> | null;
}) {
  const transform = normalizePhotoFrameTransform(input.transform);
  const sourceRatio = input.sourceWidth / input.sourceHeight;
  const targetRatio = input.targetWidth / input.targetHeight;
  const baseWidth = sourceRatio > targetRatio ? input.sourceHeight * targetRatio : input.sourceWidth;
  const baseHeight = sourceRatio > targetRatio ? input.sourceHeight : input.sourceWidth / targetRatio;
  const width = baseWidth / transform.zoom;
  const height = baseHeight / transform.zoom;
  const centerX = input.sourceWidth / 2 + transform.offsetX * (input.sourceWidth - width) / 2;
  const centerY = input.sourceHeight / 2 + transform.offsetY * (input.sourceHeight - height) / 2;
  return {
    x: clamp(centerX - width / 2, 0, input.sourceWidth - width),
    y: clamp(centerY - height / 2, 0, input.sourceHeight - height),
    width,
    height
  };
}

export function photoFramePreviewStyle(transform?: Partial<PhotoFrameTransform> | null) {
  const normalized = normalizePhotoFrameTransform(transform);
  const x = 50 + normalized.offsetX * 35;
  const y = 50 + normalized.offsetY * 35;
  return {
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${normalized.zoom})`,
    transformOrigin: `${x}% ${y}%`
  };
}

export function normalizePhotoStickerText(value: string, maximumLength = 24) {
  return value.replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

export function normalizePhotoStickerStyle(value?: Partial<PhotoStickerStyle> | null): PhotoStickerStyle {
  return {
    tone: value?.tone && value.tone in stickerTones ? value.tone : defaultPhotoStickerStyle.tone,
    font: value?.font && value.font in stickerFonts ? value.font : defaultPhotoStickerStyle.font
  };
}

export function photoStickerPreviewStyle(value?: Partial<PhotoStickerStyle> | null) {
  const style = normalizePhotoStickerStyle(value);
  return {
    background: stickerTones[style.tone].background,
    color: stickerTones[style.tone].color,
    fontFamily: stickerFonts[style.font]
  };
}

export function photoStickerCanvasStyle(value?: Partial<PhotoStickerStyle> | null, size = 24) {
  const style = normalizePhotoStickerStyle(value);
  return {
    background: stickerTones[style.tone].background,
    color: stickerTones[style.tone].color,
    font: `${style.font === "hand" ? 700 : 900} ${size}px ${stickerFonts[style.font]}`
  };
}

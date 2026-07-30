export type PhotoFrameTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
};

export const defaultPhotoFrameTransform: PhotoFrameTransform = { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 };

export type PhotoFramePreset = "center" | "portrait" | "upper";
export const photoFramePresetLabels: Record<PhotoFramePreset, string> = {
  center: "기본",
  portrait: "인물",
  upper: "상단"
};

export type PhotoFrameHistory = {
  past: PhotoFrameTransform[];
  current: PhotoFrameTransform;
  future: PhotoFrameTransform[];
};

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

function rotationCoverScale(rotation: number, aspectRatio: number) {
  const radians = Math.abs(rotation) * Math.PI / 180;
  const ratio = Math.max(0.01, aspectRatio);
  return Math.max(
    Math.cos(radians) + Math.sin(radians) / ratio,
    Math.cos(radians) + Math.sin(radians) * ratio
  );
}

export function normalizePhotoFrameTransform(value?: Partial<PhotoFrameTransform> | null): PhotoFrameTransform {
  return {
    zoom: clamp(value?.zoom ?? 1, 1, 1.6),
    offsetX: clamp(value?.offsetX ?? 0, -1, 1),
    offsetY: clamp(value?.offsetY ?? 0, -1, 1),
    rotation: clamp(value?.rotation ?? 0, -12, 12)
  };
}

function samePhotoFrameTransform(left: PhotoFrameTransform, right: PhotoFrameTransform) {
  return left.zoom === right.zoom
    && left.offsetX === right.offsetX
    && left.offsetY === right.offsetY
    && left.rotation === right.rotation;
}

export function createPhotoFrameHistory(value?: Partial<PhotoFrameTransform> | null): PhotoFrameHistory {
  return { past: [], current: normalizePhotoFrameTransform(value), future: [] };
}

export function commitPhotoFrameHistory(history: PhotoFrameHistory, value: Partial<PhotoFrameTransform> | null): PhotoFrameHistory {
  const next = normalizePhotoFrameTransform(value);
  if (samePhotoFrameTransform(history.current, next)) return history;
  return { past: [...history.past, history.current].slice(-20), current: next, future: [] };
}

export function undoPhotoFrameHistory(history: PhotoFrameHistory): PhotoFrameHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return { past: history.past.slice(0, -1), current: previous, future: [history.current, ...history.future].slice(0, 20) };
}

export function redoPhotoFrameHistory(history: PhotoFrameHistory): PhotoFrameHistory {
  const next = history.future[0];
  if (!next) return history;
  return { past: [...history.past, history.current].slice(-20), current: next, future: history.future.slice(1) };
}

export function photoFramePresetTransform(preset: PhotoFramePreset): PhotoFrameTransform {
  if (preset === "portrait") return { zoom: 1.25, offsetX: 0, offsetY: -0.08, rotation: 0 };
  if (preset === "upper") return { zoom: 1.15, offsetX: 0, offsetY: -0.55, rotation: 0 };
  return defaultPhotoFrameTransform;
}

export function rotatePhotoFrameTransform(value: Partial<PhotoFrameTransform> | null, delta: number) {
  const current = normalizePhotoFrameTransform(value);
  return normalizePhotoFrameTransform({ ...current, rotation: current.rotation + delta });
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
  const rotationScale = rotationCoverScale(normalized.rotation, 16 / 9);
  return {
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${normalized.zoom * rotationScale}) rotate(${normalized.rotation}deg)`,
    transformOrigin: `${x}% ${y}%`
  };
}

export function drawPhotoFrameCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  value?: Partial<PhotoFrameTransform> | null
) {
  const transform = normalizePhotoFrameTransform(value);
  const crop = resolveCoverCrop({
    sourceWidth: image.naturalWidth,
    sourceHeight: image.naturalHeight,
    targetWidth: width,
    targetHeight: height,
    transform
  });
  const rotationScale = rotationCoverScale(transform.rotation, width / height);
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.translate(x + width / 2, y + height / 2);
  context.rotate(transform.rotation * Math.PI / 180);
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    -width * rotationScale / 2,
    -height * rotationScale / 2,
    width * rotationScale,
    height * rotationScale
  );
  context.restore();
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

export type PhotoFrameTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export const defaultPhotoFrameTransform: PhotoFrameTransform = { zoom: 1, offsetX: 0, offsetY: 0 };

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

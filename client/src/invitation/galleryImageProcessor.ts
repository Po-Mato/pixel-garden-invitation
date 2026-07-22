export const maxGallerySourceBytes = 15 * 1024 * 1024;

export type GalleryCropSettings = {
  focusX: number;
  focusY: number;
  zoom: number;
};

export type GallerySourceImage = {
  image: HTMLImageElement;
  width: number;
  height: number;
  dispose: () => void;
};

export type GalleryDerivative = {
  width: 640 | 1024;
  height: number;
  blob: Blob;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateGalleryCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: number,
  settings: GalleryCropSettings
) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetAspect <= 0) {
    throw new Error("invalid_dimensions");
  }
  const zoom = clamp(settings.zoom, 1, 2.5);
  const sourceAspect = sourceWidth / sourceHeight;
  let cropWidth = sourceAspect > targetAspect ? sourceHeight * targetAspect : sourceWidth;
  let cropHeight = sourceAspect > targetAspect ? sourceHeight : sourceWidth / targetAspect;
  cropWidth /= zoom;
  cropHeight /= zoom;
  const focusX = (clamp(settings.focusX, -1, 1) + 1) / 2;
  const focusY = (clamp(settings.focusY, -1, 1) + 1) / 2;
  return {
    x: (sourceWidth - cropWidth) * focusX,
    y: (sourceHeight - cropHeight) * focusY,
    width: cropWidth,
    height: cropHeight
  };
}

export function validateGallerySourceFile(file: File): string | null {
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
    return "JPG, PNG, WebP 사진만 사용할 수 있습니다.";
  }
  if (file.size <= 0 || file.size > maxGallerySourceBytes) {
    return "사진 한 장은 15MB 이하여야 합니다.";
  }
  return null;
}

export function loadGallerySourceImage(file: File): Promise<GallerySourceImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve({
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl)
    });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image_decode_failed"));
    };
    image.src = objectUrl;
  });
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("webp_encode_failed")), "image/webp", 0.9);
  });
}

export async function createGalleryDerivatives(
  source: GallerySourceImage,
  targetAspect: number,
  settings: GalleryCropSettings
): Promise<GalleryDerivative[]> {
  const crop = calculateGalleryCropRect(source.width, source.height, targetAspect, settings);
  return Promise.all(([640, 1024] as const).map(async (width) => {
    const height = Math.round(width / targetAspect);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("canvas_unavailable");
    context.drawImage(
      source.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      width,
      height
    );
    return { width, height, blob: await canvasBlob(canvas) };
  }));
}

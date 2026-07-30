export const photoFrameGalleryStatuses = ["pending", "approved", "rejected"] as const;
export type PhotoFrameGalleryStatus = (typeof photoFrameGalleryStatuses)[number];

export type PhotoFrameGalleryDesign = {
  label: string;
  photoTransform: { zoom: number; offsetX: number; offsetY: number; rotation: number };
  stickerText: string;
  stickerStyle: { tone: "ivory" | "rose" | "sage"; font: "serif" | "hand" | "sans" };
  stickerTransform: { x: number; y: number; scale: number; rotation: number };
};

export type PhotoFrameGallerySubmissionInput = {
  contributorName: string;
  design: PhotoFrameGalleryDesign;
};

export type PhotoFrameGalleryItem = PhotoFrameGallerySubmissionInput & {
  id: string;
  status: PhotoFrameGalleryStatus;
  createdAt: string;
  reviewedAt: string | null;
};

export type PhotoFrameGalleryPublicResult = {
  items: PhotoFrameGalleryItem[];
  generatedAt: string;
};

export type PhotoFrameGalleryAdminResult = PhotoFrameGalleryPublicResult & {
  counts: Record<PhotoFrameGalleryStatus, number>;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function text(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length >= 1 && normalized.length <= maximum ? normalized : null;
}

function finite(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
    ? Math.round(value * 100) / 100
    : null;
}

export function parsePhotoFrameGalleryDesign(value: unknown): PhotoFrameGalleryDesign | null {
  const input = record(value);
  const photo = record(input?.photoTransform);
  const stickerStyle = record(input?.stickerStyle);
  const sticker = record(input?.stickerTransform);
  const label = text(input?.label, 24);
  const stickerText = typeof input?.stickerText === "string"
    ? input.stickerText.replace(/\s+/g, " ").trim().slice(0, 24)
    : null;
  const zoom = finite(photo?.zoom, 1, 1.6);
  const offsetX = finite(photo?.offsetX, -1, 1);
  const offsetY = finite(photo?.offsetY, -1, 1);
  const photoRotation = finite(photo?.rotation, -12, 12);
  const stickerX = finite(sticker?.x, 0.08, 0.92);
  const stickerY = finite(sticker?.y, 0.08, 0.92);
  const stickerScale = finite(sticker?.scale, 0.7, 1.5);
  const stickerRotation = finite(sticker?.rotation, -30, 30);
  const tone = stickerStyle?.tone;
  const font = stickerStyle?.font;
  if (
    !label
    || stickerText === null
    || zoom === null
    || offsetX === null
    || offsetY === null
    || photoRotation === null
    || stickerX === null
    || stickerY === null
    || stickerScale === null
    || stickerRotation === null
    || !["ivory", "rose", "sage"].includes(tone as string)
    || !["serif", "hand", "sans"].includes(font as string)
  ) return null;
  return {
    label,
    photoTransform: { zoom, offsetX, offsetY, rotation: photoRotation },
    stickerText,
    stickerStyle: {
      tone: tone as PhotoFrameGalleryDesign["stickerStyle"]["tone"],
      font: font as PhotoFrameGalleryDesign["stickerStyle"]["font"]
    },
    stickerTransform: { x: stickerX, y: stickerY, scale: stickerScale, rotation: stickerRotation }
  };
}

export function parsePhotoFrameGallerySubmission(value: unknown): PhotoFrameGallerySubmissionInput | null {
  const input = record(value);
  const contributorName = text(input?.contributorName, 20);
  const design = parsePhotoFrameGalleryDesign(input?.design);
  return contributorName && design ? { contributorName, design } : null;
}

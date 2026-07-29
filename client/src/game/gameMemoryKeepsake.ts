import type { WeddingPhotoAlbum } from "./weddingPhoto";
import type { GameMemoryAlbum } from "./gameMemoryAlbum";
import type { WorldPhotoSpotId } from "./world";

export const gameMemoryKeepsakeOptionsStorageKey = "wedding-game:memory-keepsake-options:v1";
export const gameMemoryKeepsakeTemplatesStorageKey = "wedding-game:memory-keepsake-templates:v1";
export const gameMemoryKeepsakeLayouts = ["classic", "garden", "film"] as const;
export const gameMemoryKeepsakeFrames = ["clean", "rounded", "postage"] as const;
export const gameMemoryKeepsakeStickers = ["heart", "flower", "sparkle", "dove", "ring", "leaf"] as const;
export const gameMemoryKeepsakePrintFormats = ["a4", "postcard"] as const;
export const gameMemoryKeepsakePrintVendors = ["standard-lab", "borderless-lab", "postcard-maker"] as const;
export type GameMemoryKeepsakePrintFormat = (typeof gameMemoryKeepsakePrintFormats)[number];
export type GameMemoryKeepsakePrintVendor = (typeof gameMemoryKeepsakePrintVendors)[number];
export type GameMemoryKeepsakeLayout = (typeof gameMemoryKeepsakeLayouts)[number];
export type GameMemoryKeepsakeFrame = (typeof gameMemoryKeepsakeFrames)[number];
export type GameMemoryKeepsakeSticker = (typeof gameMemoryKeepsakeStickers)[number];
export type GameMemoryPhotoTransform = {
  scale: number;
  x: number;
  y: number;
};
export type GameMemoryStickerTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};
export type GameMemoryTextSticker = GameMemoryStickerTransform & {
  enabled: boolean;
  text: string;
};
export type GameMemoryKeepsakeOptions = {
  layout: GameMemoryKeepsakeLayout;
  frame: GameMemoryKeepsakeFrame;
  stickers: GameMemoryKeepsakeSticker[];
  quality: "standard" | "high";
  message: string;
  photoOrder: WorldPhotoSpotId[];
  photoTransforms: Partial<Record<WorldPhotoSpotId, GameMemoryPhotoTransform>>;
  stickerTransforms: Partial<Record<GameMemoryKeepsakeSticker, GameMemoryStickerTransform>>;
  textSticker: GameMemoryTextSticker;
};

export type GameMemoryKeepsakeTemplate = {
  id: string;
  name: string;
  layout: GameMemoryKeepsakeLayout;
  frame: GameMemoryKeepsakeFrame;
  stickers: GameMemoryKeepsakeSticker[];
  stickerTransforms: Partial<Record<GameMemoryKeepsakeSticker, GameMemoryStickerTransform>>;
  textSticker: GameMemoryTextSticker;
  quality: "standard" | "high";
  message: string;
};

type OptionsStorage = Pick<Storage, "getItem" | "setItem">;

export const defaultGameMemoryKeepsakeOptions: GameMemoryKeepsakeOptions = {
  layout: "garden",
  frame: "rounded",
  stickers: ["heart", "flower"],
  quality: "high",
  message: "함께 걸어 더 선명해진 결혼식의 하루",
  photoOrder: [],
  photoTransforms: {},
  stickerTransforms: {
    heart: { x: 0.1, y: 0.1, scale: 1, rotation: -8 },
    flower: { x: 0.9, y: 0.1, scale: 1, rotation: 8 },
    sparkle: { x: 0.86, y: 0.35, scale: 1, rotation: 0 },
    dove: { x: 0.12, y: 0.35, scale: 1, rotation: -6 },
    ring: { x: 0.5, y: 0.12, scale: 1, rotation: 0 },
    leaf: { x: 0.88, y: 0.58, scale: 1, rotation: 18 }
  },
  textSticker: { enabled: false, text: "우리의 봄날", x: 0.5, y: 0.68, scale: 1, rotation: 0 }
};

export type GameMemoryKeepsakeData = {
  album: GameMemoryAlbum;
  photoAlbum: WeddingPhotoAlbum;
  guestName: string;
  coupleNames: string;
  dateLabel: string;
  venueLabel: string;
  publicUrl: string;
  collectedCount: number;
  totalCollectibles: number;
  options?: GameMemoryKeepsakeOptions;
};

type KeepsakeEnvironment = {
  createObjectUrl: (blob: Blob) => string;
  clickDownload: (url: string, filename: string) => void;
  revokeObjectUrl: (url: string) => void;
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

export const gameMemoryKeepsakePrintVendorProfiles: Record<GameMemoryKeepsakePrintVendor, {
  label: string;
  note: string;
  marginScale: number;
  safeInsetScale: number;
}> = {
  "standard-lab": { label: "일반 사진관", note: "기본 여백 · 안전영역 3mm", marginScale: 1, safeInsetScale: 1 },
  "borderless-lab": { label: "무테 인화", note: "재단 오차 대비 · 안전영역 5mm", marginScale: 0.72, safeInsetScale: 1.55 },
  "postcard-maker": { label: "엽서 제작소", note: "사방 3mm 재단 여유 · 안전영역 5mm", marginScale: 0.86, safeInsetScale: 1.45 }
};

export function gameMemoryKeepsakePrintLayout(
  format: GameMemoryKeepsakePrintFormat,
  vendor: GameMemoryKeepsakePrintVendor = "standard-lab"
) {
  const base = format === "a4"
    ? { width: 2480, height: 3508, margin: 150, safeInset: 96, label: "A4", pageWidthPoints: 595.28, pageHeightPoints: 841.89 }
    : { width: 1200, height: 1800, margin: 72, safeInset: 54, label: "4×6 엽서", pageWidthPoints: 288, pageHeightPoints: 432 };
  const profile = gameMemoryKeepsakePrintVendorProfiles[vendor];
  return {
    ...base,
    margin: Math.round(base.margin * profile.marginScale),
    safeInset: Math.round(base.safeInset * profile.safeInsetScale),
    vendor
  };
}

export function gameMemoryKeepsakePrintGuide(
  format: GameMemoryKeepsakePrintFormat,
  vendor: GameMemoryKeepsakePrintVendor = "standard-lab"
) {
  const layout = gameMemoryKeepsakePrintLayout(format, vendor);
  const availableWidth = layout.width - layout.margin * 2;
  const availableHeight = layout.height - layout.margin * 2;
  const scale = Math.min(availableWidth / 1080, availableHeight / 1920);
  const width = 1080 * scale;
  const height = 1920 * scale;
  const x = (layout.width - width) / 2;
  const y = (layout.height - height) / 2;
  return {
    trim: { x: x / layout.width, y: y / layout.height, width: width / layout.width, height: height / layout.height },
    safe: {
      x: (x + layout.safeInset) / layout.width,
      y: (y + layout.safeInset) / layout.height,
      width: (width - layout.safeInset * 2) / layout.width,
      height: (height - layout.safeInset * 2) / layout.height
    }
  };
}

export function gameMemoryKeepsakePrintFilename(
  guestName: string,
  format: GameMemoryKeepsakePrintFormat
) {
  return `wedding-garden-memory-${safeName(guestName)}-${format}.png`;
}

export function gameMemoryKeepsakePdfFilename(
  guestName: string,
  format: GameMemoryKeepsakePrintFormat,
  duplex = false
) {
  return `wedding-garden-memory-${safeName(guestName)}-${format}${duplex ? "-duplex" : ""}.pdf`;
}

function safeName(name: string) {
  return name.trim().replace(/[^0-9A-Za-z가-힣_-]+/g, "-").replace(/^-+|-+$/g, "") || "guest";
}

function browserOptionsStorage(): OptionsStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeGameMemoryKeepsakeOptions(value: unknown): GameMemoryKeepsakeOptions {
  if (typeof value !== "object" || value === null) return defaultGameMemoryKeepsakeOptions;
  const candidate = value as Partial<GameMemoryKeepsakeOptions>;
  const layout = gameMemoryKeepsakeLayouts.includes(candidate.layout as GameMemoryKeepsakeLayout)
    ? candidate.layout as GameMemoryKeepsakeLayout
    : defaultGameMemoryKeepsakeOptions.layout;
  const frame = gameMemoryKeepsakeFrames.includes(candidate.frame as GameMemoryKeepsakeFrame)
    ? candidate.frame as GameMemoryKeepsakeFrame
    : defaultGameMemoryKeepsakeOptions.frame;
  const stickers = Array.isArray(candidate.stickers)
    ? [...new Set(candidate.stickers.filter((id): id is GameMemoryKeepsakeSticker => (
      gameMemoryKeepsakeStickers.includes(id as GameMemoryKeepsakeSticker)
    )))].slice(0, 3)
    : defaultGameMemoryKeepsakeOptions.stickers;
  const quality = candidate.quality === "standard" ? "standard" : "high";
  const message = typeof candidate.message === "string"
    ? candidate.message.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 48)
    : defaultGameMemoryKeepsakeOptions.message;
  const photoOrder = Array.isArray(candidate.photoOrder)
    ? [...new Set(candidate.photoOrder.filter((id): id is WorldPhotoSpotId => typeof id === "string"))].slice(0, 3)
    : [];
  const photoTransforms = Object.fromEntries(Object.entries(candidate.photoTransforms ?? {})
    .filter(([id, transform]) => typeof id === "string" && typeof transform === "object" && transform !== null)
    .slice(0, 3)
    .map(([id, transform]) => {
      const candidateTransform = transform as Partial<GameMemoryPhotoTransform>;
      const clamp = (number: unknown, minimum: number, maximum: number, fallback: number) => (
        typeof number === "number" && Number.isFinite(number)
          ? Math.min(maximum, Math.max(minimum, number))
          : fallback
      );
      return [id, {
        scale: Math.round(clamp(candidateTransform.scale, 1, 2.2, 1) * 100) / 100,
        x: Math.round(clamp(candidateTransform.x, -1, 1, 0) * 100) / 100,
        y: Math.round(clamp(candidateTransform.y, -1, 1, 0) * 100) / 100
      }];
    })) as Partial<Record<WorldPhotoSpotId, GameMemoryPhotoTransform>>;
  const stickerTransforms = Object.fromEntries(gameMemoryKeepsakeStickers.map((sticker) => {
    const transform = candidate.stickerTransforms?.[sticker];
    const fallback = defaultGameMemoryKeepsakeOptions.stickerTransforms[sticker]!;
    const clamp = (number: unknown, minimum: number, maximum: number, fallbackValue: number) => (
      typeof number === "number" && Number.isFinite(number)
        ? Math.min(maximum, Math.max(minimum, number))
        : fallbackValue
    );
    return [sticker, {
      x: Math.round(clamp(transform?.x, 0.04, 0.96, fallback.x) * 100) / 100,
      y: Math.round(clamp(transform?.y, 0.04, 0.96, fallback.y) * 100) / 100,
      scale: Math.round(clamp(transform?.scale, 0.65, 1.8, fallback.scale) * 100) / 100,
      rotation: Math.round(clamp(transform?.rotation, -180, 180, fallback.rotation))
    }];
  })) as Partial<Record<GameMemoryKeepsakeSticker, GameMemoryStickerTransform>>;
  const candidateTextSticker = candidate.textSticker as Partial<GameMemoryTextSticker> | undefined;
  const textStickerFallback = defaultGameMemoryKeepsakeOptions.textSticker;
  const clampTextSticker = (number: unknown, minimum: number, maximum: number, fallbackValue: number) => (
    typeof number === "number" && Number.isFinite(number)
      ? Math.min(maximum, Math.max(minimum, number))
      : fallbackValue
  );
  const textSticker: GameMemoryTextSticker = {
    enabled: candidateTextSticker?.enabled === true,
    text: typeof candidateTextSticker?.text === "string"
      ? candidateTextSticker.text.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 18) || textStickerFallback.text
      : textStickerFallback.text,
    x: Math.round(clampTextSticker(candidateTextSticker?.x, 0.08, 0.92, textStickerFallback.x) * 100) / 100,
    y: Math.round(clampTextSticker(candidateTextSticker?.y, 0.08, 0.92, textStickerFallback.y) * 100) / 100,
    scale: Math.round(clampTextSticker(candidateTextSticker?.scale, 0.65, 1.8, textStickerFallback.scale) * 100) / 100,
    rotation: Math.round(clampTextSticker(candidateTextSticker?.rotation, -45, 45, textStickerFallback.rotation))
  };
  return {
    layout,
    frame,
    stickers,
    quality,
    message: message || defaultGameMemoryKeepsakeOptions.message,
    photoOrder,
    photoTransforms,
    stickerTransforms,
    textSticker
  };
}

function normalizeKeepsakeTemplate(value: unknown): GameMemoryKeepsakeTemplate | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<GameMemoryKeepsakeTemplate>;
  if (typeof candidate.id !== "string" || !/^[a-z0-9-]{3,48}$/.test(candidate.id)) return null;
  const name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, 18) : "";
  if (!name) return null;
  const normalized = normalizeGameMemoryKeepsakeOptions(candidate);
  return {
    id: candidate.id,
    name,
    layout: normalized.layout,
    frame: normalized.frame,
    stickers: normalized.stickers,
    stickerTransforms: normalized.stickerTransforms,
    textSticker: normalized.textSticker,
    quality: normalized.quality,
    message: normalized.message
  };
}

export function loadGameMemoryKeepsakeTemplates(
  storage: OptionsStorage | null = browserOptionsStorage()
): GameMemoryKeepsakeTemplate[] {
  try {
    const parsed = JSON.parse(storage?.getItem(gameMemoryKeepsakeTemplatesStorageKey) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeKeepsakeTemplate)
      .filter((template): template is GameMemoryKeepsakeTemplate => template !== null)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export function saveGameMemoryKeepsakeTemplates(
  templates: readonly GameMemoryKeepsakeTemplate[],
  storage: OptionsStorage | null = browserOptionsStorage()
) {
  try {
    const normalized = templates.map(normalizeKeepsakeTemplate)
      .filter((template): template is GameMemoryKeepsakeTemplate => template !== null)
      .slice(0, 3);
    storage?.setItem(gameMemoryKeepsakeTemplatesStorageKey, JSON.stringify(normalized));
    return storage !== null;
  } catch {
    return false;
  }
}

export function createGameMemoryKeepsakeTemplate(
  options: GameMemoryKeepsakeOptions,
  index: number,
  id = `template-${Date.now().toString(36)}`
): GameMemoryKeepsakeTemplate {
  const normalized = normalizeGameMemoryKeepsakeOptions(options);
  return {
    id: id.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48),
    name: `내 템플릿 ${Math.min(3, Math.max(1, index + 1))}`,
    layout: normalized.layout,
    frame: normalized.frame,
    stickers: normalized.stickers,
    stickerTransforms: normalized.stickerTransforms,
    textSticker: normalized.textSticker,
    quality: normalized.quality,
    message: normalized.message
  };
}

export function applyGameMemoryKeepsakeTemplate(
  current: GameMemoryKeepsakeOptions,
  template: GameMemoryKeepsakeTemplate
): GameMemoryKeepsakeOptions {
  return normalizeGameMemoryKeepsakeOptions({
    ...current,
    ...template,
    photoOrder: current.photoOrder,
    photoTransforms: current.photoTransforms
  });
}

export function loadGameMemoryKeepsakeOptions(
  storage: OptionsStorage | null = browserOptionsStorage()
): GameMemoryKeepsakeOptions {
  try {
    const stored = storage?.getItem(gameMemoryKeepsakeOptionsStorageKey);
    return stored ? normalizeGameMemoryKeepsakeOptions(JSON.parse(stored)) : defaultGameMemoryKeepsakeOptions;
  } catch {
    return defaultGameMemoryKeepsakeOptions;
  }
}

export function saveGameMemoryKeepsakeOptions(
  options: GameMemoryKeepsakeOptions,
  storage: OptionsStorage | null = browserOptionsStorage()
) {
  try {
    storage?.setItem(
      gameMemoryKeepsakeOptionsStorageKey,
      JSON.stringify(normalizeGameMemoryKeepsakeOptions(options))
    );
    return storage !== null;
  } catch {
    return false;
  }
}

export function orderGameMemoryKeepsakePhotos(
  album: WeddingPhotoAlbum,
  order: readonly WorldPhotoSpotId[]
) {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...album.photos].sort((left, right) => (
    (rank.get(left.photoSpotId) ?? Number.MAX_SAFE_INTEGER)
    - (rank.get(right.photoSpotId) ?? Number.MAX_SAFE_INTEGER)
  ));
}

export function gameMemoryKeepsakeFilename(guestName: string) {
  return `wedding-garden-memory-${safeName(guestName)}.png`;
}

function browserEnvironment(): KeepsakeEnvironment {
  return {
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    clickDownload: (url, filename) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    },
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    share: typeof navigator.share === "function" ? navigator.share.bind(navigator) : undefined,
    canShare: typeof navigator.canShare === "function" ? navigator.canShare.bind(navigator) : undefined
  };
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(null), 5_000);
    image.onload = () => { window.clearTimeout(timer); resolve(image); };
    image.onerror = () => { window.clearTimeout(timer); resolve(null); };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (
    blob ? resolve(blob) : reject(new Error("추억 이미지를 만들지 못했습니다."))
  ), "image/png"));
}

function canvasJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (
    blob ? resolve(blob) : reject(new Error("PDF 이미지를 만들지 못했습니다."))
  ), "image/jpeg", 0.94));
}

function drawPhotoFrame(
  context: CanvasRenderingContext2D,
  frame: GameMemoryKeepsakeFrame,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
) {
  if (frame === "clean") return;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = frame === "rounded" ? 7 : 5;
  if (frame === "postage") context.setLineDash([14, 10]);
  if (frame === "rounded") {
    context.beginPath();
    context.roundRect(x, y, width, height, 20);
    context.stroke();
  } else {
    context.strokeRect(x, y, width, height);
  }
  context.restore();
}

function drawKeepsakeSticker(
  context: CanvasRenderingContext2D,
  sticker: GameMemoryKeepsakeSticker,
  x: number,
  y: number,
  color: string,
  transform: Pick<GameMemoryStickerTransform, "scale" | "rotation"> = { scale: 1, rotation: 0 }
) {
  context.save();
  context.translate(x, y);
  context.rotate(transform.rotation * Math.PI / 180);
  context.scale(transform.scale, transform.scale);
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = 5;
  if (sticker === "heart") {
    context.beginPath();
    context.moveTo(0, 18);
    context.bezierCurveTo(-48, -16, -20, -48, 0, -20);
    context.bezierCurveTo(20, -48, 48, -16, 0, 18);
    context.fill();
  } else if (sticker === "flower") {
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3;
      context.beginPath();
      context.arc(Math.cos(angle) * 19, Math.sin(angle) * 19, 12, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = "#fff7db";
    context.beginPath();
    context.arc(0, 0, 9, 0, Math.PI * 2);
    context.fill();
  } else if (sticker === "sparkle") {
    context.beginPath();
    context.moveTo(0, -30);
    context.lineTo(8, -8);
    context.lineTo(30, 0);
    context.lineTo(8, 8);
    context.lineTo(0, 30);
    context.lineTo(-8, 8);
    context.lineTo(-30, 0);
    context.lineTo(-8, -8);
    context.closePath();
    context.fill();
  } else if (sticker === "dove") {
    context.beginPath();
    context.moveTo(-30, 4);
    context.quadraticCurveTo(-8, -30, 2, -4);
    context.quadraticCurveTo(20, -24, 32, -12);
    context.quadraticCurveTo(18, -2, 10, 14);
    context.quadraticCurveTo(-8, 23, -30, 4);
    context.fill();
    context.beginPath();
    context.moveTo(24, -12);
    context.lineTo(42, -7);
    context.lineTo(25, -2);
    context.closePath();
    context.fill();
  } else if (sticker === "ring") {
    context.lineWidth = 9;
    context.beginPath();
    context.arc(0, 4, 24, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(-10, -18);
    context.lineTo(0, -34);
    context.lineTo(10, -18);
    context.closePath();
    context.fill();
  } else {
    context.beginPath();
    context.ellipse(0, 0, 13, 34, Math.PI / 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.72)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-16, 17);
    context.lineTo(17, -17);
    context.stroke();
  }
  context.restore();
}

function drawKeepsakeTextSticker(
  context: CanvasRenderingContext2D,
  sticker: GameMemoryTextSticker,
  color: string,
  cardColor: string
) {
  if (!sticker.enabled || !sticker.text) return;
  context.save();
  context.translate(sticker.x * 1080, sticker.y * 1920);
  context.rotate(sticker.rotation * Math.PI / 180);
  context.scale(sticker.scale, sticker.scale);
  context.font = "900 27px serif";
  const width = Math.min(420, Math.max(150, context.measureText(sticker.text).width + 58));
  context.fillStyle = cardColor;
  context.strokeStyle = color;
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(-width / 2, -28, width, 56, 22);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(sticker.text, 0, 1, width - 34);
  context.restore();
}

function drawCroppedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  transform: GameMemoryPhotoTransform = { scale: 1, x: 0, y: 0 }
) {
  const destinationRatio = width / height;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const baseWidth = imageRatio > destinationRatio ? image.naturalHeight * destinationRatio : image.naturalWidth;
  const baseHeight = imageRatio > destinationRatio ? image.naturalHeight : image.naturalWidth / destinationRatio;
  const sourceWidth = baseWidth / transform.scale;
  const sourceHeight = baseHeight / transform.scale;
  const maxOffsetX = Math.max(0, (image.naturalWidth - sourceWidth) / 2);
  const maxOffsetY = Math.max(0, (image.naturalHeight - sourceHeight) / 2);
  const sourceX = (image.naturalWidth - sourceWidth) / 2 + transform.x * maxOffsetX;
  const sourceY = (image.naturalHeight - sourceHeight) / 2 + transform.y * maxOffsetY;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

export async function createGameMemoryKeepsake(data: GameMemoryKeepsakeData): Promise<Blob> {
  const options = normalizeGameMemoryKeepsakeOptions(data.options);
  const palette = options.layout === "film"
    ? { background: "#252523", top: "#c9a56d", bottom: "#8f5f68", ink: "#fffaf0", accent: "#e9bd76", card: "#f7f0e5", soft: "#393936", muted: "#d4c8b8" }
    : options.layout === "classic"
      ? { background: "#fffaf3", top: "#9e6974", bottom: "#657e6a", ink: "#493a36", accent: "#9e6974", card: "#ffffff", soft: "#f2e7e3", muted: "#755e55" }
      : { background: "#f8f3e8", top: "#6f8f76", bottom: "#bd727f", ink: "#4a3935", accent: "#a35f6d", card: "#fffdf7", soft: "#edf4e8", muted: "#755e55" };
  const canvas = document.createElement("canvas");
  const outputScale = options.quality === "high" ? 2 : 1;
  canvas.width = 1080 * outputScale;
  canvas.height = 1920 * outputScale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이 브라우저에서는 추억 이미지를 만들 수 없습니다.");
  context.scale(outputScale, outputScale);

  context.fillStyle = palette.background;
  context.fillRect(0, 0, 1080, 1920);
  context.fillStyle = palette.top;
  context.fillRect(0, 0, 1080, 34);
  context.fillStyle = palette.bottom;
  context.fillRect(0, 1886, 1080, 34);
  context.textAlign = "center";
  context.fillStyle = palette.ink;
  context.font = "900 62px serif";
  context.fillText(data.coupleNames, 540, 125);
  context.fillStyle = palette.accent;
  context.font = "900 24px sans-serif";
  context.fillText("WEDDING GARDEN MEMORY", 540, 175);

  const photos = orderGameMemoryKeepsakePhotos(data.photoAlbum, options.photoOrder).slice(0, 3);
  const images = await Promise.all(photos.map(({ dataUrl }) => loadImage(dataUrl)));
  for (let index = 0; index < 3; index += 1) {
    const x = 72 + index * 324;
    context.fillStyle = palette.card;
    context.fillRect(x, 230, 288, 410);
    const image = images[index];
    if (image) drawCroppedImage(
      context,
      image,
      x + 12,
      242,
      264,
      330,
      photos[index] ? options.photoTransforms[photos[index]!.photoSpotId] : undefined
    );
    else {
      context.fillStyle = options.layout === "film" ? "#5c5751" : "#e9dfd3";
      context.fillRect(x + 12, 242, 264, 330);
      context.fillStyle = palette.muted;
      context.font = "800 24px sans-serif";
      context.fillText("PHOTO", x + 144, 420);
    }
    context.fillStyle = options.layout === "film" ? "#4a3935" : palette.ink;
    context.font = "800 21px sans-serif";
    context.fillText(photos[index]?.spotLabel ?? `추억 자리 ${index + 1}`, x + 144, 610);
    drawPhotoFrame(context, options.frame, x + 12, 242, 264, 330, palette.accent);
  }

  options.stickers.forEach((sticker) => {
    const transform = options.stickerTransforms[sticker]
      ?? defaultGameMemoryKeepsakeOptions.stickerTransforms[sticker]!;
    drawKeepsakeSticker(
      context,
      sticker,
      transform.x * 1080,
      transform.y * 1920,
      palette.accent,
      transform
    );
  });
  drawKeepsakeTextSticker(context, options.textSticker, palette.accent, palette.card);

  const companionCount = data.album.entries.filter(({ kind }) => kind === "companion").length;
  const celebrationCount = data.album.entries.filter(({ kind }) => kind === "celebration").length;
  const stats = [
    [`${data.collectedCount}/${data.totalCollectibles}`, "축하 아이템"],
    [`${photos.length}/3`, "포토존 사진"],
    [String(companionCount), "동행 기록"],
    [String(celebrationCount), "협동 축하"]
  ];
  stats.forEach(([value, label], index) => {
    const x = 72 + index * 237;
    context.fillStyle = index % 2 === 0 ? palette.soft : palette.card;
    context.fillRect(x, 700, 210, 132);
    context.fillStyle = options.layout === "film" ? "#4e403c" : palette.ink;
    context.font = "900 38px sans-serif";
    context.fillText(value!, x + 105, 756);
    context.fillStyle = options.layout === "film" ? "#7c6861" : palette.muted;
    context.font = "800 20px sans-serif";
    context.fillText(label!, x + 105, 795);
  });

  context.textAlign = "left";
  context.fillStyle = palette.ink;
  context.font = "900 34px serif";
  context.fillText(`${data.guestName}님의 기억의 조각`, 74, 925);
  data.album.entries.slice(0, 6).forEach((entry, index) => {
    const y = 990 + index * 112;
    context.fillStyle = index % 2 === 0 ? palette.card : palette.soft;
    context.fillRect(72, y - 42, 936, 92);
    context.fillStyle = palette.accent;
    context.font = "900 22px sans-serif";
    context.fillText(entry.title, 100, y - 5);
    context.fillStyle = options.layout === "film" ? "#4f4540" : palette.muted;
    context.font = "700 18px sans-serif";
    context.fillText(entry.detail.slice(0, 58), 100, y + 27);
  });

  context.textAlign = "center";
  context.fillStyle = palette.ink;
  context.font = "900 30px serif";
  context.fillText(options.message, 540, 1740);
  context.fillStyle = palette.muted;
  context.font = "800 22px sans-serif";
  context.fillText(`${data.dateLabel} · ${data.venueLabel}`, 540, 1790);
  return canvasBlob(canvas);
}

async function createGameMemoryKeepsakePrintCanvas(
  data: GameMemoryKeepsakeData,
  format: GameMemoryKeepsakePrintFormat,
  vendor: GameMemoryKeepsakePrintVendor = "standard-lab"
): Promise<HTMLCanvasElement> {
  const sourceBlob = await createGameMemoryKeepsake({
    ...data,
    options: { ...normalizeGameMemoryKeepsakeOptions(data.options), quality: "high" }
  });
  const sourceUrl = URL.createObjectURL(sourceBlob);
  try {
    const image = await loadImage(sourceUrl);
    if (!image) throw new Error("인쇄용 이미지를 불러오지 못했습니다.");
    const layout = gameMemoryKeepsakePrintLayout(format, vendor);
    const canvas = document.createElement("canvas");
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이 브라우저에서는 인쇄용 이미지를 만들 수 없습니다.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, layout.width, layout.height);
    const availableWidth = layout.width - layout.margin * 2;
    const availableHeight = layout.height - layout.margin * 2;
    const scale = Math.min(availableWidth / image.naturalWidth, availableHeight / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const x = (layout.width - drawWidth) / 2;
    const y = (layout.height - drawHeight) / 2;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.shadowColor = "rgba(45, 38, 34, 0.16)";
    context.shadowBlur = Math.max(14, layout.margin * 0.12);
    context.drawImage(image, x, y, drawWidth, drawHeight);
    context.shadowColor = "transparent";
    context.strokeStyle = "rgba(89, 70, 62, 0.28)";
    context.lineWidth = Math.max(2, layout.width / 1000);
    context.strokeRect(x, y, drawWidth, drawHeight);
    const mark = Math.max(24, layout.margin * 0.34);
    const gap = Math.max(8, layout.margin * 0.07);
    context.strokeStyle = "#2f2f2f";
    context.lineWidth = Math.max(2, layout.width / 1200);
    [
      [x - gap - mark, y, x - gap, y], [x, y - gap - mark, x, y - gap],
      [x + drawWidth + gap, y, x + drawWidth + gap + mark, y], [x + drawWidth, y - gap - mark, x + drawWidth, y - gap],
      [x - gap - mark, y + drawHeight, x - gap, y + drawHeight], [x, y + drawHeight + gap, x, y + drawHeight + gap + mark],
      [x + drawWidth + gap, y + drawHeight, x + drawWidth + gap + mark, y + drawHeight], [x + drawWidth, y + drawHeight + gap, x + drawWidth, y + drawHeight + gap + mark]
    ].forEach(([fromX, fromY, toX, toY]) => {
      context.beginPath();
      context.moveTo(fromX!, fromY!);
      context.lineTo(toX!, toY!);
      context.stroke();
    });
    return canvas;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export async function createGameMemoryKeepsakePrint(
  data: GameMemoryKeepsakeData,
  format: GameMemoryKeepsakePrintFormat,
  vendor: GameMemoryKeepsakePrintVendor = "standard-lab"
): Promise<Blob> {
  return canvasBlob(await createGameMemoryKeepsakePrintCanvas(data, format, vendor));
}

function createGameMemoryKeepsakePostcardBackCanvas(
  data: GameMemoryKeepsakeData,
  vendor: GameMemoryKeepsakePrintVendor
) {
  const layout = gameMemoryKeepsakePrintLayout("postcard", vendor);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이 브라우저에서는 엽서 뒷면을 만들 수 없습니다.");
  const inset = layout.margin + layout.safeInset;
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, layout.width, layout.height);
  context.fillStyle = "#6f8f76";
  context.fillRect(0, 0, layout.width, 24);
  context.fillStyle = "#bd727f";
  context.fillRect(0, layout.height - 24, layout.width, 24);
  context.strokeStyle = "#d6ccc2";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(layout.width * 0.52, inset);
  context.lineTo(layout.width * 0.52, layout.height - inset);
  context.stroke();

  context.textAlign = "left";
  context.fillStyle = "#4a3935";
  context.font = "900 42px serif";
  context.fillText(data.coupleNames, inset, inset + 54);
  context.fillStyle = "#9e6974";
  context.font = "900 20px sans-serif";
  context.fillText("WEDDING GARDEN POSTCARD", inset, inset + 94);
  context.fillStyle = "#655951";
  context.font = "700 25px sans-serif";
  wrapCanvasText(context, normalizeGameMemoryKeepsakeOptions(data.options).message, inset, inset + 180, layout.width * 0.38, 42, 5);
  context.font = "800 21px sans-serif";
  context.fillText(data.dateLabel, inset, layout.height - inset - 68);
  context.fillText(data.venueLabel, inset, layout.height - inset - 30);

  const rightX = layout.width * 0.59;
  const lineEnd = layout.width - inset;
  context.strokeStyle = "#b9afa7";
  context.lineWidth = 2;
  for (let index = 0; index < 5; index += 1) {
    const y = layout.height * 0.43 + index * 92;
    context.beginPath();
    context.moveTo(rightX, y);
    context.lineTo(lineEnd, y);
    context.stroke();
  }
  context.strokeStyle = "#9e6974";
  context.lineWidth = 3;
  context.strokeRect(layout.width - inset - 150, inset, 150, 190);
  context.fillStyle = "#9e6974";
  context.textAlign = "center";
  context.font = "800 18px sans-serif";
  context.fillText("STAMP", layout.width - inset - 75, inset + 102);
  return canvas;
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const characters = [...text];
  let line = "";
  let lineIndex = 0;
  for (const character of characters) {
    const candidate = `${line}${character}`;
    if (line && context.measureText(candidate).width > maxWidth) {
      context.fillText(line, x, y + lineIndex * lineHeight);
      lineIndex += 1;
      if (lineIndex >= maxLines) return;
      line = character;
    } else {
      line = candidate;
    }
  }
  if (line && lineIndex < maxLines) context.fillText(line, x, y + lineIndex * lineHeight);
}

function concatBytes(parts: readonly Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

const pdfText = (value: string) => new TextEncoder().encode(value);

export function createSingleImagePdf(
  jpegBytes: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  pageWidth: number,
  pageHeight: number
) {
  return createImagePagesPdf([{ jpegBytes, imageWidth, imageHeight, pageWidth, pageHeight }]);
}

export function createImagePagesPdf(pages: readonly {
  jpegBytes: Uint8Array;
  imageWidth: number;
  imageHeight: number;
  pageWidth: number;
  pageHeight: number;
}[]) {
  if (pages.length === 0) throw new Error("PDF에는 한 페이지 이상 필요합니다.");
  const pageObjectNumbers = pages.map((_, index) => 3 + index * 3);
  const objects: Uint8Array[] = [
    pdfText("<< /Type /Catalog /Pages 2 0 R >>"),
    pdfText(`<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pages.length} >>`)
  ];
  pages.forEach((page, index) => {
    const pageObjectNumber = pageObjectNumbers[index]!;
    const imageObjectNumber = pageObjectNumber + 1;
    const contentObjectNumber = pageObjectNumber + 2;
    const content = pdfText(`q\n${page.pageWidth} 0 0 ${page.pageHeight} 0 0 cm\n/Im0 Do\nQ\n`);
    objects.push(
      pdfText(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.pageWidth} ${page.pageHeight}] /Resources << /XObject << /Im0 ${imageObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`),
      concatBytes([
        pdfText(`<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`),
        page.jpegBytes,
        pdfText("\nendstream")
      ]),
      concatBytes([pdfText(`<< /Length ${content.length} >>\nstream\n`), content, pdfText("endstream")])
    );
  });
  const parts: Uint8Array[] = [pdfText("%PDF-1.4\n%WGM\n")];
  const offsets = [0];
  let byteOffset = parts[0]!.length;
  objects.forEach((object, index) => {
    offsets.push(byteOffset);
    const wrapped = concatBytes([
      pdfText(`${index + 1} 0 obj\n`),
      object,
      pdfText("\nendobj\n")
    ]);
    parts.push(wrapped);
    byteOffset += wrapped.length;
  });
  const xrefOffset = byteOffset;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "]
    .concat(offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `))
    .join("\n");
  parts.push(pdfText(`${xref}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`));
  const pdfBytes = concatBytes(parts);
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

export async function createGameMemoryKeepsakePdf(
  data: GameMemoryKeepsakeData,
  format: GameMemoryKeepsakePrintFormat,
  options: { vendor?: GameMemoryKeepsakePrintVendor; duplex?: boolean } = {}
) {
  const vendor = options.vendor ?? "standard-lab";
  const layout = gameMemoryKeepsakePrintLayout(format, vendor);
  const frontCanvas = await createGameMemoryKeepsakePrintCanvas(data, format, vendor);
  const pages = [{
    jpegBytes: new Uint8Array(await (await canvasJpegBlob(frontCanvas)).arrayBuffer()),
    imageWidth: layout.width,
    imageHeight: layout.height,
    pageWidth: layout.pageWidthPoints,
    pageHeight: layout.pageHeightPoints
  }];
  if (format === "postcard" && options.duplex) {
    const backCanvas = createGameMemoryKeepsakePostcardBackCanvas(data, vendor);
    pages.push({
      jpegBytes: new Uint8Array(await (await canvasJpegBlob(backCanvas)).arrayBuffer()),
      imageWidth: layout.width,
      imageHeight: layout.height,
      pageWidth: layout.pageWidthPoints,
      pageHeight: layout.pageHeightPoints
    });
  }
  return createImagePagesPdf(pages);
}

export function saveGameMemoryKeepsakePrint(
  blob: Blob,
  guestName: string,
  format: GameMemoryKeepsakePrintFormat,
  environment: KeepsakeEnvironment = browserEnvironment()
) {
  const url = environment.createObjectUrl(blob);
  try {
    environment.clickDownload(url, gameMemoryKeepsakePrintFilename(guestName, format));
  } finally {
    environment.revokeObjectUrl(url);
  }
}

export function saveGameMemoryKeepsakePdf(
  blob: Blob,
  guestName: string,
  format: GameMemoryKeepsakePrintFormat,
  environment: KeepsakeEnvironment = browserEnvironment(),
  duplex = false
) {
  const url = environment.createObjectUrl(blob);
  try {
    environment.clickDownload(url, gameMemoryKeepsakePdfFilename(guestName, format, duplex));
  } finally {
    environment.revokeObjectUrl(url);
  }
}

export function saveGameMemoryKeepsake(
  blob: Blob,
  guestName: string,
  environment: KeepsakeEnvironment = browserEnvironment()
) {
  const url = environment.createObjectUrl(blob);
  try {
    environment.clickDownload(url, gameMemoryKeepsakeFilename(guestName));
  } finally {
    environment.revokeObjectUrl(url);
  }
}

export async function shareGameMemoryKeepsake(
  blob: Blob,
  data: GameMemoryKeepsakeData,
  environment: KeepsakeEnvironment = browserEnvironment()
): Promise<"shared" | "saved"> {
  const file = new File([blob], gameMemoryKeepsakeFilename(data.guestName), { type: "image/png" });
  const shareData: ShareData = {
    files: [file],
    title: `${data.coupleNames} 웨딩 가든 추억`,
    text: `${data.guestName}님이 정원에서 만든 수집·동행·축하 기록이에요.`,
    url: data.publicUrl
  };
  if (environment.share && (!environment.canShare || environment.canShare(shareData))) {
    await environment.share(shareData);
    return "shared";
  }
  saveGameMemoryKeepsake(blob, data.guestName, environment);
  return "saved";
}

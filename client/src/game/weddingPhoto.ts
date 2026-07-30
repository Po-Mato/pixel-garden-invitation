import {
  type CharacterAppearance
} from "@wedding-game/shared";
import { resolveCharacterPortraitUrl } from "../character/assets";
import {
  defaultCelebrationFrame,
  type CelebrationFrameSelection
} from "./celebrationFrame";
import type { CelebrationCosmeticId, CelebrationCosmeticTone } from "./celebrationReward";
import { resolveWorldMapAsset } from "./worldVisuals";
import type { WorldPhotoPose, WorldPhotoSpot, WorldPhotoSpotId } from "./world";
import { normalizePhotoStickerText, resolveCoverCrop, type PhotoFrameTransform } from "./photoFrameEditor";

export type WeddingPhotoData = {
  guestName: string;
  appearance: CharacterAppearance;
  coupleNames: string;
  dateLabel: string;
  venueLabel: string;
  publicUrl: string;
  pose: WorldPhotoPose;
  spot: WorldPhotoSpot;
  companions?: readonly {
    guestName: string;
    appearance: CharacterAppearance;
  }[];
  celebrationFrame?: CelebrationFrameSelection | boolean;
  photoCosmetic?: {
    cosmeticId: CelebrationCosmeticId;
    tone: CelebrationCosmeticTone;
  };
};

export type WeddingPhotoMemory = {
  version: 1;
  dataUrl: string;
  photoSpotId: WorldPhotoSpotId;
  zoneId: WorldPhotoSpot["zoneId"];
  spotLabel: string;
  guestName: string;
  pose: WorldPhotoPose;
  createdAt: number;
};

export type WeddingPhotoAlbum = {
  version: 2;
  photos: WeddingPhotoMemory[];
};

export type WeddingPhotoStripData = {
  album: WeddingPhotoAlbum;
  coupleNames: string;
  guestName: string;
  dateLabel: string;
  venueLabel: string;
  publicUrl: string;
  theme?: WeddingPhotoStripTheme;
  photoOrder?: readonly WorldPhotoSpotId[];
  photoTransforms?: Partial<Record<WorldPhotoSpotId, PhotoFrameTransform>>;
  stickerText?: string;
};

export type WeddingPhotoStripTheme = "garden" | "rose" | "night";

export const weddingPhotoStripThemeLabels: Record<WeddingPhotoStripTheme, string> = {
  garden: "정원",
  rose: "로즈",
  night: "나이트"
};

export type WeddingPhotoCapture = {
  blob: Blob;
  memory: WeddingPhotoMemory;
};

export type WeddingPhotoNpcKind = "bride" | "groom";

type PhotoDownloadEnvironment = {
  createObjectUrl: (blob: Blob) => string;
  clickDownload: (url: string, filename: string) => void;
  revokeObjectUrl: (url: string) => void;
};

type PhotoShareEnvironment = PhotoDownloadEnvironment & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

export const weddingPhotoMemoryStorageKey = "wedding-game:photo-memory:v1";
export const weddingPhotoAlbumStorageKey = "wedding-game:photo-album:v2";
export const weddingPhotoSpotOrder = [
  "lobby-photo-wall",
  "bridal-flower-wall",
  "ceremony-aisle"
] as const satisfies readonly WorldPhotoSpotId[];

export function normalizeWeddingPhotoStripOrder(order?: readonly WorldPhotoSpotId[]): WorldPhotoSpotId[] {
  const valid = new Set<WorldPhotoSpotId>(weddingPhotoSpotOrder);
  const result = Array.from(new Set((order ?? []).filter((spotId) => valid.has(spotId))));
  weddingPhotoSpotOrder.forEach((spotId) => { if (!result.includes(spotId)) result.push(spotId); });
  return result;
}
export const weddingPhotoWidth = 1080;
export const weddingPhotoHeight = 1350;
export const weddingPhotoStripWidth = 1080;
export const weddingPhotoStripHeight = 2160;

const sceneHeight = 1030;
const spriteFrameWidth = 96;
const spriteFrameHeight = 144;

export const weddingPhotoNpcFrames = {
  bride: {
    file: "bride__walk.png",
    x: spriteFrameWidth,
    y: 0
  },
  groom: {
    file: "groom__idle.png",
    x: 0,
    y: 0
  }
} as const satisfies Record<WeddingPhotoNpcKind, { file: string; x: number; y: number }>;

type SpriteImage = HTMLImageElement | HTMLCanvasElement;

export type SpriteOpaqueBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type PhotoCosmeticAnchors = {
  head: Point2D;
  chest: Point2D;
  feet: Point2D;
  visible: { left: number; top: number; right: number; bottom: number; width: number; height: number };
};

type Point2D = { x: number; y: number };

const weddingPhotoNpcSpriteCache = new Map<string, Promise<HTMLCanvasElement | null>>();

export function detectOpaqueSpriteBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 8
): SpriteOpaqueBounds | null {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) return null;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= alphaThreshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  return {
    left,
    top,
    right: right + 1,
    bottom: bottom + 1,
    width: right - left + 1,
    height: bottom - top + 1
  };
}

export function resolvePhotoCosmeticAnchors(
  bounds: SpriteOpaqueBounds,
  sourceWidth: number,
  sourceHeight: number,
  centerX: number,
  floorY: number,
  destinationWidth: number,
  destinationHeight: number
): PhotoCosmeticAnchors {
  const destinationLeft = centerX - destinationWidth / 2;
  const destinationTop = floorY - destinationHeight;
  const scaleX = destinationWidth / Math.max(1, sourceWidth);
  const scaleY = destinationHeight / Math.max(1, sourceHeight);
  const visible = {
    left: destinationLeft + bounds.left * scaleX,
    top: destinationTop + bounds.top * scaleY,
    right: destinationLeft + bounds.right * scaleX,
    bottom: destinationTop + bounds.bottom * scaleY,
    width: bounds.width * scaleX,
    height: bounds.height * scaleY
  };
  const visibleCenterX = (visible.left + visible.right) / 2;
  return {
    head: { x: visibleCenterX, y: visible.top + visible.height * 0.18 },
    chest: { x: visibleCenterX, y: visible.top + visible.height * 0.49 },
    feet: { x: visibleCenterX, y: visible.bottom },
    visible
  };
}

function photoCosmeticAnchorsForSprite(
  image: SpriteImage | null,
  centerX: number,
  floorY: number,
  destinationWidth: number,
  destinationHeight: number
) {
  const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : image?.width ?? 1;
  const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : image?.height ?? 1;
  let bounds: SpriteOpaqueBounds | null = null;
  if (image) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
        bounds = detectOpaqueSpriteBounds(context.getImageData(0, 0, sourceWidth, sourceHeight).data, sourceWidth, sourceHeight);
      }
    } catch {
      // The full image box remains a safe fallback when a browser blocks pixel reads.
    }
  }
  return resolvePhotoCosmeticAnchors(
    bounds ?? { left: 0, top: 0, right: sourceWidth, bottom: sourceHeight, width: sourceWidth, height: sourceHeight },
    sourceWidth,
    sourceHeight,
    centerX,
    floorY,
    destinationWidth,
    destinationHeight
  );
}

const browserDownloadEnvironment: PhotoDownloadEnvironment = {
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
  revokeObjectUrl: (url) => URL.revokeObjectURL(url)
};

function browserShareEnvironment(): PhotoShareEnvironment {
  return {
    ...browserDownloadEnvironment,
    share: typeof navigator.share === "function" ? navigator.share.bind(navigator) : undefined,
    canShare: typeof navigator.canShare === "function" ? navigator.canShare.bind(navigator) : undefined
  };
}

function resolveAssetUrl(path: string) {
  if (/^(?:https?:|data:|blob:)/.test(path)) return path;
  return new URL(path, document.baseURI).href;
}

function loadImage(url: string, timeoutMs = 6000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    image.decoding = "async";
    image.crossOrigin = "anonymous";
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = resolveAssetUrl(url);
  });
}

function isLightNeutralPixel(data: Uint8ClampedArray, offset: number) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  return alpha > 8 && (red + green + blue) / 3 >= 130 && brightest - darkest <= 34;
}

export function removeGroomLegBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number
) {
  const startY = Math.floor(height * 0.5);
  const seedY = Math.max(startY, height - 18);
  const eligible = new Uint8Array(width * height);
  const queued = new Uint8Array(width * height);
  const queue: number[] = [];

  for (let y = startY; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (isLightNeutralPixel(data, pixel * 4)) eligible[pixel] = 1;
    }
  }

  for (let y = seedY; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (!eligible[pixel]) continue;
      let touchesTransparency = false;
      for (let offsetY = -1; offsetY <= 1 && !touchesTransparency; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (
            nextX < 0
            || nextX >= width
            || nextY < 0
            || nextY >= height
            || data[(nextY * width + nextX) * 4 + 3] <= 8
          ) {
            touchesTransparency = true;
            break;
          }
        }
      }
      if (touchesTransparency) {
        queue.push(pixel);
        queued[pixel] = 1;
      }
    }
  }

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const pixel = queue[queueIndex];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    data[pixel * 4 + 3] = 0;

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextX >= width || nextY < startY || nextY >= height) continue;
        const nextPixel = nextY * width + nextX;
        if (eligible[nextPixel] && !queued[nextPixel]) {
          queued[nextPixel] = 1;
          queue.push(nextPixel);
        }
      }
    }
  }

  return queue.length;
}

async function loadWeddingPhotoNpcSprite(
  kind: WeddingPhotoNpcKind,
  baseUrl = import.meta.env.BASE_URL
): Promise<HTMLCanvasElement | null> {
  const cacheKey = `${baseUrl}:${kind}`;
  const cached = weddingPhotoNpcSpriteCache.get(cacheKey);
  if (cached) return cached;

  const pending = (async () => {
    const portrait = await loadImage(`${baseUrl}characters/puppets/${kind}/preview.webp`);
    if (portrait) {
      const canvas = document.createElement("canvas");
      canvas.width = portrait.naturalWidth;
      canvas.height = portrait.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.imageSmoothingEnabled = true;
      context.drawImage(portrait, 0, 0);
      return canvas;
    }

    const frame = weddingPhotoNpcFrames[kind];
    const image = await loadImage(`${baseUrl}characters/generated/npc/${frame.file}`);
    if (!image) return null;

    const canvas = document.createElement("canvas");
    canvas.width = spriteFrameWidth;
    canvas.height = spriteFrameHeight;
    const context = canvas.getContext("2d", { willReadFrequently: kind === "groom" });
    if (!context) return null;
    context.imageSmoothingEnabled = false;
    context.drawImage(
      image,
      frame.x,
      frame.y,
      spriteFrameWidth,
      spriteFrameHeight,
      0,
      0,
      spriteFrameWidth,
      spriteFrameHeight
    );

    if (kind === "groom") {
      const imageData = context.getImageData(0, 0, spriteFrameWidth, spriteFrameHeight);
      removeGroomLegBackground(imageData.data, spriteFrameWidth, spriteFrameHeight);
      context.putImageData(imageData, 0, 0);
    }
    return canvas;
  })();

  weddingPhotoNpcSpriteCache.set(cacheKey, pending);
  return pending;
}

export async function createWeddingPhotoNpcPreviewUrl(kind: WeddingPhotoNpcKind) {
  const sprite = await loadWeddingPhotoNpcSprite(kind);
  return sprite?.toDataURL("image/png") ?? null;
}

function drawHeart(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  context.save();
  context.translate(x, y);
  context.scale(size / 32, size / 32);
  context.beginPath();
  context.moveTo(0, 9);
  context.bezierCurveTo(-24, -6, -14, -27, 0, -14);
  context.bezierCurveTo(14, -27, 24, -6, 0, 9);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function drawPhotoFallback(context: CanvasRenderingContext2D, spot: WorldPhotoSpot) {
  const gradient = context.createLinearGradient(0, 0, 0, sceneHeight);
  gradient.addColorStop(0, spot.zoneId === "ceremony-hall" ? "#617b69" : "#f4d9d4");
  gradient.addColorStop(0.6, "#f6e6c6");
  gradient.addColorStop(1, "#8ca98e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, weddingPhotoWidth, sceneHeight);
}

function drawBackground(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  spot: WorldPhotoSpot
) {
  if (!image) {
    drawPhotoFallback(context, spot);
    return;
  }
  const crop = spot.backgroundCrop;
  context.imageSmoothingEnabled = false;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    weddingPhotoWidth,
    sceneHeight
  );
  context.imageSmoothingEnabled = true;
}

function drawSprite(
  context: CanvasRenderingContext2D,
  image: SpriteImage | null,
  centerX: number,
  floorY: number,
  width: number,
  height: number,
  smooth = true
) {
  context.save();
  context.fillStyle = "rgba(47, 37, 34, 0.23)";
  context.beginPath();
  context.ellipse(centerX, floorY - 8, width * 0.32, 22, 0, 0, Math.PI * 2);
  context.fill();

  if (image) {
    const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
    context.imageSmoothingEnabled = smooth;
    context.drawImage(
      image,
      0,
      0,
      sourceWidth,
      sourceHeight,
      centerX - width / 2,
      floorY - height,
      width,
      height
    );
  } else {
    context.fillStyle = "#f1c5b5";
    context.beginPath();
    context.arc(centerX, floorY - height + width * 0.28, width * 0.26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#8a6571";
    context.fillRect(centerX - width * 0.28, floorY - height * 0.58, width * 0.56, height * 0.58);
  }
  context.restore();
}

function drawPoseEffect(context: CanvasRenderingContext2D, pose: WorldPhotoPose, guestX: number, guestTop: number) {
  if (pose === "wave") {
    context.strokeStyle = "rgba(255, 248, 205, 0.96)";
    context.lineWidth = 9;
    context.lineCap = "round";
    for (let index = 0; index < 3; index += 1) {
      context.beginPath();
      context.arc(guestX + 96, guestTop + 86, 40 + index * 22, -1.2, -0.38);
      context.stroke();
    }
    return;
  }

  if (pose === "flower-heart") {
    const colors = ["#fff5c4", "#e98b9e", "#f0b955", "#88aa91"];
    for (let index = 0; index < 24; index += 1) {
      const angle = (Math.PI * 2 * index) / 24;
      const x = 16 * Math.pow(Math.sin(angle), 3);
      const y = -(13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle));
      context.fillStyle = colors[index % colors.length];
      context.beginPath();
      context.arc(guestX + x * 9, guestTop + 112 + y * 8, 11, 0, Math.PI * 2);
      context.fill();
    }
    return;
  }

  [
    [guestX - 140, guestTop + 60, 42],
    [guestX + 126, guestTop + 108, 34],
    [guestX + 86, guestTop - 24, 26],
    [guestX - 92, guestTop + 170, 22]
  ].forEach(([x, y, size], index) => {
    drawHeart(context, x, y, size, index % 2 === 0 ? "rgba(237, 137, 154, 0.92)" : "rgba(255, 239, 183, 0.94)");
  });
}

function drawSceneFrame(context: CanvasRenderingContext2D, data: WeddingPhotoData) {
  const petalColors = ["rgba(255,248,205,.92)", "rgba(235,142,157,.84)", "rgba(139,174,146,.82)"];
  for (let index = 0; index < 32; index += 1) {
    const x = 26 + ((index * 157) % 1030);
    const y = 40 + ((index * 89) % 870);
    context.save();
    context.translate(x, y);
    context.rotate((index % 7) * 0.31);
    context.fillStyle = petalColors[index % petalColors.length];
    context.fillRect(-5, -10, 10, 20);
    context.restore();
  }

  const shade = context.createLinearGradient(0, 0, 0, sceneHeight);
  shade.addColorStop(0, "rgba(43, 35, 39, 0.08)");
  shade.addColorStop(0.72, "rgba(43, 35, 39, 0.04)");
  shade.addColorStop(1, "rgba(43, 35, 39, 0.34)");
  context.fillStyle = shade;
  context.fillRect(0, 0, weddingPhotoWidth, sceneHeight);

  context.strokeStyle = "rgba(255, 249, 217, 0.92)";
  context.lineWidth = 12;
  context.strokeRect(30, 30, weddingPhotoWidth - 60, sceneHeight - 60);
  context.strokeStyle = "rgba(119, 83, 84, 0.72)";
  context.lineWidth = 3;
  context.strokeRect(45, 45, weddingPhotoWidth - 90, sceneHeight - 90);

  context.textAlign = "center";
  context.fillStyle = "#fff9de";
  context.font = "900 27px sans-serif";
  context.fillText("WEDDING GARDEN PHOTO", weddingPhotoWidth / 2, 92);
  context.font = "800 38px sans-serif";
  context.fillText(data.spot.sceneLabel, weddingPhotoWidth / 2, 144);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("기념 사진을 만들지 못했습니다."));
    }, "image/png");
  });
}

function createMemoryPreview(canvas: HTMLCanvasElement): string {
  const preview = document.createElement("canvas");
  preview.width = 720;
  preview.height = 900;
  const context = preview.getContext("2d");
  if (!context) return "";
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(canvas, 0, 0, preview.width, preview.height);
  return preview.toDataURL("image/jpeg", 0.92);
}

export function weddingPhotoFilename(guestName: string, spotId: WorldPhotoSpotId): string {
  const safeName = safeGuestName(guestName);
  return `wedding-photo-${spotId}-${safeName || "guest"}.png`;
}

function safeGuestName(guestName: string) {
  return guestName.trim().replace(/[^0-9A-Za-z가-힣_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function drawCelebrationFrame(
  context: CanvasRenderingContext2D,
  selection: CelebrationFrameSelection | true
) {
  const frame = selection === true ? defaultCelebrationFrame : selection;
  const palettes = {
    garden: { outer: "rgba(224, 239, 196, 0.96)", inner: "rgba(92, 132, 96, 0.92)", accent: "#d98fa2", detail: "#f4d786" },
    rose: { outer: "rgba(255, 221, 229, 0.96)", inner: "rgba(164, 76, 103, 0.92)", accent: "#c35f82", detail: "#f0bdc9" },
    starlight: { outer: "rgba(225, 232, 255, 0.96)", inner: "rgba(74, 84, 135, 0.92)", accent: "#727fcb", detail: "#f1d575" },
    "wedding-day": { outer: "rgba(255, 241, 181, 0.98)", inner: "rgba(184, 125, 52, 0.96)", accent: "#d49b42", detail: "#fff1ad" }
  } as const;
  const colors = palettes[frame.palette];
  context.save();
  context.strokeStyle = colors.outer;
  context.lineWidth = 18;
  context.strokeRect(28, 28, weddingPhotoWidth - 56, weddingPhotoHeight - 56);
  context.strokeStyle = colors.inner;
  context.lineWidth = 6;
  context.strokeRect(45, 45, weddingPhotoWidth - 90, weddingPhotoHeight - 90);

  const corners = [[64, 64], [weddingPhotoWidth - 64, 64], [64, weddingPhotoHeight - 64], [weddingPhotoWidth - 64, weddingPhotoHeight - 64]];
  corners.forEach(([x, y], cornerIndex) => {
    context.save();
    context.translate(x, y);
    context.rotate(cornerIndex * Math.PI / 2);
    if (frame.decoration === "flowers") {
      for (let petal = 0; petal < 6; petal += 1) {
        context.save();
        context.rotate((Math.PI * 2 * petal) / 6);
        context.fillStyle = petal % 2 === 0 ? colors.accent : colors.detail;
        context.beginPath();
        context.ellipse(0, -23, 10, 24, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    } else if (frame.decoration === "ribbons") {
      context.fillStyle = colors.accent;
      context.rotate(-Math.PI / 4);
      context.fillRect(-12, -36, 24, 72);
      context.rotate(Math.PI / 2);
      context.fillRect(-12, -36, 24, 72);
    } else {
      for (let star = 0; star < 8; star += 1) {
        context.save();
        context.rotate((Math.PI * 2 * star) / 8);
        context.fillStyle = star % 2 === 0 ? colors.accent : colors.detail;
        context.fillRect(-6, -34, 12, 12);
        context.restore();
      }
    }
    context.fillStyle = colors.detail;
    context.beginPath();
    context.arc(0, 0, 10, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
  context.restore();
}

function drawPhotoCosmetic(
  context: CanvasRenderingContext2D,
  selection: NonNullable<WeddingPhotoData["photoCosmetic"]>,
  anchors: PhotoCosmeticAnchors
) {
  if (selection.cosmeticId === "none") return;
  const palettes = {
    rose: { accent: "#d87891", soft: "rgba(255, 221, 230, 0.8)", glow: "rgba(225, 132, 159, 0.5)" },
    gold: { accent: "#d1a249", soft: "rgba(255, 239, 183, 0.82)", glow: "rgba(227, 184, 84, 0.5)" },
    sage: { accent: "#6f9877", soft: "rgba(222, 242, 215, 0.82)", glow: "rgba(105, 157, 115, 0.46)" }
  } as const;
  const colors = palettes[selection.tone];
  const showPetals = selection.cosmeticId === "petal-trail" || selection.cosmeticId === "garden-blessing-set";
  const showRibbon = selection.cosmeticId === "ribbon-tag" || selection.cosmeticId === "garden-blessing-set";
  const showStars = selection.cosmeticId === "starlight-aura" || selection.cosmeticId === "garden-blessing-set";
  const auraRadiusX = Math.max(54, anchors.visible.width * 0.7);
  const auraRadiusY = Math.max(90, anchors.visible.height * 0.55);
  const auraCenterY = anchors.visible.top + anchors.visible.height * 0.5;
  context.save();
  if (showStars) {
    context.shadowColor = colors.glow;
    context.shadowBlur = 18;
    context.strokeStyle = colors.soft;
    context.lineWidth = 9;
    context.beginPath();
    context.ellipse(anchors.head.x, auraCenterY, auraRadiusX, auraRadiusY, 0, 0, Math.PI * 2);
    context.stroke();
    for (let index = 0; index < 7; index += 1) {
      const angle = index * Math.PI * 2 / 7;
      const x = anchors.head.x + Math.cos(angle) * auraRadiusX * 0.95;
      const y = auraCenterY + Math.sin(angle) * auraRadiusY * 0.94;
      context.fillStyle = index % 2 ? colors.accent : colors.soft;
      context.fillRect(x - 5, y - 14, 10, 28);
      context.fillRect(x - 14, y - 5, 28, 10);
    }
  }
  if (showPetals) {
    context.shadowBlur = 0;
    for (let index = 0; index < 9; index += 1) {
      const angle = index * Math.PI * 2 / 9;
      context.save();
      context.translate(anchors.feet.x + Math.cos(angle) * anchors.visible.width * 0.62, anchors.feet.y - 14 + Math.sin(angle) * 18);
      context.rotate(angle);
      context.fillStyle = index % 2 ? colors.accent : colors.soft;
      context.beginPath();
      context.ellipse(0, 0, 7, 16, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }
  if (showRibbon) {
    const x = anchors.chest.x + anchors.visible.width * 0.38;
    const y = anchors.chest.y;
    context.fillStyle = colors.accent;
    context.beginPath();
    context.ellipse(x - 15, y, 18, 11, -0.45, 0, Math.PI * 2);
    context.ellipse(x + 15, y, 18, 11, 0.45, 0, Math.PI * 2);
    context.fill();
    context.fillRect(x - 6, y - 7, 12, 15);
    context.beginPath();
    context.moveTo(x - 5, y + 7);
    context.lineTo(x - 15, y + 38);
    context.lineTo(x, y + 28);
    context.lineTo(x + 15, y + 38);
    context.lineTo(x + 5, y + 7);
    context.fill();
  }
  context.restore();
}

export function weddingPhotoMemoryFilename(memory: WeddingPhotoMemory): string {
  return `wedding-photo-${memory.photoSpotId}-${safeGuestName(memory.guestName) || "guest"}.jpg`;
}

export function weddingPhotoStripFilename(guestName: string): string {
  return `wedding-photo-strip-${safeGuestName(guestName) || "guest"}.png`;
}

export async function createWeddingPhotoCapture(data: WeddingPhotoData): Promise<WeddingPhotoCapture> {
  const canvas = document.createElement("canvas");
  canvas.width = weddingPhotoWidth;
  canvas.height = weddingPhotoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이 브라우저에서는 기념 사진을 만들 수 없습니다.");

  const baseUrl = import.meta.env.BASE_URL;
  const companions = data.companions?.slice(0, 2) ?? [];
  const [background, guest, bride, groom, ...companionSprites] = await Promise.all([
    loadImage(resolveWorldMapAsset(data.spot.zoneId, "background.webp", baseUrl)),
    loadImage(resolveCharacterPortraitUrl(data.appearance, baseUrl)),
    loadWeddingPhotoNpcSprite("bride", baseUrl),
    data.spot.cast === "couple" ? loadWeddingPhotoNpcSprite("groom", baseUrl) : Promise.resolve(null),
    ...companions.map((companion) => loadImage(resolveCharacterPortraitUrl(companion.appearance, baseUrl)))
  ]);

  drawBackground(context, background, data.spot);
  drawSceneFrame(context, data);

  const floorY = 932;
  let guestX = data.spot.cast === "couple" ? 540 : 660;
  let characterWidth = data.spot.cast === "couple" ? 204 : 232;
  if (companions.length > 0) {
    const cast = data.spot.cast === "couple"
      ? [bride, guest, ...companionSprites, groom]
      : [bride, guest, ...companionSprites];
    characterWidth = Math.min(176, 760 / cast.length);
    const characterHeight = characterWidth * 1.5;
    const gap = cast.length > 1 ? 760 / (cast.length - 1) : 0;
    cast.forEach((sprite, index) => {
      const centerX = 160 + gap * index;
      if (index === 1) guestX = centerX;
      drawSprite(context, sprite, centerX, floorY, characterWidth, characterHeight, index === 0 || index === cast.length - 1 && data.spot.cast === "couple");
    });
  } else {
    const characterHeight = characterWidth * 1.5;
    if (data.spot.cast === "couple") {
      drawSprite(context, bride, 300, floorY, characterWidth, characterHeight);
      drawSprite(context, guest, guestX, floorY, characterWidth, characterHeight, false);
      drawSprite(context, groom, 780, floorY, characterWidth, characterHeight);
    } else {
      drawSprite(context, bride, 400, floorY, characterWidth, characterHeight);
      drawSprite(context, guest, guestX, floorY, characterWidth, characterHeight, false);
    }
  }
  if (data.photoCosmetic) {
    drawPhotoCosmetic(
      context,
      data.photoCosmetic,
      photoCosmeticAnchorsForSprite(guest, guestX, floorY, characterWidth, characterWidth * 1.5)
    );
  }
  drawPoseEffect(context, data.pose, guestX, floorY - characterWidth * 1.5);

  context.fillStyle = "#fff9eb";
  context.fillRect(0, sceneHeight, weddingPhotoWidth, weddingPhotoHeight - sceneHeight);
  context.fillStyle = "#b86f79";
  context.fillRect(0, sceneHeight, weddingPhotoWidth, 10);
  context.textAlign = "center";
  context.fillStyle = "#423431";
  context.font = "900 55px serif";
  context.fillText(data.coupleNames, weddingPhotoWidth / 2, 1128);
  context.fillStyle = "#7b5c55";
  context.font = "800 29px sans-serif";
  context.fillText(
    companions.length > 0
      ? `${data.guestName}님 외 ${companions.length}명과 함께한 ${data.spot.label}`
      : `${data.guestName}님과 함께한 ${data.spot.label}`,
    weddingPhotoWidth / 2,
    1184
  );
  context.font = "700 25px sans-serif";
  context.fillText(`${data.dateLabel} · ${data.venueLabel}`, weddingPhotoWidth / 2, 1234);
  context.strokeStyle = "#d8c5ae";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(150, 1270);
  context.lineTo(weddingPhotoWidth - 150, 1270);
  context.stroke();
  context.fillStyle = "#54735d";
  context.font = "800 23px sans-serif";
  context.fillText("오늘의 축하를 오래 간직할게요", weddingPhotoWidth / 2, 1314);
  if (data.celebrationFrame) drawCelebrationFrame(context, data.celebrationFrame);

  return {
    blob: await canvasToBlob(canvas),
    memory: {
      version: 1,
      dataUrl: createMemoryPreview(canvas),
      photoSpotId: data.spot.id,
      zoneId: data.spot.zoneId,
      spotLabel: data.spot.label,
      guestName: data.guestName,
      pose: data.pose,
      createdAt: Date.now()
    }
  };
}

function isWeddingPhotoMemory(value: unknown): value is WeddingPhotoMemory {
  if (!value || typeof value !== "object") return false;
  const memory = value as Partial<WeddingPhotoMemory>;
  return memory.version === 1
    && typeof memory.dataUrl === "string"
    && memory.dataUrl.startsWith("data:image/")
    && weddingPhotoSpotOrder.some((spotId) => spotId === memory.photoSpotId)
    && typeof memory.zoneId === "string"
    && typeof memory.guestName === "string"
    && typeof memory.spotLabel === "string"
    && typeof memory.pose === "string"
    && typeof memory.createdAt === "number";
}

export function createEmptyWeddingPhotoAlbum(): WeddingPhotoAlbum {
  return { version: 2, photos: [] };
}

export function upsertWeddingPhotoMemory(
  album: WeddingPhotoAlbum,
  memory: WeddingPhotoMemory
): WeddingPhotoAlbum {
  if (!isWeddingPhotoMemory(memory)) return album;
  const bySpot = new Map(album.photos.filter(isWeddingPhotoMemory).map((photo) => [photo.photoSpotId, photo]));
  bySpot.set(memory.photoSpotId, memory);
  return {
    version: 2,
    photos: weddingPhotoSpotOrder.flatMap((spotId) => {
      const photo = bySpot.get(spotId);
      return photo ? [photo] : [];
    })
  };
}

export function weddingPhotoAlbumProgress(album: WeddingPhotoAlbum) {
  return weddingPhotoSpotOrder.filter((spotId) => album.photos.some((photo) => photo.photoSpotId === spotId)).length;
}

export function isWeddingPhotoAlbumComplete(album: WeddingPhotoAlbum) {
  return weddingPhotoAlbumProgress(album) === weddingPhotoSpotOrder.length;
}

function parseWeddingPhotoMemory(raw: string | null): WeddingPhotoMemory | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isWeddingPhotoMemory(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadWeddingPhotoMemory(storage: Storage = localStorage): WeddingPhotoMemory | null {
  const legacy = parseWeddingPhotoMemory(storage.getItem(weddingPhotoMemoryStorageKey));
  if (legacy) return legacy;
  const photos = loadWeddingPhotoAlbum(storage).photos;
  return [...photos].sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
}

export function loadWeddingPhotoAlbum(storage: Storage = localStorage): WeddingPhotoAlbum {
  try {
    const raw = storage.getItem(weddingPhotoAlbumStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WeddingPhotoAlbum>;
      if (parsed.version === 2 && Array.isArray(parsed.photos)) {
        return parsed.photos.reduce(upsertWeddingPhotoMemory, createEmptyWeddingPhotoAlbum());
      }
    }
  } catch {
    // Fall through to the legacy single-photo memory.
  }
  const legacy = parseWeddingPhotoMemory(storage.getItem(weddingPhotoMemoryStorageKey));
  return legacy
    ? upsertWeddingPhotoMemory(createEmptyWeddingPhotoAlbum(), legacy)
    : createEmptyWeddingPhotoAlbum();
}

export function saveWeddingPhotoMemory(memory: WeddingPhotoMemory, storage: Storage = localStorage) {
  if (!isWeddingPhotoMemory(memory)) return false;
  try {
    storage.setItem(weddingPhotoMemoryStorageKey, JSON.stringify(memory));
    storage.setItem(
      weddingPhotoAlbumStorageKey,
      JSON.stringify(upsertWeddingPhotoMemory(loadWeddingPhotoAlbum(storage), memory))
    );
    return true;
  } catch {
    return false;
  }
}

function dataUrlToBlob(dataUrl: string) {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("저장된 사진 형식을 읽을 수 없습니다.");
  const mimeType = match[1];
  const encoded = match[3];
  const binary = match[2] ? atob(encoded) : decodeURIComponent(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

export function saveWeddingPhotoMemoryImage(
  memory: WeddingPhotoMemory,
  environment: PhotoDownloadEnvironment = browserDownloadEnvironment
) {
  const blob = dataUrlToBlob(memory.dataUrl);
  const url = environment.createObjectUrl(blob);
  try {
    environment.clickDownload(url, weddingPhotoMemoryFilename(memory));
  } finally {
    environment.revokeObjectUrl(url);
  }
}

export async function shareWeddingPhotoMemoryImage(
  memory: WeddingPhotoMemory,
  coupleNames: string,
  publicUrl: string,
  environment: PhotoShareEnvironment = browserShareEnvironment()
): Promise<"shared" | "saved"> {
  const blob = dataUrlToBlob(memory.dataUrl);
  const file = new File([blob], weddingPhotoMemoryFilename(memory), { type: blob.type });
  const shareData: ShareData = {
    files: [file],
    title: `${coupleNames} 웨딩 가든 포토앨범`,
    text: `${memory.guestName}님이 ${memory.spotLabel}에서 남긴 기념 사진이에요.`,
    url: publicUrl
  };
  if (environment.share && (!environment.canShare || environment.canShare(shareData))) {
    try {
      await environment.share(shareData);
      return "shared";
    } catch (error) {
      if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") throw error;
    }
  }
  saveWeddingPhotoMemoryImage(memory, environment);
  return "saved";
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  transform?: PhotoFrameTransform
) {
  const crop = resolveCoverCrop({ sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, targetWidth: width, targetHeight: height, transform });
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, x, y, width, height);
}

export async function createWeddingPhotoStrip(data: WeddingPhotoStripData): Promise<Blob> {
  if (!isWeddingPhotoAlbumComplete(data.album)) throw new Error("포토존 세 곳의 사진이 모두 필요합니다.");
  const photos = normalizeWeddingPhotoStripOrder(data.photoOrder).map((spotId) => data.album.photos.find((photo) => photo.photoSpotId === spotId)!);
  const images = await Promise.all(photos.map((photo) => loadImage(photo.dataUrl)));
  if (images.some((image) => !image)) throw new Error("포토앨범 사진을 불러오지 못했습니다.");

  const canvas = document.createElement("canvas");
  canvas.width = weddingPhotoStripWidth;
  canvas.height = weddingPhotoStripHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이 브라우저에서는 포토스트립을 만들 수 없습니다.");

  const theme = data.theme ?? "garden";
  const palette = theme === "rose"
    ? { paper: "#f8e9e8", left: "#9f5c6b", right: "#d3a25c", ink: "#53363d", accent: "#aa5367", closing: "#64795f" }
    : theme === "night"
      ? { paper: "#242b3c", left: "#546f72", right: "#86688e", ink: "#f7eedf", accent: "#e0b86a", closing: "#b9dbc5" }
      : { paper: "#f7f0df", left: "#6f8f76", right: "#bd727f", ink: "#4a3935", accent: "#a35f6d", closing: "#5b7f68" };
  context.fillStyle = palette.paper;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = palette.left;
  context.fillRect(0, 0, 54, canvas.height);
  context.fillStyle = palette.right;
  context.fillRect(canvas.width - 54, 0, 54, canvas.height);
  context.strokeStyle = "#9a765e";
  context.lineWidth = 4;
  context.strokeRect(78, 78, canvas.width - 156, canvas.height - 156);

  context.textAlign = "center";
  context.fillStyle = palette.ink;
  context.font = "900 58px serif";
  context.fillText(data.coupleNames, canvas.width / 2, 150);
  context.fillStyle = palette.accent;
  context.font = "900 24px sans-serif";
  context.fillText("WEDDING GARDEN PHOTO STRIP", canvas.width / 2, 198);

  photos.forEach((photo, index) => {
    const y = 250 + index * 555;
    context.fillStyle = "#fffaf0";
    context.fillRect(108, y - 12, 864, 512);
    drawImageCover(context, images[index]!, 126, y + 6, 828, 438, data.photoTransforms?.[photo.photoSpotId]);
    context.fillStyle = "#574640";
    context.textAlign = "left";
    context.font = "900 25px sans-serif";
    context.fillText(`${index + 1}. ${photo.spotLabel}`, 130, y + 480);
    context.textAlign = "right";
    context.fillStyle = "#8a746a";
    context.font = "800 20px sans-serif";
    context.fillText(photo.guestName, 950, y + 480);
  });

  const stickerText = normalizePhotoStickerText(data.stickerText ?? "");
  if (stickerText) {
    context.textAlign = "center";
    context.font = "900 24px sans-serif";
    const stickerWidth = Math.min(780, context.measureText(stickerText).width + 54);
    context.fillStyle = theme === "night" ? "rgba(246, 225, 171, .94)" : "rgba(255, 248, 224, .96)";
    context.fillRect((canvas.width - stickerWidth) / 2, 211, stickerWidth, 34);
    context.fillStyle = "#714d59";
    context.fillText(stickerText, canvas.width / 2, 237);
  }

  context.textAlign = "center";
  context.fillStyle = palette.ink;
  context.font = "900 34px serif";
  context.fillText(`${data.guestName}님과 함께한 세 장의 축하`, canvas.width / 2, 1940);
  context.fillStyle = "#755e55";
  context.font = "800 25px sans-serif";
  context.fillText(`${data.dateLabel} · ${data.venueLabel}`, canvas.width / 2, 1995);
  context.fillStyle = palette.closing;
  context.font = "900 22px sans-serif";
  context.fillText("우리의 소중한 날을 함께해주셔서 고맙습니다", canvas.width / 2, 2050);

  return canvasToBlob(canvas);
}

export function saveWeddingPhotoStripBlob(
  blob: Blob,
  guestName: string,
  environment: PhotoDownloadEnvironment = browserDownloadEnvironment
) {
  const url = environment.createObjectUrl(blob);
  try {
    environment.clickDownload(url, weddingPhotoStripFilename(guestName));
  } finally {
    environment.revokeObjectUrl(url);
  }
}

export async function shareWeddingPhotoStripBlob(
  blob: Blob,
  data: WeddingPhotoStripData,
  environment: PhotoShareEnvironment = browserShareEnvironment()
): Promise<"shared" | "saved"> {
  const file = new File([blob], weddingPhotoStripFilename(data.guestName), { type: "image/png" });
  const shareData: ShareData = {
    files: [file],
    title: `${data.coupleNames} 웨딩 가든 포토스트립`,
    text: `${data.guestName}님이 웨딩 가든 세 곳에서 남긴 기념 포토스트립이에요.`,
    url: data.publicUrl
  };
  if (environment.share && (!environment.canShare || environment.canShare(shareData))) {
    try {
      await environment.share(shareData);
      return "shared";
    } catch (error) {
      if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") throw error;
    }
  }
  saveWeddingPhotoStripBlob(blob, data.guestName, environment);
  return "saved";
}

export function saveWeddingPhotoBlob(
  blob: Blob,
  data: WeddingPhotoData,
  environment: PhotoDownloadEnvironment = browserDownloadEnvironment
) {
  const url = environment.createObjectUrl(blob);
  try {
    environment.clickDownload(url, weddingPhotoFilename(data.guestName, data.spot.id));
  } finally {
    environment.revokeObjectUrl(url);
  }
}

export async function shareWeddingPhotoBlob(
  blob: Blob,
  data: WeddingPhotoData,
  environment: PhotoShareEnvironment = browserShareEnvironment()
): Promise<"shared" | "saved"> {
  const file = new File([blob], weddingPhotoFilename(data.guestName, data.spot.id), { type: "image/png" });
  const shareData: ShareData = {
    files: [file],
    title: `${data.coupleNames} 웨딩 가든 기념 사진`,
    text: `${data.guestName}님이 ${data.spot.label}에서 축하의 순간을 남겼어요.`,
    url: data.publicUrl
  };
  if (environment.share) {
    try {
      if (!environment.canShare || environment.canShare(shareData)) {
        await environment.share(shareData);
        return "shared";
      }
    } catch (error) {
      if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") throw error;
    }
  }
  saveWeddingPhotoBlob(blob, data, environment);
  return "saved";
}

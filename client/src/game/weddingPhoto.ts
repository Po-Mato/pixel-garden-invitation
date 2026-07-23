import {
  guestPresetFrame,
  resolveGuestPreset,
  type CharacterAppearance
} from "@wedding-game/shared";
import { resolveWorldMapAsset } from "./worldVisuals";
import type { WorldPhotoPose, WorldPhotoSpot, WorldPhotoSpotId } from "./world";

export type WeddingPhotoData = {
  guestName: string;
  appearance: CharacterAppearance;
  coupleNames: string;
  dateLabel: string;
  venueLabel: string;
  publicUrl: string;
  pose: WorldPhotoPose;
  spot: WorldPhotoSpot;
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

export type WeddingPhotoCapture = {
  blob: Blob;
  memory: WeddingPhotoMemory;
};

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
export const weddingPhotoWidth = 1080;
export const weddingPhotoHeight = 1350;

const sceneHeight = 1030;
const spriteFrameWidth = guestPresetFrame.source.width;
const spriteFrameHeight = guestPresetFrame.source.height;

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
  image: HTMLImageElement | null,
  centerX: number,
  floorY: number,
  width: number,
  height: number
) {
  context.save();
  context.fillStyle = "rgba(47, 37, 34, 0.23)";
  context.beginPath();
  context.ellipse(centerX, floorY - 8, width * 0.32, 22, 0, 0, Math.PI * 2);
  context.fill();

  if (image) {
    context.imageSmoothingEnabled = false;
    context.drawImage(
      image,
      0,
      0,
      Math.min(spriteFrameWidth, image.naturalWidth),
      Math.min(spriteFrameHeight, image.naturalHeight),
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
  preview.width = 432;
  preview.height = 540;
  const context = preview.getContext("2d");
  if (!context) return "";
  context.imageSmoothingEnabled = false;
  context.drawImage(canvas, 0, 0, preview.width, preview.height);
  return preview.toDataURL("image/jpeg", 0.84);
}

export function weddingPhotoFilename(guestName: string, spotId: WorldPhotoSpotId): string {
  const safeName = guestName.trim().replace(/[^0-9A-Za-z가-힣_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `wedding-photo-${spotId}-${safeName || "guest"}.png`;
}

export async function createWeddingPhotoCapture(data: WeddingPhotoData): Promise<WeddingPhotoCapture> {
  const canvas = document.createElement("canvas");
  canvas.width = weddingPhotoWidth;
  canvas.height = weddingPhotoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이 브라우저에서는 기념 사진을 만들 수 없습니다.");

  const guestPreset = resolveGuestPreset(data.appearance);
  const baseUrl = import.meta.env.BASE_URL;
  const [background, guest, bride, groom] = await Promise.all([
    loadImage(resolveWorldMapAsset(data.spot.zoneId, "background.webp", baseUrl)),
    loadImage(`${baseUrl}characters/generated/${guestPreset.generated.idle}`),
    loadImage(`${baseUrl}characters/generated/npc/bride__idle.png`),
    data.spot.cast === "couple" ? loadImage(`${baseUrl}characters/generated/npc/groom__idle.png`) : Promise.resolve(null)
  ]);

  drawBackground(context, background, data.spot);
  drawSceneFrame(context, data);

  const floorY = 932;
  const characterWidth = data.spot.cast === "couple" ? 204 : 232;
  const characterHeight = characterWidth * 1.5;
  const guestX = data.spot.cast === "couple" ? 540 : 660;
  if (data.spot.cast === "couple") {
    drawSprite(context, bride, 300, floorY, characterWidth, characterHeight);
    drawSprite(context, guest, guestX, floorY, characterWidth, characterHeight);
    drawSprite(context, groom, 780, floorY, characterWidth, characterHeight);
  } else {
    drawSprite(context, bride, 400, floorY, characterWidth, characterHeight);
    drawSprite(context, guest, guestX, floorY, characterWidth, characterHeight);
  }
  drawPoseEffect(context, data.pose, guestX, floorY - characterHeight);

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
  context.fillText(`${data.guestName}님과 함께한 ${data.spot.label}`, weddingPhotoWidth / 2, 1184);
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

export function saveWeddingPhotoMemory(memory: WeddingPhotoMemory, storage: Storage = localStorage) {
  if (!memory.dataUrl.startsWith("data:image/")) return false;
  try {
    storage.setItem(weddingPhotoMemoryStorageKey, JSON.stringify(memory));
    return true;
  } catch {
    return false;
  }
}

export function loadWeddingPhotoMemory(storage: Storage = localStorage): WeddingPhotoMemory | null {
  try {
    const raw = storage.getItem(weddingPhotoMemoryStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WeddingPhotoMemory>;
    if (
      parsed.version !== 1
      || typeof parsed.dataUrl !== "string"
      || !parsed.dataUrl.startsWith("data:image/")
      || typeof parsed.photoSpotId !== "string"
      || typeof parsed.zoneId !== "string"
      || typeof parsed.guestName !== "string"
      || typeof parsed.spotLabel !== "string"
      || typeof parsed.pose !== "string"
      || typeof parsed.createdAt !== "number"
    ) return null;
    return parsed as WeddingPhotoMemory;
  } catch {
    return null;
  }
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

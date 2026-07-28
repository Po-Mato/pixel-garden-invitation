import type { WeddingPhotoAlbum } from "./weddingPhoto";
import type { GameMemoryAlbum } from "./gameMemoryAlbum";
import type { WorldPhotoSpotId } from "./world";

export const gameMemoryKeepsakeOptionsStorageKey = "wedding-game:memory-keepsake-options:v1";
export const gameMemoryKeepsakeLayouts = ["classic", "garden", "film"] as const;
export type GameMemoryKeepsakeLayout = (typeof gameMemoryKeepsakeLayouts)[number];
export type GameMemoryKeepsakeOptions = {
  layout: GameMemoryKeepsakeLayout;
  message: string;
  photoOrder: WorldPhotoSpotId[];
};

type OptionsStorage = Pick<Storage, "getItem" | "setItem">;

export const defaultGameMemoryKeepsakeOptions: GameMemoryKeepsakeOptions = {
  layout: "garden",
  message: "함께 걸어 더 선명해진 결혼식의 하루",
  photoOrder: []
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
  const message = typeof candidate.message === "string"
    ? candidate.message.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 48)
    : defaultGameMemoryKeepsakeOptions.message;
  const photoOrder = Array.isArray(candidate.photoOrder)
    ? [...new Set(candidate.photoOrder.filter((id): id is WorldPhotoSpotId => typeof id === "string"))].slice(0, 3)
    : [];
  return {
    layout,
    message: message || defaultGameMemoryKeepsakeOptions.message,
    photoOrder
  };
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

export async function createGameMemoryKeepsake(data: GameMemoryKeepsakeData): Promise<Blob> {
  const options = normalizeGameMemoryKeepsakeOptions(data.options);
  const palette = options.layout === "film"
    ? { background: "#252523", top: "#c9a56d", bottom: "#8f5f68", ink: "#fffaf0", accent: "#e9bd76", card: "#f7f0e5", soft: "#393936", muted: "#d4c8b8" }
    : options.layout === "classic"
      ? { background: "#fffaf3", top: "#9e6974", bottom: "#657e6a", ink: "#493a36", accent: "#9e6974", card: "#ffffff", soft: "#f2e7e3", muted: "#755e55" }
      : { background: "#f8f3e8", top: "#6f8f76", bottom: "#bd727f", ink: "#4a3935", accent: "#a35f6d", card: "#fffdf7", soft: "#edf4e8", muted: "#755e55" };
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이 브라우저에서는 추억 이미지를 만들 수 없습니다.");

  context.fillStyle = palette.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = palette.top;
  context.fillRect(0, 0, canvas.width, 34);
  context.fillStyle = palette.bottom;
  context.fillRect(0, canvas.height - 34, canvas.width, 34);
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
    if (image) context.drawImage(image, x + 12, 242, 264, 330);
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
  }

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

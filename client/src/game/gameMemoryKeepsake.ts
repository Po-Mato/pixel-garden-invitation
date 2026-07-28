import type { WeddingPhotoAlbum } from "./weddingPhoto";
import type { GameMemoryAlbum } from "./gameMemoryAlbum";

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
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이 브라우저에서는 추억 이미지를 만들 수 없습니다.");

  context.fillStyle = "#f8f3e8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#6f8f76";
  context.fillRect(0, 0, canvas.width, 34);
  context.fillStyle = "#bd727f";
  context.fillRect(0, canvas.height - 34, canvas.width, 34);
  context.textAlign = "center";
  context.fillStyle = "#4a3935";
  context.font = "900 62px serif";
  context.fillText(data.coupleNames, 540, 125);
  context.fillStyle = "#a35f6d";
  context.font = "900 24px sans-serif";
  context.fillText("WEDDING GARDEN MEMORY", 540, 175);

  const photos = data.photoAlbum.photos.slice(0, 3);
  const images = await Promise.all(photos.map(({ dataUrl }) => loadImage(dataUrl)));
  for (let index = 0; index < 3; index += 1) {
    const x = 72 + index * 324;
    context.fillStyle = "#fffdf7";
    context.fillRect(x, 230, 288, 410);
    const image = images[index];
    if (image) context.drawImage(image, x + 12, 242, 264, 330);
    else {
      context.fillStyle = "#e9dfd3";
      context.fillRect(x + 12, 242, 264, 330);
      context.fillStyle = "#8b7770";
      context.font = "800 24px sans-serif";
      context.fillText("PHOTO", x + 144, 420);
    }
    context.fillStyle = "#574640";
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
    context.fillStyle = index % 2 === 0 ? "#edf4e8" : "#fff1f2";
    context.fillRect(x, 700, 210, 132);
    context.fillStyle = "#4e403c";
    context.font = "900 38px sans-serif";
    context.fillText(value!, x + 105, 756);
    context.fillStyle = "#7c6861";
    context.font = "800 20px sans-serif";
    context.fillText(label!, x + 105, 795);
  });

  context.textAlign = "left";
  context.fillStyle = "#4a3935";
  context.font = "900 34px serif";
  context.fillText(`${data.guestName}님의 기억의 조각`, 74, 925);
  data.album.entries.slice(0, 6).forEach((entry, index) => {
    const y = 990 + index * 112;
    context.fillStyle = index % 2 === 0 ? "#fffdf8" : "#f0eadf";
    context.fillRect(72, y - 42, 936, 92);
    context.fillStyle = "#a35f6d";
    context.font = "900 22px sans-serif";
    context.fillText(entry.title, 100, y - 5);
    context.fillStyle = "#705f58";
    context.font = "700 18px sans-serif";
    context.fillText(entry.detail.slice(0, 58), 100, y + 27);
  });

  context.textAlign = "center";
  context.fillStyle = "#4a3935";
  context.font = "900 30px serif";
  context.fillText("함께 걸어 더 선명해진 결혼식의 하루", 540, 1740);
  context.fillStyle = "#755e55";
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

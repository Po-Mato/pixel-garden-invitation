export type JourneyKeepsakeData = {
  guestName: string;
  coupleNames: string;
  dateLabel: string;
  timeLabel: string;
  venueLabel: string;
  checkpointLabels: readonly string[];
  photoUrl: string;
  publicUrl: string;
};

export type JourneyKeepsakeShareResult = "shared" | "saved";

type KeepsakeDownloadEnvironment = {
  createObjectUrl: (blob: Blob) => string;
  clickDownload: (url: string, filename: string) => void;
  revokeObjectUrl: (url: string) => void;
};

type KeepsakeShareEnvironment = KeepsakeDownloadEnvironment & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

const cardWidth = 1080;
const cardHeight = 1350;

const browserDownloadEnvironment: KeepsakeDownloadEnvironment = {
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

function browserShareEnvironment(): KeepsakeShareEnvironment {
  return {
    ...browserDownloadEnvironment,
    share: typeof navigator.share === "function" ? navigator.share.bind(navigator) : undefined,
    canShare: typeof navigator.canShare === "function" ? navigator.canShare.bind(navigator) : undefined
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function loadImage(url: string, timeoutMs = 5000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    const finish = (result: HTMLImageElement | null) => {
      window.clearTimeout(timer);
      resolve(result);
    };
    image.decoding = "async";
    image.crossOrigin = "anonymous";
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = url;
  });
}

function drawFallbackGarden(context: CanvasRenderingContext2D) {
  const sky = context.createLinearGradient(0, 0, 0, 620);
  sky.addColorStop(0, "#fff1d4");
  sky.addColorStop(0.48, "#f5c7bd");
  sky.addColorStop(1, "#95b79a");
  context.fillStyle = sky;
  context.fillRect(0, 0, cardWidth, 620);

  context.fillStyle = "rgba(255, 255, 238, 0.86)";
  context.beginPath();
  context.arc(540, 410, 240, Math.PI, 0);
  context.lineTo(780, 620);
  context.lineTo(300, 620);
  context.closePath();
  context.fill();

  const flowerColors = ["#d87886", "#f2bd69", "#e99b9c", "#8fb69b"];
  for (let index = 0; index < 46; index += 1) {
    const x = 24 + ((index * 97) % 1030);
    const y = 430 + ((index * 53) % 170);
    context.fillStyle = flowerColors[index % flowerColors.length];
    context.fillRect(x, y, 14, 14);
    context.fillStyle = "#fff7d8";
    context.fillRect(x + 5, y + 5, 4, 4);
  }
}

function drawStamp(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  index: number,
  label: string
) {
  const colors = ["#bd6673", "#d69b4f", "#67947d", "#6384a5", "#94719b"];
  context.save();
  context.translate(centerX, centerY);
  context.rotate((index % 2 === 0 ? -1 : 1) * 0.045);
  context.strokeStyle = colors[index % colors.length];
  context.lineWidth = 7;
  context.setLineDash([8, 7]);
  context.beginPath();
  context.arc(0, 0, 58, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#fffaf0";
  context.beginPath();
  context.arc(0, 0, 45, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = colors[index % colors.length];
  context.font = "900 34px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("✓", 0, -2);
  context.font = "800 19px sans-serif";
  context.fillText(label.replace("웨딩 ", "").slice(0, 6), 0, 79);
  context.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("기념 카드 이미지를 만들지 못했습니다."));
    }, "image/png");
  });
}

export function journeyKeepsakeFilename(guestName: string): string {
  const safeName = guestName.trim().replace(/[^0-9A-Za-z가-힣_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `wedding-garden-${safeName || "guest"}.png`;
}

export async function createJourneyKeepsakeBlob(data: JourneyKeepsakeData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = cardWidth;
  canvas.height = cardHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이 브라우저에서는 기념 카드를 만들 수 없습니다.");

  context.fillStyle = "#f7f0df";
  context.fillRect(0, 0, cardWidth, cardHeight);
  const photo = await loadImage(data.photoUrl);
  if (photo) drawCoverImage(context, photo, 0, 0, cardWidth, 620);
  else drawFallbackGarden(context);

  const shade = context.createLinearGradient(0, 110, 0, 620);
  shade.addColorStop(0, "rgba(45, 37, 34, 0.06)");
  shade.addColorStop(1, "rgba(45, 37, 34, 0.66)");
  context.fillStyle = shade;
  context.fillRect(0, 0, cardWidth, 620);

  context.textAlign = "center";
  context.fillStyle = "#fff9e9";
  context.font = "800 28px sans-serif";
  context.fillText("WEDDING GARDEN JOURNEY", cardWidth / 2, 74);
  context.font = "700 31px sans-serif";
  context.fillText(`${data.guestName}님의 축하 여정`, cardWidth / 2, 520);
  context.font = "900 68px serif";
  context.fillText(data.coupleNames, cardWidth / 2, 582);

  roundedRect(context, 48, 582, cardWidth - 96, 710, 30);
  context.fillStyle = "#fffaf0";
  context.fill();
  context.strokeStyle = "#73544e";
  context.lineWidth = 5;
  context.stroke();

  context.fillStyle = "#a75c68";
  context.font = "900 24px sans-serif";
  context.fillText("TRAIL COMPLETE · 5 / 5", cardWidth / 2, 666);
  context.fillStyle = "#3f3430";
  context.font = "900 48px serif";
  context.fillText("두 사람의 모든 순간을 만났어요", cardWidth / 2, 731);

  const stampGap = 178;
  const stampStart = cardWidth / 2 - stampGap * 2;
  data.checkpointLabels.slice(0, 5).forEach((label, index) => {
    drawStamp(context, stampStart + stampGap * index, 855, index, label);
  });

  context.strokeStyle = "#d9c9b3";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(105, 1007);
  context.lineTo(cardWidth - 105, 1007);
  context.stroke();

  context.fillStyle = "#3f3430";
  context.font = "900 37px sans-serif";
  context.fillText(data.dateLabel, cardWidth / 2, 1072);
  context.fillStyle = "#725a52";
  context.font = "700 29px sans-serif";
  context.fillText(data.timeLabel, cardWidth / 2, 1121);
  context.font = "800 31px sans-serif";
  context.fillText(data.venueLabel, cardWidth / 2, 1182);

  context.fillStyle = "#56745f";
  context.font = "800 24px sans-serif";
  context.fillText("함께 걸어주셔서 고맙습니다", cardWidth / 2, 1250);

  return canvasToBlob(canvas);
}

export async function saveJourneyKeepsake(
  data: JourneyKeepsakeData,
  environment: KeepsakeDownloadEnvironment = browserDownloadEnvironment,
  createBlob: (data: JourneyKeepsakeData) => Promise<Blob> = createJourneyKeepsakeBlob
): Promise<void> {
  const blob = await createBlob(data);
  const url = environment.createObjectUrl(blob);
  try {
    environment.clickDownload(url, journeyKeepsakeFilename(data.guestName));
  } finally {
    environment.revokeObjectUrl(url);
  }
}

export async function shareJourneyKeepsake(
  data: JourneyKeepsakeData,
  environment: KeepsakeShareEnvironment = browserShareEnvironment(),
  createBlob: (data: JourneyKeepsakeData) => Promise<Blob> = createJourneyKeepsakeBlob
): Promise<JourneyKeepsakeShareResult> {
  const blob = await createBlob(data);
  const file = new File([blob], journeyKeepsakeFilename(data.guestName), { type: "image/png" });
  const shareData: ShareData = {
    files: [file],
    title: `${data.coupleNames} 결혼식 여정 카드`,
    text: `${data.guestName}님이 두 사람의 축하 여정을 완주했어요.`,
    url: data.publicUrl
  };

  if (environment.share) {
    try {
      if (!environment.canShare || environment.canShare(shareData)) {
        await environment.share(shareData);
        return "shared";
      }
    } catch (error) {
      if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") {
        throw error;
      }
    }
  }

  const url = environment.createObjectUrl(blob);
  try {
    environment.clickDownload(url, journeyKeepsakeFilename(data.guestName));
  } finally {
    environment.revokeObjectUrl(url);
  }
  return "saved";
}

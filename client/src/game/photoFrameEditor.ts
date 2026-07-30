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
export type PhotoStickerTransform = { x: number; y: number; scale: number; rotation: number };

export type PhotoCompositionTemplate = {
  id: string;
  label: string;
  photoTransform: PhotoFrameTransform;
  stickerText: string;
  stickerStyle: PhotoStickerStyle;
  stickerTransform: PhotoStickerTransform;
  custom?: boolean;
};

export const defaultPhotoStickerStyle: PhotoStickerStyle = { tone: "ivory", font: "serif" };
export const defaultPhotoStickerTransform: PhotoStickerTransform = { x: 0.5, y: 0.34, scale: 1, rotation: 0 };
export const photoStickerToneLabels: Record<PhotoStickerTone, string> = { ivory: "아이보리", rose: "로즈", sage: "세이지" };
export const photoStickerFontLabels: Record<PhotoStickerFont, string> = { serif: "명조", hand: "손글씨", sans: "고딕" };

export const builtInPhotoCompositionTemplates: readonly PhotoCompositionTemplate[] = [
  {
    id: "classic",
    label: "클래식",
    photoTransform: { zoom: 1.08, offsetX: 0, offsetY: -0.12, rotation: 0 },
    stickerText: "우리의 봄날",
    stickerStyle: { tone: "ivory", font: "serif" },
    stickerTransform: { x: 0.5, y: 0.34, scale: 1, rotation: 0 }
  },
  {
    id: "garden-note",
    label: "정원 편지",
    photoTransform: { zoom: 1.2, offsetX: -0.08, offsetY: -0.2, rotation: -2 },
    stickerText: "정원에서 만난 오늘",
    stickerStyle: { tone: "sage", font: "hand" },
    stickerTransform: { x: 0.3, y: 0.72, scale: 1.08, rotation: -6 }
  },
  {
    id: "celebration",
    label: "축하 리본",
    photoTransform: { zoom: 1.25, offsetX: 0.1, offsetY: -0.08, rotation: 2 },
    stickerText: "오래 행복하세요",
    stickerStyle: { tone: "rose", font: "sans" },
    stickerTransform: { x: 0.7, y: 0.2, scale: 0.92, rotation: 5 }
  }
] as const;

export const photoCompositionTemplateStorageKey = "wedding-game:photo-composition-templates:v1";
export const photoCompositionTemplateShareParam = "wedding-frame";

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

export function normalizePhotoStickerTransform(value?: Partial<PhotoStickerTransform> | null): PhotoStickerTransform {
  return {
    x: Math.round(clamp(value?.x ?? defaultPhotoStickerTransform.x, 0.08, 0.92) * 100) / 100,
    y: Math.round(clamp(value?.y ?? defaultPhotoStickerTransform.y, 0.08, 0.92) * 100) / 100,
    scale: Math.round(clamp(value?.scale ?? defaultPhotoStickerTransform.scale, 0.7, 1.5) * 100) / 100,
    rotation: Math.round(clamp(value?.rotation ?? defaultPhotoStickerTransform.rotation, -30, 30))
  };
}

function normalizePhotoCompositionTemplate(value: unknown): PhotoCompositionTemplate | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<PhotoCompositionTemplate>;
  if (typeof candidate.id !== "string" || !/^[a-z0-9-]{3,48}$/.test(candidate.id)) return null;
  const label = typeof candidate.label === "string" ? candidate.label.trim().slice(0, 16) : "";
  if (!label) return null;
  return {
    id: candidate.id,
    label,
    photoTransform: normalizePhotoFrameTransform(candidate.photoTransform),
    stickerText: normalizePhotoStickerText(typeof candidate.stickerText === "string" ? candidate.stickerText : ""),
    stickerStyle: normalizePhotoStickerStyle(candidate.stickerStyle),
    stickerTransform: normalizePhotoStickerTransform(candidate.stickerTransform),
    custom: candidate.custom === true
  };
}

type TemplateStorage = Pick<Storage, "getItem" | "setItem">;

function browserTemplateStorage(): TemplateStorage | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

export function loadPhotoCompositionTemplates(storage: TemplateStorage | null = browserTemplateStorage()) {
  try {
    const value = JSON.parse(storage?.getItem(photoCompositionTemplateStorageKey) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.map(normalizePhotoCompositionTemplate)
      .filter((template): template is PhotoCompositionTemplate => Boolean(template?.custom))
      .slice(0, 3);
  } catch {
    return [];
  }
}

export function savePhotoCompositionTemplates(templates: readonly PhotoCompositionTemplate[], storage: TemplateStorage | null = browserTemplateStorage()) {
  try {
    const normalized = templates.map(normalizePhotoCompositionTemplate)
      .filter((template): template is PhotoCompositionTemplate => Boolean(template?.custom))
      .slice(0, 3);
    storage?.setItem(photoCompositionTemplateStorageKey, JSON.stringify(normalized));
    return storage !== null;
  } catch {
    return false;
  }
}

export function createPhotoCompositionTemplate(
  photoTransform: PhotoFrameTransform,
  stickerStyle: PhotoStickerStyle,
  stickerTransform: PhotoStickerTransform,
  index: number,
  id = `frame-${Date.now().toString(36)}`,
  stickerText = ""
): PhotoCompositionTemplate {
  return {
    id: id.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48),
    label: `내 프레임 ${Math.min(3, Math.max(1, index + 1))}`,
    photoTransform: normalizePhotoFrameTransform(photoTransform),
    stickerText: normalizePhotoStickerText(stickerText),
    stickerStyle: normalizePhotoStickerStyle(stickerStyle),
    stickerTransform: normalizePhotoStickerTransform(stickerTransform),
    custom: true
  };
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_template");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export function createPhotoCompositionTemplateShareUrl(template: PhotoCompositionTemplate, href: string) {
  const normalized = normalizePhotoCompositionTemplate({ ...template, custom: true });
  if (!normalized) throw new Error("invalid_template");
  const url = new URL(href);
  url.searchParams.set(photoCompositionTemplateShareParam, encodeBase64Url(JSON.stringify({
    version: 1,
    template: { ...normalized, id: "shared-frame", label: "공유 프레임", custom: true }
  })));
  url.hash = "";
  return url.toString();
}

export function readPhotoCompositionTemplateFromUrl(href: string): PhotoCompositionTemplate | null {
  try {
    const url = new URL(href);
    const encoded = url.searchParams.get(photoCompositionTemplateShareParam);
    if (!encoded || encoded.length > 2_000) return null;
    const payload = JSON.parse(decodeBase64Url(encoded)) as { version?: unknown; template?: unknown };
    if (payload.version !== 1) return null;
    const template = normalizePhotoCompositionTemplate(payload.template);
    return template ? { ...template, id: `shared-${Date.now().toString(36)}`, label: "받은 프레임", custom: true } : null;
  } catch {
    return null;
  }
}

export function removePhotoCompositionTemplateFromUrl(href: string) {
  const url = new URL(href);
  url.searchParams.delete(photoCompositionTemplateShareParam);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function photoStickerPreviewStyle(value?: Partial<PhotoStickerStyle> | null) {
  const style = normalizePhotoStickerStyle(value);
  return {
    background: stickerTones[style.tone].background,
    color: stickerTones[style.tone].color,
    fontFamily: stickerFonts[style.font]
  };
}

export function photoStickerTransformPreviewStyle(value?: Partial<PhotoStickerTransform> | null) {
  const transform = normalizePhotoStickerTransform(value);
  return {
    left: `${transform.x * 100}%`,
    top: `${transform.y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.scale})`,
    transformOrigin: "center"
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

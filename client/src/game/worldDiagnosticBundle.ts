import type { WorldZoneId } from "@wedding-game/shared";
import type { WorldGeometryAuditFinding } from "./worldGeometryAudit";
import type { WorldGeometryAuditPolicyResult } from "./worldGeometryAuditPolicy";
import type { WorldGeometryAuditLayers } from "./worldGeometryAuditLayers";
import type { WorldGeometryAuditHeatmapMode } from "./worldGeometryAuditHeatmap";
import type {
  ForegroundRecommendationDecision,
  WorldForegroundRecommendationPatch
} from "./worldForegroundRecommendations";

export type WorldDiagnosticScreenshot = {
  mimeType: "image/png";
  dataUrl: string;
  width: number;
  height: number;
};

export type WorldDiagnosticBundle = {
  version: 2;
  generatedAt: string;
  zone: { id: WorldZoneId; label: string };
  diagnosticUrl: string;
  viewerUrl: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  userAgent: string;
  layers: WorldGeometryAuditLayers;
  heatmapMode: WorldGeometryAuditHeatmapMode;
  sourceContract: {
    target: WorldForegroundRecommendationPatch["target"];
    version: number;
    checksum: string;
  };
  findings: WorldGeometryAuditFinding[];
  policy: WorldGeometryAuditPolicyResult;
  recommendationDecisions: Partial<Record<string, ForegroundRecommendationDecision>>;
  selectedPatch: WorldForegroundRecommendationPatch;
  screenshot: WorldDiagnosticScreenshot;
  integrity: {
    algorithm: "SHA-256";
    canonicalization: "json-sort-v1";
    checksum: string;
  };
};

type ScreenshotRenderer = (
  element: HTMLElement,
  options: {
    backgroundColor: string;
    logging: boolean;
    onclone: (clonedDocument: Document, clonedElement: HTMLElement) => void;
    scale: number;
    useCORS: boolean;
  }
) => Promise<HTMLCanvasElement>;

const screenshotColorProperties = [
  "backgroundColor",
  "backgroundImage",
  "borderBottomColor",
  "borderLeftColor",
  "borderRightColor",
  "borderTopColor",
  "boxShadow",
  "color",
  "outlineColor",
  "textDecorationColor",
  "textShadow",
  "webkitTextFillColor",
  "webkitTextStrokeColor"
] as const;

export function normalizeSrgbColorFunctions(value: string): string {
  return value.replace(
    /color\(\s*srgb\s+([+-]?(?:\d*\.)?\d+)\s+([+-]?(?:\d*\.)?\d+)\s+([+-]?(?:\d*\.)?\d+)(?:\s*\/\s*([+-]?(?:\d*\.)?\d+))?\s*\)/g,
    (_match, red: string, green: string, blue: string, alpha?: string) => {
      const channel = (raw: string) => Math.round(Math.min(1, Math.max(0, Number(raw))) * 255);
      const opacity = alpha === undefined ? 1 : Math.min(1, Math.max(0, Number(alpha)));
      const rgb = `${channel(red)}, ${channel(green)}, ${channel(blue)}`;
      return opacity === 1 ? `rgb(${rgb})` : `rgba(${rgb}, ${opacity})`;
    }
  );
}

function normalizeScreenshotCloneColors(clonedDocument: Document, clone: HTMLElement): void {
  const cloneElements = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
  cloneElements.forEach((cloneElement) => {
    const computed = clonedDocument.defaultView?.getComputedStyle(cloneElement);
    if (!computed) return;
    screenshotColorProperties.forEach((property) => {
      const value = computed[property];
      if (value.includes("color(")) cloneElement.style[property] = normalizeSrgbColorFunctions(value);
    });
  });
}

function prepareScreenshotClone(clonedDocument: Document, clone: HTMLElement): void {
  clone.classList.add("world-diagnostic-capture");
  const captureOverrides = clonedDocument.createElement("style");
  captureOverrides.textContent = [
    ".world-diagnostic-capture::before,",
    ".world-diagnostic-capture::after,",
    ".world-diagnostic-capture *::before,",
    ".world-diagnostic-capture *::after { content: none !important; }"
  ].join("\n");
  clonedDocument.head.append(captureOverrides);
  normalizeScreenshotCloneColors(clonedDocument, clone);
}

export type JsonDownloadEnvironment = {
  createObjectUrl(blob: Blob): string;
  clickDownload(url: string, filename: string): void;
  revokeObjectUrl(url: string): void;
};

const browserDownloadEnvironment: JsonDownloadEnvironment = {
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

export function worldDiagnosticArtifactFilename(
  kind: "bundle" | "patch",
  zoneId: WorldZoneId,
  generatedAt = new Date()
): string {
  const timestamp = generatedAt.toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  return `wedding-map-${zoneId}-${kind}-${timestamp}.json`;
}

export function worldDiagnosticBundleViewerUrl(
  baseUrl = import.meta.env.BASE_URL,
  locationUrl = window.location.href
): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(`${normalizedBase}map-diagnostic-bundle-viewer.html`, locationUrl).toString();
}

export async function captureWorldDiagnosticScreenshot(
  element: HTMLElement,
  renderer?: ScreenshotRenderer
): Promise<WorldDiagnosticScreenshot> {
  const capture = renderer ?? (await import("html2canvas")).default;
  const canvas = await capture(element, {
    backgroundColor: "#171717",
    logging: false,
    onclone: (clonedDocument, clonedElement) => prepareScreenshotClone(clonedDocument, clonedElement),
    scale: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
    useCORS: true
  });
  return {
    mimeType: "image/png",
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height
  };
}

export function canonicalDiagnosticJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalDiagnosticJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalDiagnosticJson(record[key])}`
  )).join(",")}}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createWorldDiagnosticBundle(
  input: Omit<WorldDiagnosticBundle, "version" | "integrity">
): Promise<WorldDiagnosticBundle> {
  const payload = { version: 2 as const, ...input };
  return {
    ...payload,
    integrity: {
      algorithm: "SHA-256",
      canonicalization: "json-sort-v1",
      checksum: await sha256Hex(canonicalDiagnosticJson(payload))
    }
  };
}

export async function verifyWorldDiagnosticBundleIntegrity(bundle: WorldDiagnosticBundle): Promise<boolean> {
  if (
    bundle.version !== 2
    || bundle.integrity?.algorithm !== "SHA-256"
    || bundle.integrity?.canonicalization !== "json-sort-v1"
  ) return false;
  const { integrity, ...payload } = bundle;
  return integrity.checksum === await sha256Hex(canonicalDiagnosticJson(payload));
}

export function downloadJsonArtifact(
  value: unknown,
  filename: string,
  environment: JsonDownloadEnvironment = browserDownloadEnvironment
): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const url = environment.createObjectUrl(blob);
  try {
    environment.clickDownload(url, filename);
  } finally {
    environment.revokeObjectUrl(url);
  }
}

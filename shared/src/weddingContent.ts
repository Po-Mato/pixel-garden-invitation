import rawGalleryAssets from "./weddingGalleryAssets.json";

export type GalleryOrientation = "landscape" | "portrait";
export type GalleryLayout = "hero" | "wide" | "half";

export type WeddingGalleryPhoto = {
  id: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
  orientation: GalleryOrientation;
  layout: GalleryLayout;
  assetPath: string;
  sources: readonly { assetPath: string; width: 640 | 1024 }[];
};

export type CoupleProfile = {
  role: "groom" | "bride";
  roleLabel: "신랑" | "신부";
  name: string;
  message: string;
  photoId: string;
};

export type WeddingStoryStep = {
  id: "hello" | "seasons" | "promise" | "wedding";
  title: string;
  body: string;
  photoId?: string;
};

export type WeddingContent = {
  coupleProfiles: readonly CoupleProfile[];
  coupleMessage: string;
  gallery: readonly WeddingGalleryPhoto[];
  storyTimeline: readonly WeddingStoryStep[];
};

type ManifestPhoto = Omit<WeddingGalleryPhoto, "assetPath" | "sources">;

const assetRoot = "images/wedding-gallery";
const sourceWidths = [640, 1024] as const;
const layouts: readonly GalleryLayout[] = ["hero", "wide", "half"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isManifestPhoto(value: unknown): value is ManifestPhoto {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.alt === "string"
    && (value.caption === undefined || typeof value.caption === "string")
    && typeof value.width === "number"
    && typeof value.height === "number"
    && (value.orientation === "landscape" || value.orientation === "portrait")
    && typeof value.layout === "string";
}

function toRuntimePhoto(photo: ManifestPhoto): WeddingGalleryPhoto {
  return {
    ...photo,
    assetPath: `${assetRoot}/${photo.id}-1024.webp`,
    sources: sourceWidths.map((width) => ({
      assetPath: `${assetRoot}/${photo.id}-${width}.webp`,
      width
    }))
  };
}

export function parseWeddingGalleryManifest(manifest: readonly unknown[]): WeddingGalleryPhoto[] {
  if (manifest.length !== 10) {
    throw new Error("웨딩 갤러리 메타데이터는 정확히 10장이어야 합니다.");
  }

  const ids = new Set<string>();

  for (const entry of manifest) {
    if (!isManifestPhoto(entry)) {
      throw new Error("웨딩 갤러리 메타데이터 형식이 올바르지 않습니다.");
    }

    if (entry.id.trim().length === 0 || ids.has(entry.id)) {
      throw new Error("웨딩 갤러리 사진 ID는 고유해야 합니다.");
    }

    if (entry.alt.trim().length === 0) {
      throw new Error("웨딩 갤러리 사진의 대체 텍스트는 비어 있을 수 없습니다.");
    }

    if (!Number.isFinite(entry.width) || !Number.isFinite(entry.height) || entry.width <= 0 || entry.height <= 0) {
      throw new Error("웨딩 갤러리 사진의 크기는 양수여야 합니다.");
    }

    const hasMatchingOrientation = (entry.orientation === "landscape" && entry.width > entry.height)
      || (entry.orientation === "portrait" && entry.height > entry.width);
    if (!hasMatchingOrientation) {
      throw new Error("웨딩 갤러리 사진의 방향이 크기와 일치하지 않습니다.");
    }

    if (!layouts.includes(entry.layout)) {
      throw new Error("웨딩 갤러리 사진의 레이아웃이 허용되지 않습니다.");
    }

    ids.add(entry.id);
  }

  return manifest.map((entry) => toRuntimePhoto(entry as ManifestPhoto));
}

export const weddingContent = {
  coupleProfiles: [
    {
      role: "bride",
      roleLabel: "신부",
      name: "이건희",
      message: "함께 걷는 첫날을 소중한 분들과 나누고 싶습니다. 따뜻한 축복으로 함께해 주세요.",
      photoId: "02-dress-bouquet"
    },
    {
      role: "groom",
      roleLabel: "신랑",
      name: "이승재",
      message: "새로운 계절을 함께 시작합니다. 귀한 걸음에 감사드리며 기쁜 마음으로 기다리겠습니다.",
      photoId: "01-cover"
    }
  ],
  coupleMessage: "저희 두 사람의 새로운 시작에 함께해 주시면 더없는 기쁨이겠습니다.",
  gallery: parseWeddingGalleryManifest(rawGalleryAssets),
  storyTimeline: [
    {
      id: "hello",
      title: "첫 인사",
      body: "서로의 일상에 처음 인사를 건넨 순간부터 두 사람의 이야기가 시작되었습니다.",
      photoId: "03-side-walk"
    },
    {
      id: "seasons",
      title: "함께한 시간",
      body: "크고 작은 계절을 함께 지나며 서로에게 가장 편안한 사람이 되었습니다.",
      photoId: "04-bench-silhouette"
    },
    {
      id: "promise",
      title: "결혼을 약속한 마음",
      body: "앞으로의 모든 날도 같은 편으로 걷고 싶다는 마음으로 평생을 약속했습니다.",
      photoId: "06-hands-rings"
    },
    {
      id: "wedding",
      title: "우리의 결혼식",
      body: "이제 한 가족이 되는 첫날, 소중한 분들을 모시고 기쁨을 나누려 합니다.",
      photoId: "09-garden-aisle"
    }
  ]
} satisfies WeddingContent;

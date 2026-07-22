import type {
  GalleryLayout,
  GalleryOrientation,
  WeddingContent
} from "./weddingContent";

export type EditableGalleryPhoto = {
  id: string;
  alt: string;
  caption: string;
  assetId: string | null;
  width: number;
  height: number;
  orientation: GalleryOrientation;
  layout: GalleryLayout;
};

export type EditableInvitationGallery = {
  photos: EditableGalleryPhoto[];
};

export type InvitationGalleryVersionAction = "save" | "publish" | "restore";

export type InvitationGalleryVersion = {
  id: string;
  revision: number;
  action: InvitationGalleryVersionAction;
  gallery: EditableInvitationGallery;
  createdAt: string;
};

export type InvitationGalleryAdminResult = {
  draft: EditableInvitationGallery | null;
  revision: number;
  publishedRevision: number | null;
  updatedAt: string | null;
  publishedAt: string | null;
  history: InvitationGalleryVersion[];
};

export type InvitationGalleryPublicResult = {
  gallery: EditableInvitationGallery | null;
  revision: number | null;
  publishedAt: string | null;
};

export type InvitationGalleryPublishIssue = "images" | "alt_text";

const assetIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const layouts: readonly GalleryLayout[] = ["hero", "wide", "half"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim();
  return normalized.length <= maxLength ? normalized : null;
}

function parsePhoto(value: unknown): EditableGalleryPhoto | null {
  if (!isRecord(value)) return null;
  const id = normalizedString(value.id, 64);
  const alt = normalizedString(value.alt, 240);
  const caption = normalizedString(value.caption, 160);
  const assetId = value.assetId === null
    ? null
    : typeof value.assetId === "string" && assetIdPattern.test(value.assetId)
      ? value.assetId
      : null;
  const width = value.width;
  const height = value.height;
  const orientation = value.orientation;
  const layout = value.layout;
  if (
    !id
    || alt === null
    || caption === null
    || (value.assetId !== null && assetId === null)
    || !Number.isInteger(width)
    || !Number.isInteger(height)
    || (width as number) < 320
    || (height as number) < 320
    || (width as number) > 4096
    || (height as number) > 4096
    || (orientation !== "landscape" && orientation !== "portrait")
    || typeof layout !== "string"
    || !layouts.includes(layout as GalleryLayout)
  ) return null;
  const matchesOrientation = orientation === "landscape"
    ? (width as number) > (height as number)
    : (height as number) > (width as number);
  if (!matchesOrientation) return null;
  return {
    id,
    alt,
    caption,
    assetId,
    width: width as number,
    height: height as number,
    orientation,
    layout: layout as GalleryLayout
  };
}

export function parseEditableInvitationGallery(
  value: unknown,
  template: WeddingContent["gallery"]
): EditableInvitationGallery | null {
  if (!isRecord(value) || !Array.isArray(value.photos) || value.photos.length !== template.length) {
    return null;
  }
  const photos = value.photos.map(parsePhoto);
  if (photos.some((photo) => photo === null)) return null;
  const normalized = photos as EditableGalleryPhoto[];
  const matchesTemplate = normalized.every((photo, index) => {
    const expected = template[index];
    return photo.id === expected.id
      && photo.orientation === expected.orientation
      && photo.layout === expected.layout;
  });
  return matchesTemplate ? { photos: normalized } : null;
}

export function buildDefaultEditableInvitationGallery(
  content: WeddingContent
): EditableInvitationGallery {
  return {
    photos: content.gallery.map((photo) => ({
      id: photo.id,
      alt: photo.alt,
      caption: photo.caption ?? "",
      assetId: null,
      width: photo.width,
      height: photo.height,
      orientation: photo.orientation,
      layout: photo.layout
    }))
  };
}

export function editableInvitationGalleryPublishIssues(
  gallery: EditableInvitationGallery
): InvitationGalleryPublishIssue[] {
  const issues: InvitationGalleryPublishIssue[] = [];
  if (gallery.photos.some((photo) => !photo.assetId)) issues.push("images");
  if (gallery.photos.some((photo) => !photo.alt)) issues.push("alt_text");
  return issues;
}

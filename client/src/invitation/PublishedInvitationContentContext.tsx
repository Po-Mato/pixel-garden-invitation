import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  buildDefaultEditableInvitationContent,
  parseEditableInvitationGallery,
  invitationContent,
  parseEditableInvitationContent,
  type EditableInvitationGallery,
  type EditableInvitationContent,
  type WeddingGalleryPhoto,
  type WeddingContent,
  type WeddingEvent
} from "@wedding-game/shared";
import {
  invitationGalleryMediaUrl
} from "../api/invitationGalleryApi";
import { fetchPublishedInvitationRelease } from "../api/invitationReleaseApi";

export type PublishedInvitationContent = {
  event: WeddingEvent;
  content: WeddingContent;
  editable: EditableInvitationContent;
  share: EditableInvitationContent["share"];
  source: "static" | "published";
  gallerySource: "static" | "published";
  revision: number | null;
  publishedAt: string | null;
  refresh: () => Promise<void>;
};

const defaultEditable = buildDefaultEditableInvitationContent(
  invitationContent.event,
  invitationContent.content
);

function deriveRuntimeGallery(
  gallery: EditableInvitationGallery | null,
  mediaUrl: (assetId: string, width: 640 | 1024) => string = invitationGalleryMediaUrl
): readonly WeddingGalleryPhoto[] {
  if (!gallery || gallery.photos.some((photo) => !photo.assetId)) return invitationContent.content.gallery;
  return gallery.photos.map((photo) => ({
    id: photo.id,
    alt: photo.alt,
    ...(photo.caption ? { caption: photo.caption } : {}),
    width: photo.width,
    height: photo.height,
    orientation: photo.orientation,
    layout: photo.layout,
    assetPath: mediaUrl(photo.assetId!, 1024),
    sources: ([640, 1024] as const).map((width) => ({
      assetPath: mediaUrl(photo.assetId!, width),
      width
    }))
  }));
}

function derivePublishedContent(
  editable: EditableInvitationContent,
  gallery: EditableInvitationGallery | null = null,
  mediaUrl?: (assetId: string, width: 640 | 1024) => string
) {
  const event: WeddingEvent = {
    ...invitationContent.event,
    familyContacts: editable.familyContacts,
    giftAccounts: editable.giftAccounts
  };
  const content: WeddingContent = {
    ...invitationContent.content,
    coupleProfiles: invitationContent.content.coupleProfiles.map((profile) => ({
      ...profile,
      message: profile.role === "bride"
        ? editable.coupleIntroduction.bride
        : editable.coupleIntroduction.groom
    })),
    coupleMessage: editable.coupleIntroduction.together,
    gallery: deriveRuntimeGallery(gallery, mediaUrl),
    storyTimeline: invitationContent.content.storyTimeline.map((step, index) => ({
      ...step,
      title: editable.storyTimeline[index]?.title ?? step.title,
      body: editable.storyTimeline[index]?.body ?? step.body
    }))
  };
  return { event, content };
}

const fallback = derivePublishedContent(defaultEditable);
const defaultValue: PublishedInvitationContent = {
  ...fallback,
  editable: defaultEditable,
  share: defaultEditable.share,
  source: "static",
  gallerySource: "static",
  revision: null,
  publishedAt: null,
  refresh: async () => undefined
};

const PublishedInvitationContentContext = createContext<PublishedInvitationContent>(defaultValue);

export function PublishedInvitationContentProvider({ children }: { children: ReactNode }) {
  const [published, setPublished] = useState<{
    editable: EditableInvitationContent;
    revision: number;
    publishedAt: string | null;
  } | null>(null);
  const [publishedGallery, setPublishedGallery] = useState<{
    gallery: EditableInvitationGallery;
    revision: number;
    publishedAt: string | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchPublishedInvitationRelease();
      const content = result.content ? parseEditableInvitationContent(result.content) : null;
      if (content && result.contentRevision !== null) {
        setPublished({ editable: content, revision: result.contentRevision, publishedAt: result.publishedAt });
      } else {
        setPublished(null);
      }
      const gallery = result.gallery
        ? parseEditableInvitationGallery(result.gallery, invitationContent.content.gallery)
        : null;
      if (gallery && result.galleryRevision !== null) {
        setPublishedGallery({ gallery, revision: result.galleryRevision, publishedAt: result.publishedAt });
      } else {
        setPublishedGallery(null);
      }
    } catch {
      setPublished(null);
      setPublishedGallery(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPublishedInvitationRelease(controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        const content = result.content ? parseEditableInvitationContent(result.content) : null;
        setPublished(content && result.contentRevision !== null
          ? { editable: content, revision: result.contentRevision, publishedAt: result.publishedAt }
          : null);
        const gallery = result.gallery
          ? parseEditableInvitationGallery(result.gallery, invitationContent.content.gallery)
          : null;
        setPublishedGallery(gallery && result.galleryRevision !== null
          ? { gallery, revision: result.galleryRevision, publishedAt: result.publishedAt }
          : null);
      }
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const value = useMemo<PublishedInvitationContent>(() => {
    const editable = published?.editable ?? defaultEditable;
    return {
      ...derivePublishedContent(editable, publishedGallery?.gallery ?? null),
      editable,
      share: editable.share,
      source: published ? "published" : "static",
      gallerySource: publishedGallery ? "published" : "static",
      revision: published?.revision ?? null,
      publishedAt: published?.publishedAt ?? null,
      refresh
    };
  }, [published, publishedGallery, refresh]);

  return (
    <PublishedInvitationContentContext.Provider value={value}>
      {children}
    </PublishedInvitationContentContext.Provider>
  );
}

export function usePublishedInvitationContent(): PublishedInvitationContent {
  return useContext(PublishedInvitationContentContext);
}

export function InvitationContentPreviewProvider({
  editable,
  gallery,
  galleryAssetUrl,
  children
}: {
  editable: EditableInvitationContent;
  gallery: EditableInvitationGallery | null;
  galleryAssetUrl: (assetId: string, width: 640 | 1024) => string;
  children: ReactNode;
}) {
  const value = useMemo<PublishedInvitationContent>(() => ({
    ...derivePublishedContent(editable, gallery, galleryAssetUrl),
    editable,
    share: editable.share,
    source: "published",
    gallerySource: gallery ? "published" : "static",
    revision: null,
    publishedAt: null,
    refresh: async () => undefined
  }), [editable, gallery, galleryAssetUrl]);
  return (
    <PublishedInvitationContentContext.Provider value={value}>
      {children}
    </PublishedInvitationContentContext.Provider>
  );
}

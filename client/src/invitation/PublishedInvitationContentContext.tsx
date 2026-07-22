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
import { fetchPublishedInvitationContent } from "../api/invitationContentApi";
import {
  fetchPublishedInvitationGallery,
  invitationGalleryMediaUrl
} from "../api/invitationGalleryApi";

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

function deriveRuntimeGallery(gallery: EditableInvitationGallery | null): readonly WeddingGalleryPhoto[] {
  if (!gallery || gallery.photos.some((photo) => !photo.assetId)) return invitationContent.content.gallery;
  return gallery.photos.map((photo) => ({
    id: photo.id,
    alt: photo.alt,
    ...(photo.caption ? { caption: photo.caption } : {}),
    width: photo.width,
    height: photo.height,
    orientation: photo.orientation,
    layout: photo.layout,
    assetPath: invitationGalleryMediaUrl(photo.assetId!, 1024),
    sources: ([640, 1024] as const).map((width) => ({
      assetPath: invitationGalleryMediaUrl(photo.assetId!, width),
      width
    }))
  }));
}

function derivePublishedContent(
  editable: EditableInvitationContent,
  gallery: EditableInvitationGallery | null = null
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
    gallery: deriveRuntimeGallery(gallery),
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
    const [contentRequest, galleryRequest] = await Promise.allSettled([
      fetchPublishedInvitationContent(),
      fetchPublishedInvitationGallery()
    ]);
    if (contentRequest.status === "fulfilled") {
      const result = contentRequest.value;
      const content = result.content ? parseEditableInvitationContent(result.content) : null;
      if (content && result.revision !== null) {
        setPublished({ editable: content, revision: result.revision, publishedAt: result.publishedAt });
      } else {
        setPublished(null);
      }
    } else {
      setPublished(null);
    }
    if (galleryRequest.status === "fulfilled") {
      const result = galleryRequest.value;
      const gallery = result.gallery
        ? parseEditableInvitationGallery(result.gallery, invitationContent.content.gallery)
        : null;
      if (gallery && result.revision !== null) {
        setPublishedGallery({ gallery, revision: result.revision, publishedAt: result.publishedAt });
      } else {
        setPublishedGallery(null);
      }
    } else {
      setPublishedGallery(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      fetchPublishedInvitationContent(controller.signal),
      fetchPublishedInvitationGallery(controller.signal)
    ]).then(([contentRequest, galleryRequest]) => {
      if (contentRequest.status === "fulfilled") {
        const result = contentRequest.value;
        const content = result.content ? parseEditableInvitationContent(result.content) : null;
        if (content && result.revision !== null) {
          setPublished({ editable: content, revision: result.revision, publishedAt: result.publishedAt });
        }
      }
      if (galleryRequest.status === "fulfilled") {
        const result = galleryRequest.value;
        const gallery = result.gallery
          ? parseEditableInvitationGallery(result.gallery, invitationContent.content.gallery)
          : null;
        if (gallery && result.revision !== null) {
          setPublishedGallery({ gallery, revision: result.revision, publishedAt: result.publishedAt });
        }
      }
    });
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

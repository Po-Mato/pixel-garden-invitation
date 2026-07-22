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
  invitationContent,
  parseEditableInvitationContent,
  type EditableInvitationContent,
  type WeddingContent,
  type WeddingEvent
} from "@wedding-game/shared";
import { fetchPublishedInvitationContent } from "../api/invitationContentApi";

export type PublishedInvitationContent = {
  event: WeddingEvent;
  content: WeddingContent;
  editable: EditableInvitationContent;
  share: EditableInvitationContent["share"];
  source: "static" | "published";
  revision: number | null;
  publishedAt: string | null;
  refresh: () => Promise<void>;
};

const defaultEditable = buildDefaultEditableInvitationContent(
  invitationContent.event,
  invitationContent.content
);

function derivePublishedContent(editable: EditableInvitationContent) {
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

  const refresh = useCallback(async () => {
    try {
      const result = await fetchPublishedInvitationContent();
      const content = result.content ? parseEditableInvitationContent(result.content) : null;
      if (content && result.revision !== null) {
        setPublished({ editable: content, revision: result.revision, publishedAt: result.publishedAt });
      } else {
        setPublished(null);
      }
    } catch {
      setPublished(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPublishedInvitationContent(controller.signal)
      .then((result) => {
        const content = result.content ? parseEditableInvitationContent(result.content) : null;
        if (content && result.revision !== null) {
          setPublished({ editable: content, revision: result.revision, publishedAt: result.publishedAt });
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const value = useMemo<PublishedInvitationContent>(() => {
    const editable = published?.editable ?? defaultEditable;
    return {
      ...derivePublishedContent(editable),
      editable,
      share: editable.share,
      source: published ? "published" : "static",
      revision: published?.revision ?? null,
      publishedAt: published?.publishedAt ?? null,
      refresh
    };
  }, [published, refresh]);

  return (
    <PublishedInvitationContentContext.Provider value={value}>
      {children}
    </PublishedInvitationContentContext.Provider>
  );
}

export function usePublishedInvitationContent(): PublishedInvitationContent {
  return useContext(PublishedInvitationContentContext);
}

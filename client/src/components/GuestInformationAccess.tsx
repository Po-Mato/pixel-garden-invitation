import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  HelpCircle,
  MapPin,
  Phone
} from "lucide-react";
import type {
  GuestAnnouncementRecord,
  GuestFaqRecord,
  GuestInformationPublicResult
} from "@wedding-game/shared";
import {
  fetchGuestInformation,
  recordGuestInformationViews
} from "../api/guestInformationApi";
import { trackInvitationAnalytics } from "../analytics/invitationAnalytics";
import { buildDirectionsLinks } from "../invitation/directions";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { BottomSheet } from "./BottomSheet";
import "../guest-information-public.css";

type GuestInformationAccessProps = {
  variant: "entry" | "quick" | "world";
  onOpenChange?: (open: boolean) => void;
};

let cachedResult: GuestInformationPublicResult | null = null;
let pendingResult: Promise<GuestInformationPublicResult> | null = null;

function loadInformation(): Promise<GuestInformationPublicResult> {
  if (cachedResult) return Promise.resolve(cachedResult);
  pendingResult ??= fetchGuestInformation().then((result) => {
    cachedResult = result;
    return result;
  }).finally(() => {
    pendingResult = null;
  });
  return pendingResult;
}

export function resetGuestInformationCacheForTest(): void {
  cachedResult = null;
  pendingResult = null;
}

function toneLabel(tone: GuestAnnouncementRecord["tone"]): string {
  if (tone === "urgent") return "긴급";
  if (tone === "important") return "중요";
  return "안내";
}

function viewedStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function recordViews(items: GuestAnnouncementRecord[]): void {
  if (items.length === 0) return;
  const storage = viewedStorage();
  const key = "wedding:guest-information:viewed";
  const viewed = new Set((storage?.getItem(key) ?? "").split(",").filter(Boolean));
  const unseen = items.map(({ id }) => id).filter((id) => !viewed.has(id));
  if (unseen.length === 0) return;
  unseen.forEach((id) => viewed.add(id));
  try {
    storage?.setItem(key, [...viewed].join(","));
  } catch {
    // View counting must not block access to the information.
  }
  void recordGuestInformationViews(unseen).catch(() => undefined);
}

function AnnouncementAction({ item }: { item: GuestAnnouncementRecord }) {
  const { event } = usePublishedInvitationContent();
  const links = buildDirectionsLinks(event.venue);
  const href = item.actionKind === "directions"
    ? links.naver
    : item.actionKind === "venue_phone"
      ? links.telephone
      : item.actionKind === "external"
        ? item.actionUrl
        : null;
  if (!href) return null;
  const external = item.actionKind !== "venue_phone";
  const label = item.actionLabel || (
    item.actionKind === "directions" ? "길 찾기" : item.actionKind === "venue_phone" ? "예식장 전화" : "자세히 보기"
  );
  return (
    <a
      className="guest-information-announcement__action"
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={() => {
        if (item.actionKind === "directions") trackInvitationAnalytics("map_click", "guest_information");
        if (item.actionKind === "venue_phone") trackInvitationAnalytics("call_click", "guest_information");
      }}
    >
      {item.actionKind === "directions" ? <MapPin aria-hidden="true" /> : item.actionKind === "venue_phone" ? <Phone aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}
      {label}
    </a>
  );
}

export function GuestInformationContent({ result }: { result: GuestInformationPublicResult }) {
  const categories = useMemo(() => {
    const grouped = new Map<string, GuestFaqRecord[]>();
    result.faqs.forEach((item) => grouped.set(item.category, [...(grouped.get(item.category) ?? []), item]));
    return [...grouped.entries()];
  }, [result.faqs]);

  return (
    <div className="guest-information-content">
      {result.announcements.length > 0 ? (
        <section className="guest-information-announcements" aria-labelledby="guest-information-announcements-title">
          <header><Bell aria-hidden="true" /><div><span>NOTICE</span><h3 id="guest-information-announcements-title">하객 공지</h3></div></header>
          <div className="guest-information-announcements__list">
            {result.announcements.map((item) => (
              <article key={item.id} className={`guest-information-announcement guest-information-announcement--${item.tone}`}>
                <div className="guest-information-announcement__heading">
                  <span>{toneLabel(item.tone)}</span>
                  {item.pinned ? <small>상단 고정</small> : null}
                </div>
                <h4>{item.title}</h4>
                <p>{item.body}</p>
                <AnnouncementAction item={item} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {categories.length > 0 ? (
        <section className="guest-information-faqs" aria-labelledby="guest-information-faq-title">
          <header><HelpCircle aria-hidden="true" /><div><span>FAQ</span><h3 id="guest-information-faq-title">자주 묻는 질문</h3></div></header>
          {categories.map(([category, items]) => (
            <div key={category} className="guest-information-faq-group">
              <h4>{category}</h4>
              {items.map((item) => (
                <details key={item.id}>
                  <summary><span>{item.question}</span><ChevronDown aria-hidden="true" /></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

export function GuestInformationAccess({ variant, onOpenChange }: GuestInformationAccessProps) {
  const [result, setResult] = useState<GuestInformationPublicResult | null>(cachedResult);
  const [loading, setLoading] = useState(!cachedResult);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void loadInformation().then((value) => {
      if (active) setResult(value);
    }).catch(() => undefined).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const urgent = result?.announcements.find(({ tone }) => tone === "urgent");
  const leading = urgent ?? result?.announcements[0];
  const count = (result?.announcements.length ?? 0) + (result?.faqs.length ?? 0);
  if (!loading && count === 0) return null;

  const setVisibility = (visible: boolean) => {
    setOpen(visible);
    onOpenChange?.(visible);
    if (visible && result) recordViews(result.announcements);
  };

  return (
    <>
      <button
        type="button"
        className={`guest-information-trigger guest-information-trigger--${variant}${urgent ? " guest-information-trigger--urgent" : ""}`}
        aria-label={variant === "quick" || variant === "world" ? "공지·FAQ 열기" : undefined}
        aria-busy={loading || undefined}
        disabled={loading}
        onClick={() => setVisibility(true)}
      >
        {urgent ? <CircleAlert aria-hidden="true" /> : <Bell aria-hidden="true" />}
        {variant === "quick" ? <span className="guest-information-trigger__dot" aria-hidden="true" /> : (
          <span>
            <small>{urgent ? "긴급 공지" : "GUEST GUIDE"}</small>
            <strong>{leading?.title ?? "공지·FAQ"}</strong>
          </span>
        )}
        {variant !== "quick" ? <ChevronDown aria-hidden="true" /> : null}
      </button>

      {open && result ? (
        <BottomSheet title="공지·자주 묻는 질문" onClose={() => setVisibility(false)}>
          <GuestInformationContent result={result} />
        </BottomSheet>
      ) : null}
    </>
  );
}

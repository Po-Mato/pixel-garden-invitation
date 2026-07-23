import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { EntryScreen, type EntryProfile } from "./components/EntryScreen";
import { useCoupleOrder } from "./invitation/CoupleOrderContext";
import { usePublishedInvitationContent } from "./invitation/PublishedInvitationContentContext";
import { formatCoupleNames, formatWeddingTitle } from "./invitation/coupleOrder";
import { preloadImage } from "./performance/imagePreloader";
import { resolveInvitationShareText } from "./invitation/shareInvitation";
import { setAnalyticsContext, trackAnalyticsModeOpen } from "./analytics/invitationAnalytics";
import { useInvitationInvite } from "./invitation/useInvitationInvite";
import { PwaStatusCenter } from "./components/PwaStatusCenter";

const homeMapUrl = `${import.meta.env.BASE_URL}assets/maps/v2/home/background.webp`;
const quickCoverUrl = `${import.meta.env.BASE_URL}images/wedding-gallery/01-cover-640.webp`;
let gameWorldModule: ReturnType<typeof importGameWorld> | undefined;
let quickInvitationModule: ReturnType<typeof importQuickInvitation> | undefined;

type AppMode = "entry" | "garden" | "invitation";

function importGameWorld() {
  return import("./components/GameWorld").then((module) => ({ default: module.GameWorld }));
}

function loadGameWorld() {
  void preloadImage(homeMapUrl, "high");
  gameWorldModule ??= importGameWorld();
  return gameWorldModule;
}

function importQuickInvitation() {
  return import("./components/QuickInvitation").then((module) => ({ default: module.QuickInvitation }));
}

function loadQuickInvitation() {
  void preloadImage(quickCoverUrl, "high");
  quickInvitationModule ??= importQuickInvitation();
  return quickInvitationModule;
}

const GameWorld = lazy(loadGameWorld);
const QuickInvitation = lazy(loadQuickInvitation);
const GuestbookAdminPage = lazy(() => import("./components/GuestbookAdminPage")
  .then((module) => ({ default: module.GuestbookAdminPage })));
const RsvpAdminPage = lazy(() => import("./components/RsvpAdminPage")
  .then((module) => ({ default: module.RsvpAdminPage })));
const ReadinessAdminPage = lazy(() => import("./components/ReadinessAdminPage")
  .then((module) => ({ default: module.ReadinessAdminPage })));
const ContentAdminPage = lazy(() => import("./components/ContentAdminPage")
  .then((module) => ({ default: module.ContentAdminPage })));
const GalleryAdminPage = lazy(() => import("./components/GalleryAdminPage")
  .then((module) => ({ default: module.GalleryAdminPage })));
const ReleaseAdminPage = lazy(() => import("./components/ReleaseAdminPage")
  .then((module) => ({ default: module.ReleaseAdminPage })));
const AnalyticsAdminPage = lazy(() => import("./components/AnalyticsAdminPage")
  .then((module) => ({ default: module.AnalyticsAdminPage })));
const SetupWizardAdminPage = lazy(() => import("./components/SetupWizardAdminPage")
  .then((module) => ({ default: module.SetupWizardAdminPage })));
const InviteLinksAdminPage = lazy(() => import("./components/InviteLinksAdminPage")
  .then((module) => ({ default: module.InviteLinksAdminPage })));
const GuestInformationAdminPage = lazy(() => import("./components/GuestInformationAdminPage")
  .then((module) => ({ default: module.GuestInformationAdminPage })));
const ReminderAdminPage = lazy(() => import("./components/ReminderAdminPage")
  .then((module) => ({ default: module.ReminderAdminPage })));

function ScreenLoadingFallback() {
  return <div className="screen-loading" role="status">화면을 준비하고 있어요</div>;
}

function updateNamedMeta(selector: string, value: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", value);
}

export function App() {
  const [profile, setProfile] = useState<EntryProfile | null>(null);
  const [mode, setMode] = useState<AppMode>(() => (
    new URLSearchParams(window.location.search).get("view") === "invitation" ? "invitation" : "entry"
  ));
  const coupleOrder = useCoupleOrder();
  const { event, share } = usePublishedInvitationContent();
  const searchParams = new URLSearchParams(window.location.search);
  const adminPage = searchParams.get("admin");
  const invitationInvite = useInvitationInvite(adminPage === null);

  useEffect(() => {
    const title = resolveInvitationShareText(share.title, event, coupleOrder)
      || formatWeddingTitle(event, coupleOrder);
    const date = event.startAt.slice(0, 10).replaceAll("-", ".");
    document.title = `${title} | ${date}`;
    updateNamedMeta('meta[property="og:title"]', title);
    updateNamedMeta('meta[name="twitter:title"]', title);
    updateNamedMeta('meta[name="description"]', share.description);
    updateNamedMeta('meta[property="og:description"]', share.description);
    updateNamedMeta('meta[name="twitter:description"]', share.description);
    updateNamedMeta(
      'meta[property="og:site_name"]',
      `${formatCoupleNames(event, coupleOrder)} 모바일 청첩장`
    );
  }, [coupleOrder, event, share.description, share.title]);

  const setInvitationUrl = useCallback((enabled: boolean) => {
    const url = new URL(window.location.href);
    if (enabled) url.searchParams.set("view", "invitation");
    else {
      url.searchParams.delete("view");
      url.hash = "";
    }
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const openQuickInvitation = useCallback(() => {
    void loadQuickInvitation();
    trackAnalyticsModeOpen("simple");
    setMode("invitation");
    if (new URLSearchParams(window.location.search).get("view") !== "invitation") {
      setInvitationUrl(true);
    }
  }, [setInvitationUrl]);

  const openGardenExperience = useCallback(() => {
    if (profile) trackAnalyticsModeOpen("game");
    else setAnalyticsContext("entry");
    setMode(profile ? "garden" : "entry");
    if (new URLSearchParams(window.location.search).has("view")) setInvitationUrl(false);
  }, [profile, setInvitationUrl]);

  useEffect(() => {
    const handlePopState = () => {
      const quickView = new URLSearchParams(window.location.search).get("view") === "invitation";
      setMode(quickView ? "invitation" : profile ? "garden" : "entry");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [profile]);

  const weddingDayPreview = searchParams.get("preview") === "wedding-day";
  if (adminPage === "rsvp") {
    return <Suspense fallback={<ScreenLoadingFallback />}><RsvpAdminPage /></Suspense>;
  }
  if (adminPage === "guestbook") {
    return <Suspense fallback={<ScreenLoadingFallback />}><GuestbookAdminPage /></Suspense>;
  }
  if (adminPage === "readiness") {
    return <Suspense fallback={<ScreenLoadingFallback />}><ReadinessAdminPage /></Suspense>;
  }
  if (adminPage === "content") {
    return <Suspense fallback={<ScreenLoadingFallback />}><ContentAdminPage /></Suspense>;
  }
  if (adminPage === "gallery") {
    return <Suspense fallback={<ScreenLoadingFallback />}><GalleryAdminPage /></Suspense>;
  }
  if (adminPage === "release") {
    return <Suspense fallback={<ScreenLoadingFallback />}><ReleaseAdminPage /></Suspense>;
  }
  if (adminPage === "analytics") {
    return <Suspense fallback={<ScreenLoadingFallback />}><AnalyticsAdminPage /></Suspense>;
  }
  if (adminPage === "setup") {
    return <Suspense fallback={<ScreenLoadingFallback />}><SetupWizardAdminPage /></Suspense>;
  }
  if (adminPage === "invites") {
    return <Suspense fallback={<ScreenLoadingFallback />}><InviteLinksAdminPage /></Suspense>;
  }
  if (adminPage === "guest-info") {
    return <Suspense fallback={<ScreenLoadingFallback />}><GuestInformationAdminPage /></Suspense>;
  }
  if (adminPage === "reminders") {
    return <Suspense fallback={<ScreenLoadingFallback />}><ReminderAdminPage /></Suspense>;
  }

  const playing = mode === "garden" && profile !== null;
  const quickView = mode === "invitation";

  return (
    <>
      <a className="skip-link" href="#main-content">본문 바로가기</a>
      <main
        id="main-content"
        className={`app-shell ${playing ? "app-shell--playing" : ""}${quickView ? " app-shell--quick" : ""}`}
        tabIndex={-1}
      >
        <section className={`phone-frame ${playing ? "phone-frame--playing" : ""}${quickView ? " phone-frame--quick" : ""}`}>
          {quickView ? (
            <Suspense fallback={<ScreenLoadingFallback />}>
              <QuickInvitation
                nickname={profile?.nickname ?? invitationInvite.invite?.guestName}
                canReturnToGarden={profile !== null}
                onOpenGarden={openGardenExperience}
                weddingDayPreview={weddingDayPreview}
              />
            </Suspense>
          ) : playing ? (
            <Suspense fallback={<ScreenLoadingFallback />}>
              <GameWorld
                profile={profile}
                weddingDayPreview={weddingDayPreview}
                onOpenQuickView={openQuickInvitation}
              />
            </Suspense>
          ) : (
            <EntryScreen
              onEnter={(nextProfile) => {
                trackAnalyticsModeOpen("game");
                setProfile(nextProfile);
                setMode("garden");
              }}
              onEnterIntent={() => { void loadGameWorld(); }}
              onQuickView={openQuickInvitation}
              onQuickViewIntent={() => { void loadQuickInvitation(); }}
              weddingDayPreview={weddingDayPreview}
              invitedGuest={invitationInvite.invite}
              inviteNotice={invitationInvite.notice}
            />
          )}
        </section>
      </main>
      <PwaStatusCenter playing={playing} showInstall={mode === "entry"} />
    </>
  );
}

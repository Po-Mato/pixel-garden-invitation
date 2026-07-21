import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { invitationContent } from "@wedding-game/shared";
import { EntryScreen, type EntryProfile } from "./components/EntryScreen";
import { useCoupleOrder } from "./invitation/CoupleOrderContext";
import { formatCoupleNames, formatWeddingTitle } from "./invitation/coupleOrder";
import { preloadImage } from "./performance/imagePreloader";

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
  const event = invitationContent.event;

  useEffect(() => {
    const title = formatWeddingTitle(event, coupleOrder);
    const date = event.startAt.slice(0, 10).replaceAll("-", ".");
    document.title = `${title} | ${date}`;
    updateNamedMeta('meta[property="og:title"]', title);
    updateNamedMeta('meta[name="twitter:title"]', title);
    updateNamedMeta(
      'meta[property="og:site_name"]',
      `${formatCoupleNames(event, coupleOrder)} 모바일 청첩장`
    );
  }, [coupleOrder, event]);

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
    setMode("invitation");
    if (new URLSearchParams(window.location.search).get("view") !== "invitation") {
      setInvitationUrl(true);
    }
  }, [setInvitationUrl]);

  const openGardenExperience = useCallback(() => {
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

  const searchParams = new URLSearchParams(window.location.search);
  const adminPage = searchParams.get("admin");
  const weddingDayPreview = searchParams.get("preview") === "wedding-day";
  if (adminPage === "rsvp") {
    return <Suspense fallback={<ScreenLoadingFallback />}><RsvpAdminPage /></Suspense>;
  }
  if (adminPage === "guestbook") {
    return <Suspense fallback={<ScreenLoadingFallback />}><GuestbookAdminPage /></Suspense>;
  }

  const playing = mode === "garden" && profile !== null;
  const quickView = mode === "invitation";

  return (
    <main className={`app-shell ${playing ? "app-shell--playing" : ""}${quickView ? " app-shell--quick" : ""}`}>
      <section className={`phone-frame ${playing ? "phone-frame--playing" : ""}${quickView ? " phone-frame--quick" : ""}`}>
        {quickView ? (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <QuickInvitation
              nickname={profile?.nickname}
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
              setProfile(nextProfile);
              setMode("garden");
            }}
            onEnterIntent={() => { void loadGameWorld(); }}
            onQuickView={openQuickInvitation}
            onQuickViewIntent={() => { void loadQuickInvitation(); }}
            weddingDayPreview={weddingDayPreview}
          />
        )}
      </section>
    </main>
  );
}

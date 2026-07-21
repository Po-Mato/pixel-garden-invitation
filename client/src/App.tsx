import { lazy, Suspense, useEffect, useState } from "react";
import { invitationContent } from "@wedding-game/shared";
import { EntryScreen, type EntryProfile } from "./components/EntryScreen";
import { useCoupleOrder } from "./invitation/CoupleOrderContext";
import { formatCoupleNames, formatWeddingTitle } from "./invitation/coupleOrder";
import { preloadImage } from "./performance/imagePreloader";

const homeMapUrl = `${import.meta.env.BASE_URL}assets/maps/v2/home/background.webp`;
let gameWorldModule: ReturnType<typeof importGameWorld> | undefined;

function importGameWorld() {
  return import("./components/GameWorld").then((module) => ({ default: module.GameWorld }));
}

function loadGameWorld() {
  void preloadImage(homeMapUrl, "high");
  gameWorldModule ??= importGameWorld();
  return gameWorldModule;
}

const GameWorld = lazy(loadGameWorld);
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

  const searchParams = new URLSearchParams(window.location.search);
  const adminPage = searchParams.get("admin");
  const weddingDayPreview = searchParams.get("preview") === "wedding-day";
  if (adminPage === "rsvp") {
    return <Suspense fallback={<ScreenLoadingFallback />}><RsvpAdminPage /></Suspense>;
  }
  if (adminPage === "guestbook") {
    return <Suspense fallback={<ScreenLoadingFallback />}><GuestbookAdminPage /></Suspense>;
  }

  return (
    <main className={`app-shell ${profile ? "app-shell--playing" : ""}`}>
      <section className={`phone-frame ${profile ? "phone-frame--playing" : ""}`}>
        {profile ? (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <GameWorld profile={profile} weddingDayPreview={weddingDayPreview} />
          </Suspense>
        ) : (
          <EntryScreen
            onEnter={setProfile}
            onEnterIntent={() => { void loadGameWorld(); }}
            weddingDayPreview={weddingDayPreview}
          />
        )}
      </section>
    </main>
  );
}

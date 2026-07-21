import { useEffect, useState } from "react";
import { invitationContent } from "@wedding-game/shared";
import { EntryScreen, type EntryProfile } from "./components/EntryScreen";
import { GameWorld } from "./components/GameWorld";
import { GuestbookAdminPage } from "./components/GuestbookAdminPage";
import { RsvpAdminPage } from "./components/RsvpAdminPage";
import { useCoupleOrder } from "./invitation/CoupleOrderContext";
import { formatCoupleNames, formatWeddingTitle } from "./invitation/coupleOrder";

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
    return <RsvpAdminPage />;
  }
  if (adminPage === "guestbook") return <GuestbookAdminPage />;

  return (
    <main className={`app-shell ${profile ? "app-shell--playing" : ""}`}>
      <section className={`phone-frame ${profile ? "phone-frame--playing" : ""}`}>
        {profile ? (
          <GameWorld profile={profile} weddingDayPreview={weddingDayPreview} />
        ) : (
          <EntryScreen onEnter={setProfile} weddingDayPreview={weddingDayPreview} />
        )}
      </section>
    </main>
  );
}

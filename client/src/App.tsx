import { useState } from "react";
import { EntryScreen, type EntryProfile } from "./components/EntryScreen";
import { GameWorld } from "./components/GameWorld";
import { GuestbookAdminPage } from "./components/GuestbookAdminPage";
import { RsvpAdminPage } from "./components/RsvpAdminPage";

export function App() {
  const [profile, setProfile] = useState<EntryProfile | null>(null);

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

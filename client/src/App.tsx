import { useState } from "react";
import { EntryScreen, type EntryProfile } from "./components/EntryScreen";
import { GameWorld } from "./components/GameWorld";
import { GuestbookAdminPage } from "./components/GuestbookAdminPage";
import { RsvpAdminPage } from "./components/RsvpAdminPage";

export function App() {
  const [profile, setProfile] = useState<EntryProfile | null>(null);

  const adminPage = new URLSearchParams(window.location.search).get("admin");
  if (adminPage === "rsvp") {
    return <RsvpAdminPage />;
  }
  if (adminPage === "guestbook") return <GuestbookAdminPage />;

  return (
    <main className={`app-shell ${profile ? "app-shell--playing" : ""}`}>
      <section className={`phone-frame ${profile ? "phone-frame--playing" : ""}`}>
        {profile ? <GameWorld profile={profile} /> : <EntryScreen onEnter={setProfile} />}
      </section>
    </main>
  );
}

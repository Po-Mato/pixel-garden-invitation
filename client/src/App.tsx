import { useState } from "react";
import { EntryScreen, type EntryProfile } from "./components/EntryScreen";
import { GameWorld } from "./components/GameWorld";
import { RsvpAdminPage } from "./components/RsvpAdminPage";

export function App() {
  const [profile, setProfile] = useState<EntryProfile | null>(null);

  if (new URLSearchParams(window.location.search).get("admin") === "rsvp") {
    return <RsvpAdminPage />;
  }

  return (
    <main className={`app-shell ${profile ? "app-shell--playing" : ""}`}>
      <section className={`phone-frame ${profile ? "phone-frame--playing" : ""}`}>
        {profile ? <GameWorld profile={profile} /> : <EntryScreen onEnter={setProfile} />}
      </section>
    </main>
  );
}

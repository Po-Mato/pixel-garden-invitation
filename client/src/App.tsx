import { useState } from "react";
import { EntryScreen, type EntryProfile } from "./components/EntryScreen";
import { GameWorld } from "./components/GameWorld";

export function App() {
  const [profile, setProfile] = useState<EntryProfile | null>(null);

  return (
    <main className={`app-shell ${profile ? "app-shell--playing" : ""}`}>
      <section className={`phone-frame ${profile ? "phone-frame--playing" : ""}`}>
        {profile ? <GameWorld profile={profile} /> : <EntryScreen onEnter={setProfile} />}
      </section>
    </main>
  );
}

import { useState } from "react";
import { EntryScreen, type EntryProfile } from "./components/EntryScreen";

export function App() {
  const [profile, setProfile] = useState<EntryProfile | null>(null);

  return (
    <main className="app-shell">
      <section className="phone-frame">
        {profile ? (
          <div className="entered-state">
            <h1>{profile.nickname}님, 환영합니다</h1>
            <p>정원 월드를 불러오는 중입니다.</p>
          </div>
        ) : (
          <EntryScreen onEnter={setProfile} />
        )}
      </section>
    </main>
  );
}

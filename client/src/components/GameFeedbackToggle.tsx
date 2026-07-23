import { Volume2, VolumeX } from "lucide-react";
import { useGameFeedback } from "../feedback/GameFeedbackContext";

export function GameFeedbackToggle() {
  const { preferences, setSoundEnabled } = useGameFeedback();
  const enabled = preferences.soundEnabled;
  const label = enabled ? "게임 사운드 끄기" : "게임 사운드 켜기";
  const Icon = enabled ? Volume2 : VolumeX;

  return (
    <button
      type="button"
      className="game-feedback-toggle"
      aria-label={label}
      aria-pressed={enabled}
      title={label}
      onClick={() => setSoundEnabled(!enabled)}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

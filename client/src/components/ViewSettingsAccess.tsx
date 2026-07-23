import {
  Accessibility,
  BellRing,
  Contrast,
  Hand,
  Gauge,
  Music2,
  RotateCcw,
  Settings2,
  Sparkles,
  Type,
  Vibrate,
  Volume2
} from "lucide-react";
import { useState } from "react";
import { useViewPreferences } from "../accessibility/ViewPreferencesContext";
import { useGameFeedback } from "../feedback/GameFeedbackContext";
import { BottomSheet } from "./BottomSheet";

type ViewSettingsAccessProps = {
  variant: "icon" | "menu";
  onOpenChange?: (open: boolean) => void;
};

export function ViewSettingsAccess({ variant, onOpenChange }: ViewSettingsAccessProps) {
  const [open, setOpen] = useState(false);
  const {
    preferences,
    setTextScale,
    setReduceMotion,
    setHighContrast,
    setComfortableControls,
    setDataSaver,
    enableComfortableView,
    resetPreferences
  } = useViewPreferences();
  const {
    preferences: feedbackPreferences,
    setSoundEnabled,
    setEffectsEnabled,
    setMusicEnabled,
    setHapticsEnabled,
    setVolume,
    resetFeedbackPreferences
  } = useGameFeedback();
  const comfortableViewEnabled = preferences.textScale === "xlarge"
    && preferences.reduceMotion
    && preferences.highContrast
    && preferences.comfortableControls;

  const setVisibility = (visible: boolean) => {
    setOpen(visible);
    onOpenChange?.(visible);
  };

  return (
    <>
      <button
        type="button"
        className={`view-settings-trigger view-settings-trigger--${variant}`}
        aria-label={variant === "icon" ? "환경 설정" : undefined}
        title={variant === "icon" ? "환경 설정" : undefined}
        onClick={() => setVisibility(true)}
      >
        <Settings2 aria-hidden="true" />
        {variant === "menu" ? "환경 설정" : null}
      </button>

      {open ? (
        <BottomSheet title="환경 설정" onClose={() => setVisibility(false)}>
          <div className="view-settings-sheet">
            <section className="view-settings-sheet__comfortable" aria-labelledby="comfortable-view-title">
              <header>
                <Accessibility aria-hidden="true" />
                <strong id="comfortable-view-title">편한 화면</strong>
              </header>
              <button
                type="button"
                aria-pressed={comfortableViewEnabled}
                onClick={enableComfortableView}
              >
                {comfortableViewEnabled ? "편한 화면 적용됨" : "한 번에 적용"}
              </button>
            </section>

            <section>
              <header><Type aria-hidden="true" /><strong>글자 크기</strong></header>
              <div className="view-settings-sheet__segments" role="group" aria-label="글자 크기">
                <button
                  type="button"
                  aria-pressed={preferences.textScale === "default"}
                  onClick={() => setTextScale("default")}
                >
                  기본
                </button>
                <button
                  type="button"
                  aria-pressed={preferences.textScale === "large"}
                  onClick={() => setTextScale("large")}
                >
                  크게
                </button>
                <button
                  type="button"
                  aria-pressed={preferences.textScale === "xlarge"}
                  onClick={() => setTextScale("xlarge")}
                >
                  아주 크게
                </button>
              </div>
            </section>

            <label className="view-settings-sheet__switch">
              <span><Contrast aria-hidden="true" /><strong>선명한 화면</strong></span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.highContrast}
                onChange={(event) => setHighContrast(event.target.checked)}
              />
              <span aria-hidden="true" className="view-settings-sheet__switch-track" />
            </label>

            <label className="view-settings-sheet__switch">
              <span><Hand aria-hidden="true" /><strong>큰 터치 영역</strong></span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.comfortableControls}
                onChange={(event) => setComfortableControls(event.target.checked)}
              />
              <span aria-hidden="true" className="view-settings-sheet__switch-track" />
            </label>

            <label className="view-settings-sheet__switch">
              <span><Sparkles aria-hidden="true" /><strong>움직임 줄이기</strong></span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.reduceMotion}
                onChange={(event) => setReduceMotion(event.target.checked)}
              />
              <span aria-hidden="true" className="view-settings-sheet__switch-track" />
            </label>

            <label className="view-settings-sheet__switch">
              <span><Gauge aria-hidden="true" /><strong>데이터 절약</strong></span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.dataSaver}
                onChange={(event) => setDataSaver(event.target.checked)}
              />
              <span aria-hidden="true" className="view-settings-sheet__switch-track" />
            </label>

            <section className="feedback-settings" aria-labelledby="game-sound-title">
              <header><Volume2 aria-hidden="true" /><strong id="game-sound-title">게임 사운드</strong></header>
              <label className="view-settings-sheet__switch">
                <span><Volume2 aria-hidden="true" /><strong>전체 소리</strong></span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={feedbackPreferences.soundEnabled}
                  onChange={(event) => setSoundEnabled(event.target.checked)}
                />
                <span aria-hidden="true" className="view-settings-sheet__switch-track" />
              </label>

              <label className="view-settings-sheet__switch">
                <span><BellRing aria-hidden="true" /><strong>효과음</strong></span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={feedbackPreferences.effectsEnabled}
                  onChange={(event) => setEffectsEnabled(event.target.checked)}
                />
                <span aria-hidden="true" className="view-settings-sheet__switch-track" />
              </label>

              <label className="view-settings-sheet__switch">
                <span><Music2 aria-hidden="true" /><strong>배경 음악</strong></span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={feedbackPreferences.musicEnabled}
                  onChange={(event) => setMusicEnabled(event.target.checked)}
                />
                <span aria-hidden="true" className="view-settings-sheet__switch-track" />
              </label>

              <div className="feedback-settings__volume">
                <strong>음량</strong>
                <div className="view-settings-sheet__segments" role="group" aria-label="게임 음량">
                  {([
                    ["quiet", "작게"],
                    ["balanced", "보통"],
                    ["bright", "크게"]
                  ] as const).map(([volume, label]) => (
                    <button
                      key={volume}
                      type="button"
                      aria-pressed={feedbackPreferences.volume === volume}
                      disabled={!feedbackPreferences.soundEnabled}
                      onClick={() => setVolume(volume)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <label className="view-settings-sheet__switch">
              <span><Vibrate aria-hidden="true" /><strong>진동 피드백</strong></span>
              <input
                type="checkbox"
                role="switch"
                checked={feedbackPreferences.hapticsEnabled}
                onChange={(event) => setHapticsEnabled(event.target.checked)}
              />
              <span aria-hidden="true" className="view-settings-sheet__switch-track" />
            </label>

            <button
              className="view-settings-sheet__reset"
              type="button"
              onClick={() => {
                resetPreferences();
                resetFeedbackPreferences();
              }}
            >
              <RotateCcw aria-hidden="true" />
              기본 설정으로 되돌리기
            </button>

            <p className="sr-only" aria-live="polite">
              글자 크기 {preferences.textScale === "default" ? "기본" : preferences.textScale === "large" ? "크게" : "아주 크게"},
              선명한 화면 {preferences.highContrast ? "켜짐" : "꺼짐"},
              큰 터치 영역 {preferences.comfortableControls ? "켜짐" : "꺼짐"},
              움직임 줄이기 {preferences.reduceMotion ? "켜짐" : "꺼짐"},
              데이터 절약 {preferences.dataSaver ? "켜짐" : "꺼짐"},
              전체 소리 {feedbackPreferences.soundEnabled ? "켜짐" : "꺼짐"},
              효과음 {feedbackPreferences.effectsEnabled ? "켜짐" : "꺼짐"},
              배경 음악 {feedbackPreferences.musicEnabled ? "켜짐" : "꺼짐"},
              진동 피드백 {feedbackPreferences.hapticsEnabled ? "켜짐" : "꺼짐"}
            </p>
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}

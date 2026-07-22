import { Settings2, Sparkles, Type } from "lucide-react";
import { useState } from "react";
import { useViewPreferences } from "../accessibility/ViewPreferencesContext";
import { BottomSheet } from "./BottomSheet";

type ViewSettingsAccessProps = {
  variant: "icon" | "menu";
  onOpenChange?: (open: boolean) => void;
};

export function ViewSettingsAccess({ variant, onOpenChange }: ViewSettingsAccessProps) {
  const [open, setOpen] = useState(false);
  const { preferences, setTextScale, setReduceMotion } = useViewPreferences();

  const setVisibility = (visible: boolean) => {
    setOpen(visible);
    onOpenChange?.(visible);
  };

  return (
    <>
      <button
        type="button"
        className={`view-settings-trigger view-settings-trigger--${variant}`}
        aria-label={variant === "icon" ? "보기 설정" : undefined}
        title={variant === "icon" ? "보기 설정" : undefined}
        onClick={() => setVisibility(true)}
      >
        <Settings2 aria-hidden="true" />
        {variant === "menu" ? "보기 설정" : null}
      </button>

      {open ? (
        <BottomSheet title="보기 설정" onClose={() => setVisibility(false)}>
          <div className="view-settings-sheet">
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
              </div>
            </section>

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
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}

import { ArrowLeftRight, Hand } from "lucide-react";
import { useViewPreferences } from "../accessibility/ViewPreferencesContext";

export function OneHandControlQuickToggle() {
  const {
    preferences,
    setOneHandedControls,
    setJoystickSide
  } = useViewPreferences();

  return (
    <div className="one-hand-quick-toggle" aria-label="한 손 조작 빠른 설정">
      <button
        type="button"
        aria-label={preferences.oneHandedControls ? "한 손 조작 끄기" : "한 손 조작 켜기"}
        aria-pressed={preferences.oneHandedControls}
        title={preferences.oneHandedControls ? "한 손 조작 끄기" : "한 손 조작 켜기"}
        onClick={() => setOneHandedControls(!preferences.oneHandedControls)}
      >
        <Hand aria-hidden="true" />
      </button>
      {preferences.oneHandedControls ? (
        <button
          type="button"
          aria-label={`조이스틱을 ${preferences.joystickSide === "left" ? "오른쪽" : "왼쪽"}으로 이동`}
          title={`조이스틱을 ${preferences.joystickSide === "left" ? "오른쪽" : "왼쪽"}으로 이동`}
          onClick={() => setJoystickSide(preferences.joystickSide === "left" ? "right" : "left")}
        >
          <ArrowLeftRight aria-hidden="true" />
          <span aria-hidden="true">{preferences.joystickSide === "left" ? "L" : "R"}</span>
        </button>
      ) : null}
    </div>
  );
}

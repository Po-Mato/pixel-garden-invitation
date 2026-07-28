import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameFeedbackProvider, useGameFeedback } from "./GameFeedbackContext";
import { defaultFeedbackPreferences } from "./feedbackPreferences";

const originalVibrate = navigator.vibrate;

function FeedbackHarness() {
  const {
    preferences,
    playFeedback,
    playRouteTurnHaptic,
    previewPortalDirection,
    setHapticsEnabled,
    setPortalAudio,
    setPortalHapticsEnabled
  } = useGameFeedback();
  return (
    <>
      <button type="button" onClick={() => playFeedback("reaction")}>반응 실행</button>
      <button type="button" onClick={() => setHapticsEnabled(false)}>
        진동 {preferences.hapticsEnabled ? "켜짐" : "꺼짐"}
      </button>
      <button type="button" onClick={() => setPortalHapticsEnabled(!preferences.portalHapticsEnabled)}>
        포털 진동 {preferences.portalHapticsEnabled ? "켜짐" : "꺼짐"}
      </button>
      <button type="button" onClick={() => previewPortalDirection("left")}>왼쪽 시험</button>
      <button type="button" onClick={() => playRouteTurnHaptic("down")}>아래 회전 시험</button>
      <button
        type="button"
        onClick={() => setPortalAudio({
          intensity: 0.6,
          pan: 0,
          destination: "ceremony-hall",
          direction: "up"
        })}
      >
        위쪽 추적
      </button>
    </>
  );
}

afterEach(() => {
  cleanup();
  if (originalVibrate) {
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: originalVibrate });
  } else {
    Reflect.deleteProperty(navigator, "vibrate");
  }
});

describe("GameFeedbackProvider", () => {
  it("plays haptics independently from muted audio and respects the saved toggle", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    render(
      <GameFeedbackProvider initialPreferences={defaultFeedbackPreferences}>
        <FeedbackHarness />
      </GameFeedbackProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "반응 실행" }));
    expect(vibrate).toHaveBeenCalledWith([8, 22, 8]);

    fireEvent.click(screen.getByRole("button", { name: "진동 켜짐" }));
    fireEvent.click(screen.getByRole("button", { name: "반응 실행" }));
    expect(vibrate).toHaveBeenCalledOnce();
  });

  it("previews and throttles portal direction haptics while audio is muted", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    render(
      <GameFeedbackProvider initialPreferences={defaultFeedbackPreferences}>
        <FeedbackHarness />
      </GameFeedbackProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "포털 진동 꺼짐" }));
    expect(vibrate).toHaveBeenLastCalledWith([10, 34, 10]);

    fireEvent.click(screen.getByRole("button", { name: "왼쪽 시험" }));
    expect(vibrate).toHaveBeenLastCalledWith(28);

    fireEvent.click(screen.getByRole("button", { name: "위쪽 추적" }));
    fireEvent.click(screen.getByRole("button", { name: "위쪽 추적" }));
    expect(vibrate).toHaveBeenLastCalledWith([10, 28, 22]);
    expect(vibrate).toHaveBeenCalledTimes(3);
  });

  it("plays a directional haptic before a route turn", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    render(
      <GameFeedbackProvider initialPreferences={{
        ...defaultFeedbackPreferences,
        routeHapticsEnabled: true
      }}>
        <FeedbackHarness />
      </GameFeedbackProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "아래 회전 시험" }));
    expect(vibrate).toHaveBeenCalledWith([20, 16, 8]);
  });
});

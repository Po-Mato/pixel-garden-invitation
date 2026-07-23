import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameFeedbackProvider, useGameFeedback } from "./GameFeedbackContext";
import { defaultFeedbackPreferences } from "./feedbackPreferences";

const originalVibrate = navigator.vibrate;

function FeedbackHarness() {
  const { preferences, playFeedback, setHapticsEnabled } = useGameFeedback();
  return (
    <>
      <button type="button" onClick={() => playFeedback("reaction")}>반응 실행</button>
      <button type="button" onClick={() => setHapticsEnabled(false)}>
        진동 {preferences.hapticsEnabled ? "켜짐" : "꺼짐"}
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
});

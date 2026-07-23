import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GameFeedbackProvider } from "../feedback/GameFeedbackContext";
import { defaultFeedbackPreferences } from "../feedback/feedbackPreferences";
import { GameFeedbackToggle } from "./GameFeedbackToggle";

afterEach(cleanup);

describe("GameFeedbackToggle", () => {
  it("starts muted and enables game sound from a user gesture", () => {
    render(
      <GameFeedbackProvider initialPreferences={defaultFeedbackPreferences}>
        <GameFeedbackToggle />
      </GameFeedbackProvider>
    );

    const muted = screen.getByRole("button", { name: "게임 사운드 켜기" });
    expect(muted).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(muted);

    expect(screen.getByRole("button", { name: "게임 사운드 끄기" }))
      .toHaveAttribute("aria-pressed", "true");
  });
});

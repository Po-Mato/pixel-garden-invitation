import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ViewPreferencesProvider } from "../accessibility/ViewPreferencesContext";
import { defaultViewPreferences } from "../accessibility/viewPreferences";
import { OneHandControlQuickToggle } from "./OneHandControlQuickToggle";

describe("OneHandControlQuickToggle", () => {
  it("HUD에서 한 손 모드를 켜고 조이스틱 위치를 바꾼다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <OneHandControlQuickToggle />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "한 손 조작 켜기" }));
    expect(document.documentElement).toHaveAttribute("data-one-handed-controls", "true");

    fireEvent.click(screen.getByRole("button", { name: "조이스틱을 오른쪽으로 이동" }));
    expect(document.documentElement).toHaveAttribute("data-joystick-side", "right");
  });
});

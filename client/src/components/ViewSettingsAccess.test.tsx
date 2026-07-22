import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ViewPreferencesProvider } from "../accessibility/ViewPreferencesContext";
import { defaultViewPreferences } from "../accessibility/viewPreferences";
import { ViewSettingsAccess } from "./ViewSettingsAccess";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.textScale;
  delete document.documentElement.dataset.reduceMotion;
});

describe("ViewSettingsAccess", () => {
  it("큰 글씨와 움직임 감소 설정을 즉시 적용한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="icon" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "보기 설정" }));
    fireEvent.click(screen.getByRole("button", { name: "크게" }));
    fireEvent.click(screen.getByRole("switch", { name: "움직임 줄이기" }));

    expect(screen.getByRole("button", { name: "크게" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveAttribute("data-text-scale", "large");
    expect(document.documentElement).toHaveAttribute("data-reduce-motion", "true");
  });

  it("메뉴형 진입점도 동일한 설정 시트를 연다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="menu" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "보기 설정" }));
    expect(screen.getByRole("dialog", { name: "보기 설정" })).toBeInTheDocument();
  });
});

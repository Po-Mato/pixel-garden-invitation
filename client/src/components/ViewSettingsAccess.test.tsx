import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ViewPreferencesProvider } from "../accessibility/ViewPreferencesContext";
import { defaultViewPreferences } from "../accessibility/viewPreferences";
import { GameFeedbackProvider } from "../feedback/GameFeedbackContext";
import { defaultFeedbackPreferences } from "../feedback/feedbackPreferences";
import { ViewSettingsAccess } from "./ViewSettingsAccess";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.textScale;
  delete document.documentElement.dataset.reduceMotion;
  delete document.documentElement.dataset.highContrast;
  delete document.documentElement.dataset.comfortableControls;
  delete document.documentElement.dataset.dataSaver;
});

describe("ViewSettingsAccess", () => {
  it("큰 글씨와 움직임 감소 설정을 즉시 적용한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="icon" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    const textScale = screen.getByRole("group", { name: "글자 크기" });
    fireEvent.click(within(textScale).getByRole("button", { name: "크게" }));
    fireEvent.click(screen.getByRole("switch", { name: "움직임 줄이기" }));

    expect(within(textScale).getByRole("button", { name: "크게" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveAttribute("data-text-scale", "large");
    expect(document.documentElement).toHaveAttribute("data-reduce-motion", "true");
  });

  it("편한 화면을 한 번에 적용하고 기본 설정으로 복구한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="icon" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    fireEvent.click(screen.getByRole("switch", { name: "데이터 절약" }));
    fireEvent.click(screen.getByRole("button", { name: "한 번에 적용" }));

    expect(screen.getByRole("button", { name: "아주 크게" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("switch", { name: "선명한 화면" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "큰 터치 영역" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "움직임 줄이기" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "데이터 절약" })).toBeChecked();
    expect(document.documentElement).toHaveAttribute("data-high-contrast", "true");
    expect(document.documentElement).toHaveAttribute("data-comfortable-controls", "true");

    fireEvent.click(screen.getByRole("button", { name: "기본 설정으로 되돌리기" }));
    expect(screen.getByRole("button", { name: "기본" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).not.toHaveAttribute("data-high-contrast");
    expect(document.documentElement).not.toHaveAttribute("data-comfortable-controls");
  });

  it("메뉴형 진입점도 동일한 설정 시트를 연다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="menu" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    expect(screen.getByRole("dialog", { name: "환경 설정" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "기기 성능 최적화 상태" })).toHaveTextContent("표준 화면 효과 적용");
  });

  it("데이터 절약 설정을 즉시 적용한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="icon" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    fireEvent.click(screen.getByRole("switch", { name: "데이터 절약" }));

    expect(screen.getByRole("switch", { name: "데이터 절약" })).toBeChecked();
    expect(document.documentElement).toHaveAttribute("data-data-saver", "true");
  });

  it("게임 소리와 진동을 각각 설정하고 음량을 미리 선택한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <GameFeedbackProvider initialPreferences={defaultFeedbackPreferences}>
          <ViewSettingsAccess variant="icon" />
        </GameFeedbackProvider>
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    expect(screen.getByRole("switch", { name: "전체 소리" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "효과음" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "배경 음악" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "진동 피드백" })).toBeChecked();
    const volume = screen.getByRole("group", { name: "게임 음량" });
    expect(within(volume).getByRole("button", { name: "보통" })).toBeDisabled();

    fireEvent.click(screen.getByRole("switch", { name: "전체 소리" }));
    fireEvent.click(within(volume).getByRole("button", { name: "크게" }));
    fireEvent.click(screen.getByRole("switch", { name: "효과음" }));
    fireEvent.click(screen.getByRole("switch", { name: "배경 음악" }));
    fireEvent.click(screen.getByRole("switch", { name: "진동 피드백" }));

    expect(screen.getByRole("switch", { name: "전체 소리" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "효과음" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "배경 음악" })).not.toBeChecked();
    expect(within(volume).getByRole("button", { name: "크게" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("switch", { name: "진동 피드백" })).not.toBeChecked();
  });
});

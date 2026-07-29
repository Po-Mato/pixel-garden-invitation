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
  delete document.documentElement.dataset.oneHandedControls;
  delete document.documentElement.dataset.joystickSide;
  delete document.documentElement.dataset.dataSaver;
  delete document.documentElement.dataset.miniMapHighContrast;
  delete document.documentElement.dataset.miniMapRouteWeight;
  delete document.documentElement.dataset.routePattern;
  delete document.documentElement.dataset.gameMovementSpeed;
  delete document.documentElement.dataset.gameUiScale;
  delete document.documentElement.dataset.colorVision;
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
    expect(screen.getByRole("switch", { name: "큰 조이스틱·터치 영역" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "계단 없는 길 우선" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "미니맵 고대비" })).toBeChecked();
    expect(screen.getByRole("button", { name: "굵게" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("switch", { name: "경로 선 패턴 강화" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "움직임 줄이기" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "데이터 절약" })).toBeChecked();
    expect(within(screen.getByRole("group", { name: "게임 이동 속도" }))
      .getByRole("button", { name: "느긋하게" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "게임 UI 크기" }))
      .getByRole("button", { name: "크게" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveAttribute("data-high-contrast", "true");
    expect(document.documentElement).toHaveAttribute("data-comfortable-controls", "true");

    fireEvent.click(screen.getByRole("button", { name: "기본 설정으로 되돌리기" }));
    expect(within(screen.getByRole("group", { name: "글자 크기" }))
      .getByRole("button", { name: "기본" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).not.toHaveAttribute("data-high-contrast");
    expect(document.documentElement).not.toHaveAttribute("data-comfortable-controls");
  });

  it("게임 이동 속도와 UI 크기를 간편하게 바꾼다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="icon" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    fireEvent.click(within(screen.getByRole("group", { name: "게임 이동 속도" }))
      .getByRole("button", { name: "빠르게" }));
    fireEvent.click(within(screen.getByRole("group", { name: "게임 UI 크기" }))
      .getByRole("button", { name: "크게" }));

    expect(document.documentElement).toHaveAttribute("data-game-movement-speed", "brisk");
    expect(document.documentElement).toHaveAttribute("data-game-ui-scale", "large");
  });

  it("미니맵 대비와 경로 굵기를 즉시 설정한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="icon" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    fireEvent.click(screen.getByRole("switch", { name: "미니맵 고대비" }));
    const routeWeight = screen.getByRole("group", { name: "미니맵 경로 굵기" });
    fireEvent.click(within(routeWeight).getByRole("button", { name: "굵게" }));
    fireEvent.click(screen.getByRole("switch", { name: "경로 선 패턴 강화" }));

    expect(document.documentElement).toHaveAttribute("data-mini-map-high-contrast", "true");
    expect(document.documentElement).toHaveAttribute("data-mini-map-route-weight", "bold");
    expect(document.documentElement).toHaveAttribute("data-route-pattern", "enhanced");
  });

  it("계단 없는 길 우선 설정을 저장 상태에 반영한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="icon" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    const control = screen.getByRole("switch", { name: "계단 없는 길 우선" });
    fireEvent.click(control);
    expect(control).toBeChecked();
  });

  it("한 손 조작과 조이스틱 좌우 위치를 즉시 적용한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="icon" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    fireEvent.click(screen.getByRole("switch", { name: "한 손 조작 모드" }));
    const position = screen.getByRole("group", { name: "조이스틱 위치" });
    fireEvent.click(within(position).getByRole("button", { name: "오른쪽" }));

    expect(document.documentElement).toHaveAttribute("data-one-handed-controls", "true");
    expect(document.documentElement).toHaveAttribute("data-joystick-side", "right");
    expect(within(position).getByRole("button", { name: "오른쪽" })).toHaveAttribute("aria-pressed", "true");
  });

  it("메뉴형 진입점도 동일한 설정 시트를 연다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="menu" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    expect(screen.getByRole("dialog", { name: "환경 설정" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "기기 성능 최적화 상태" })).toHaveTextContent("전체 화면 효과 적용");
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

  it("길찾기 음성 속도와 목적지별 진동을 설정한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <GameFeedbackProvider initialPreferences={defaultFeedbackPreferences}>
          <ViewSettingsAccess variant="icon" />
        </GameFeedbackProvider>
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    const voiceRate = screen.getByRole("group", { name: "길찾기 음성 속도" });
    const voiceDetail = screen.getByRole("group", { name: "길찾기 음성 안내 내용" });
    expect(within(voiceRate).getByRole("button", { name: "빠르게" })).toBeDisabled();
    expect(within(voiceDetail).getByRole("button", { name: "구역 포함" })).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "길찾기 음성 안내" }));
    fireEvent.click(within(voiceRate).getByRole("button", { name: "빠르게" }));
    fireEvent.click(within(voiceDetail).getByRole("button", { name: "구역 포함" }));
    fireEvent.click(screen.getByRole("switch", { name: "목적지별 안내 진동" }));

    expect(within(voiceRate).getByRole("button", { name: "빠르게" })).toHaveAttribute("aria-pressed", "true");
    expect(within(voiceDetail).getByRole("button", { name: "구역 포함" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("switch", { name: "목적지별 안내 진동" })).toBeChecked();
  });

  it("색각 보정 모드를 문서 전체에 적용한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={defaultViewPreferences}>
        <ViewSettingsAccess variant="icon" />
      </ViewPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));
    const colorVision = screen.getByRole("group", { name: "색각 보정 모드" });
    fireEvent.click(within(colorVision).getByRole("button", { name: "녹색 보정" }));

    expect(document.documentElement).toHaveAttribute("data-color-vision", "deuteranopia");
    expect(within(colorVision).getByRole("button", { name: "녹색 보정" }))
      .toHaveAttribute("aria-pressed", "true");
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
    expect(screen.getByRole("switch", { name: "배경 음악·공간음" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "포털 안내음" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "모노 방향 안내" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "포털 방향 진동" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "진동 피드백" })).toBeChecked();
    const volume = screen.getByRole("group", { name: "게임 음량" });
    const footstepVolume = screen.getByRole("group", { name: "발소리 강도" });
    const portalVolume = screen.getByRole("group", { name: "포털 안내음 강도" });
    const portalDirections = screen.getByRole("group", { name: "포털 방향 안내 시험" });
    const portalPreview = screen.getByRole("button", { name: "안내음 미리듣기" });
    expect(within(volume).getByRole("button", { name: "보통" })).toBeDisabled();
    expect(within(footstepVolume).getByRole("button", { name: "보통" })).toBeDisabled();
    expect(within(portalVolume).getByRole("button", { name: "보통" })).toBeDisabled();
    expect(portalPreview).toBeDisabled();
    expect(within(portalDirections).getByRole("button", { name: "위쪽 안내 시험" })).toBeDisabled();

    fireEvent.click(screen.getByRole("switch", { name: "전체 소리" }));
    fireEvent.click(screen.getByRole("switch", { name: "모노 방향 안내" }));
    expect(within(portalDirections).getByRole("button", { name: "위쪽 안내 시험" })).toBeEnabled();
    fireEvent.click(within(portalDirections).getByRole("button", { name: "위쪽 안내 시험" }));
    fireEvent.click(screen.getByRole("switch", { name: "포털 방향 진동" }));
    fireEvent.click(within(volume).getByRole("button", { name: "크게" }));
    fireEvent.click(within(footstepVolume).getByRole("button", { name: "강하게" }));
    fireEvent.click(within(portalVolume).getByRole("button", { name: "선명하게" }));
    fireEvent.click(portalPreview);
    fireEvent.click(screen.getByRole("switch", { name: "포털 안내음" }));
    fireEvent.click(screen.getByRole("switch", { name: "효과음" }));
    fireEvent.click(screen.getByRole("switch", { name: "배경 음악·공간음" }));
    fireEvent.click(screen.getByRole("switch", { name: "진동 피드백" }));

    expect(screen.getByRole("switch", { name: "전체 소리" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "효과음" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "배경 음악·공간음" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "포털 안내음" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "모노 방향 안내" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "포털 방향 진동" })).toBeChecked();
    expect(within(volume).getByRole("button", { name: "크게" })).toHaveAttribute("aria-pressed", "true");
    expect(within(footstepVolume).getByRole("button", { name: "강하게" })).toHaveAttribute("aria-pressed", "true");
    expect(within(footstepVolume).getByRole("button", { name: "강하게" })).toBeDisabled();
    expect(within(portalVolume).getByRole("button", { name: "선명하게" })).toHaveAttribute("aria-pressed", "true");
    expect(within(portalVolume).getByRole("button", { name: "선명하게" })).toBeDisabled();
    expect(portalPreview).toBeDisabled();
    expect(screen.getByRole("switch", { name: "진동 피드백" })).not.toBeChecked();
    expect(within(portalDirections).getByRole("button", { name: "위쪽 안내 시험" })).toBeDisabled();
  });
});

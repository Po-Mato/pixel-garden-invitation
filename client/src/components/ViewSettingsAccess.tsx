import {
  Accessibility,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BellRing,
  Circle,
  Contrast,
  Cpu,
  Footprints,
  Hand,
  Gauge,
  Music2,
  MapPinned,
  Navigation,
  Palette,
  Play,
  RadioTower,
  RotateCcw,
  Settings2,
  Sparkles,
  Type,
  Vibrate,
  Volume2
} from "lucide-react";
import { useState } from "react";
import { useViewPreferences } from "../accessibility/ViewPreferencesContext";
import { speakRouteVoiceMessage } from "../accessibility/routeVoiceGuidance";
import { useGameFeedback } from "../feedback/GameFeedbackContext";
import { useDevicePerformance } from "../performance/DevicePerformanceContext";
import { BottomSheet } from "./BottomSheet";

type ViewSettingsAccessProps = {
  variant: "icon" | "menu";
  onOpenChange?: (open: boolean) => void;
};

export function ViewSettingsAccess({ variant, onOpenChange }: ViewSettingsAccessProps) {
  const [open, setOpen] = useState(false);
  const devicePerformance = useDevicePerformance();
  const {
    preferences,
    setTextScale,
    setReduceMotion,
    setHighContrast,
    setComfortableControls,
    setOneHandedControls,
    setJoystickSide,
    setDataSaver,
    setRouteVoiceGuidance,
    setRouteVoiceRate,
    setRouteVoiceDetail,
    setColorVisionMode,
    setStepFreeRouteEnabled,
    setMiniMapHighContrast,
    setMiniMapRouteWeight,
    setRoutePatternEnhanced,
    setGameMovementSpeed,
    setGameUiScale,
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
    setFootstepVolume,
    setPortalAudioEnabled,
    setPortalAudioVolume,
    setPortalMonoEnabled,
    setPortalHapticsEnabled,
    setRouteHapticsEnabled,
    previewPortalAudio,
    previewPortalDirection,
    resetFeedbackPreferences
  } = useGameFeedback();
  const comfortableViewEnabled = preferences.textScale === "xlarge"
    && preferences.reduceMotion
    && preferences.highContrast
    && preferences.comfortableControls
    && preferences.oneHandedControls
    && preferences.joystickSide === "left"
    && preferences.miniMapHighContrast
    && preferences.miniMapRouteWeight === "bold"
    && preferences.routePatternEnhanced
    && preferences.gameMovementSpeed === "relaxed"
    && preferences.gameUiScale === "large";
  const portalDirectionAudioReady = feedbackPreferences.soundEnabled
    && feedbackPreferences.effectsEnabled
    && feedbackPreferences.portalAudioEnabled
    && feedbackPreferences.portalMonoEnabled;
  const portalDirectionHapticsReady = feedbackPreferences.hapticsEnabled
    && feedbackPreferences.portalHapticsEnabled;

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

            <section>
              <header><Palette aria-hidden="true" /><strong>색각 보정</strong></header>
              <div
                className="view-settings-sheet__segments view-settings-sheet__segments--four"
                role="group"
                aria-label="색각 보정 모드"
              >
                {([
                  ["standard", "기본"],
                  ["deuteranopia", "녹색 보정"],
                  ["protanopia", "적색 보정"],
                  ["tritanopia", "청색 보정"]
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={preferences.colorVisionMode === mode}
                    onClick={() => setColorVisionMode(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <label className="view-settings-sheet__switch">
                <span><Hand aria-hidden="true" /><strong>큰 조이스틱·터치 영역</strong></span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.comfortableControls}
                onChange={(event) => setComfortableControls(event.target.checked)}
              />
              <span aria-hidden="true" className="view-settings-sheet__switch-track" />
            </label>

            <label className="view-settings-sheet__switch">
              <span><Hand aria-hidden="true" /><strong>한 손 조작 모드</strong></span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.oneHandedControls}
                onChange={(event) => setOneHandedControls(event.target.checked)}
              />
              <span aria-hidden="true" className="view-settings-sheet__switch-track" />
            </label>

            <div className="feedback-settings__volume">
              <strong>조이스틱 위치</strong>
              <div className="view-settings-sheet__segments" role="group" aria-label="조이스틱 위치">
                <button
                  type="button"
                  aria-pressed={preferences.joystickSide === "left"}
                  onClick={() => setJoystickSide("left")}
                >
                  왼쪽
                </button>
                <button
                  type="button"
                  aria-pressed={preferences.joystickSide === "right"}
                  onClick={() => setJoystickSide("right")}
                >
                  오른쪽
                </button>
              </div>
            </div>

            <div className="feedback-settings__volume">
              <strong>게임 이동 속도</strong>
              <div className="view-settings-sheet__segments" role="group" aria-label="게임 이동 속도">
                {([[
                  "relaxed", "느긋하게"
                ], [
                  "normal", "보통"
                ], [
                  "brisk", "빠르게"
                ]] as const).map(([speed, label]) => (
                  <button
                    key={speed}
                    type="button"
                    aria-pressed={preferences.gameMovementSpeed === speed}
                    onClick={() => setGameMovementSpeed(speed)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="feedback-settings__volume">
              <strong>게임 UI 크기</strong>
              <div className="view-settings-sheet__segments" role="group" aria-label="게임 UI 크기">
                <button
                  type="button"
                  aria-pressed={preferences.gameUiScale === "standard"}
                  onClick={() => setGameUiScale("standard")}
                >
                  기본
                </button>
                <button
                  type="button"
                  aria-pressed={preferences.gameUiScale === "large"}
                  onClick={() => setGameUiScale("large")}
                >
                  크게
                </button>
              </div>
            </div>

            <label className="view-settings-sheet__switch">
              <span><Navigation aria-hidden="true" /><strong>길찾기 음성 안내</strong></span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.routeVoiceGuidance}
                onChange={(event) => setRouteVoiceGuidance(event.target.checked)}
              />
              <span aria-hidden="true" className="view-settings-sheet__switch-track" />
            </label>

            <label className="view-settings-sheet__switch">
              <span><Accessibility aria-hidden="true" /><strong>계단 없는 길 우선</strong></span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.stepFreeRouteEnabled}
                onChange={(event) => setStepFreeRouteEnabled(event.target.checked)}
              />
              <span aria-hidden="true" className="view-settings-sheet__switch-track" />
            </label>

            <label className="view-settings-sheet__switch">
              <span><MapPinned aria-hidden="true" /><strong>미니맵 고대비</strong></span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.miniMapHighContrast}
                onChange={(event) => setMiniMapHighContrast(event.target.checked)}
              />
              <span aria-hidden="true" className="view-settings-sheet__switch-track" />
            </label>

            <div className="feedback-settings__volume">
              <strong>미니맵 경로 굵기</strong>
              <div className="view-settings-sheet__segments" role="group" aria-label="미니맵 경로 굵기">
                <button
                  type="button"
                  aria-pressed={preferences.miniMapRouteWeight === "standard"}
                  onClick={() => setMiniMapRouteWeight("standard")}
                >
                  기본
                </button>
                <button
                  type="button"
                  aria-pressed={preferences.miniMapRouteWeight === "bold"}
                  onClick={() => setMiniMapRouteWeight("bold")}
                >
                  굵게
                </button>
              </div>
            </div>

            <label className="view-settings-sheet__switch">
              <span><Navigation aria-hidden="true" /><strong>경로 선 패턴 강화</strong></span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.routePatternEnhanced}
                onChange={(event) => setRoutePatternEnhanced(event.target.checked)}
              />
              <span aria-hidden="true" className="view-settings-sheet__switch-track" />
            </label>

            <div className="feedback-settings__volume">
              <strong>음성 안내 속도</strong>
              <div className="view-settings-sheet__segments" role="group" aria-label="길찾기 음성 속도">
                {([[
                  "slow", "느리게"
                ], [
                  "normal", "보통"
                ], [
                  "fast", "빠르게"
                ]] as const).map(([rate, label]) => (
                  <button
                    key={rate}
                    type="button"
                    aria-pressed={preferences.routeVoiceRate === rate}
                    disabled={!preferences.routeVoiceGuidance}
                    onClick={() => setRouteVoiceRate(rate)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="feedback-settings__volume">
              <strong>음성 안내 내용</strong>
              <div className="view-settings-sheet__segments" role="group" aria-label="길찾기 음성 안내 내용">
                <button
                  type="button"
                  aria-pressed={preferences.routeVoiceDetail === "brief"}
                  disabled={!preferences.routeVoiceGuidance}
                  onClick={() => setRouteVoiceDetail("brief")}
                >
                  간단히
                </button>
                <button
                  type="button"
                  aria-pressed={preferences.routeVoiceDetail === "detailed"}
                  disabled={!preferences.routeVoiceGuidance}
                  onClick={() => setRouteVoiceDetail("detailed")}
                >
                  구역 포함
                </button>
              </div>
            </div>

            <button
              className="view-settings-sheet__reset"
              type="button"
              disabled={!preferences.routeVoiceGuidance}
              onClick={() => speakRouteVoiceMessage({
                message: "오른쪽으로 이동한 뒤 목적지에 도착합니다.",
                rate: preferences.routeVoiceRate,
                detail: preferences.routeVoiceDetail,
                zoneLabel: "예식장 로비"
              })}
            >
              <Play aria-hidden="true" />
              길찾기 음성 시험
            </button>

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

            <section className="device-performance-status" data-mode={devicePerformance.mode} aria-label="기기 성능 최적화 상태">
              <Cpu aria-hidden="true" />
              <span>
                <strong>{devicePerformance.mode === "lite" ? "가벼운 화면 자동 적용" : "표준 화면 효과 적용"}</strong>
                <small>{devicePerformance.mode === "lite"
                  ? devicePerformance.reason === "memory"
                    ? "메모리 사용량을 줄이고 있어요"
                    : devicePerformance.reason === "processor"
                      ? "장식 애니메이션을 줄이고 있어요"
                      : devicePerformance.reason === "frame-rate"
                        ? "프레임 저하를 감지해 화면 효과를 자동 조절했어요"
                        : "느린 연결에 맞춰 화면 효과를 줄이고 있어요"
                  : "현재 기기에서 전체 화면 효과를 사용해요"}</small>
                <small>{devicePerformance.tuningSource === "observed"
                  ? `실사용 성능 표본 ${devicePerformance.tuningSampleCount}개로 자동 기준을 보정했어요`
                  : "안정적인 기본 성능 기준을 사용하고 있어요"}</small>
              </span>
            </section>

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
                <span><Music2 aria-hidden="true" /><strong>배경 음악·공간음</strong></span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={feedbackPreferences.musicEnabled}
                  onChange={(event) => setMusicEnabled(event.target.checked)}
                />
                <span aria-hidden="true" className="view-settings-sheet__switch-track" />
              </label>

              <label className="view-settings-sheet__switch">
                <span><RadioTower aria-hidden="true" /><strong>포털 안내음</strong></span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={feedbackPreferences.portalAudioEnabled}
                  onChange={(event) => setPortalAudioEnabled(event.target.checked)}
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

              <div className="feedback-settings__volume">
                <span className="feedback-settings__volume-label">
                  <Footprints aria-hidden="true" />
                  <strong>발소리 강도</strong>
                </span>
                <div className="view-settings-sheet__segments" role="group" aria-label="발소리 강도">
                  {([
                    ["quiet", "약하게"],
                    ["balanced", "보통"],
                    ["bright", "강하게"]
                  ] as const).map(([volume, label]) => (
                    <button
                      key={volume}
                      type="button"
                      aria-pressed={feedbackPreferences.footstepVolume === volume}
                      disabled={!feedbackPreferences.soundEnabled || !feedbackPreferences.effectsEnabled}
                      onClick={() => setFootstepVolume(volume)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="feedback-settings__volume">
                <span className="feedback-settings__volume-label">
                  <RadioTower aria-hidden="true" />
                  <strong>포털 안내음 강도</strong>
                </span>
                <div className="view-settings-sheet__segments" role="group" aria-label="포털 안내음 강도">
                  {([
                    ["quiet", "약하게"],
                    ["balanced", "보통"],
                    ["bright", "선명하게"]
                  ] as const).map(([volume, label]) => (
                    <button
                      key={volume}
                      type="button"
                      aria-pressed={feedbackPreferences.portalAudioVolume === volume}
                      disabled={!feedbackPreferences.soundEnabled
                        || !feedbackPreferences.effectsEnabled
                        || !feedbackPreferences.portalAudioEnabled}
                      onClick={() => setPortalAudioVolume(volume)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="view-settings-sheet__reset"
                type="button"
                disabled={!feedbackPreferences.soundEnabled
                  || !feedbackPreferences.effectsEnabled
                  || !feedbackPreferences.portalAudioEnabled}
                onClick={previewPortalAudio}
              >
                <Play aria-hidden="true" />
                안내음 미리듣기
              </button>
            </section>

            <section className="feedback-settings" aria-labelledby="portal-accessibility-title">
              <header>
                <Accessibility aria-hidden="true" />
                <strong id="portal-accessibility-title">포털 접근성</strong>
              </header>

              <label className="view-settings-sheet__switch">
                <span><Volume2 aria-hidden="true" /><strong>모노 방향 안내</strong></span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={feedbackPreferences.portalMonoEnabled}
                  onChange={(event) => setPortalMonoEnabled(event.target.checked)}
                />
                <span aria-hidden="true" className="view-settings-sheet__switch-track" />
              </label>

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

              <label className="view-settings-sheet__switch">
                <span><RadioTower aria-hidden="true" /><strong>포털 방향 진동</strong></span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={feedbackPreferences.portalHapticsEnabled}
                  onChange={(event) => setPortalHapticsEnabled(event.target.checked)}
                />
                <span aria-hidden="true" className="view-settings-sheet__switch-track" />
              </label>

              <label className="view-settings-sheet__switch">
                <span><MapPinned aria-hidden="true" /><strong>목적지별 안내 진동</strong></span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={feedbackPreferences.routeHapticsEnabled}
                  onChange={(event) => setRouteHapticsEnabled(event.target.checked)}
                />
                <span aria-hidden="true" className="view-settings-sheet__switch-track" />
              </label>

              <div className="feedback-settings__volume">
                <strong>방향 안내 시험</strong>
                <div
                  className="view-settings-sheet__segments"
                  role="group"
                  aria-label="포털 방향 안내 시험"
                >
                  {([
                    ["left", "왼쪽 안내 시험", ArrowLeft],
                    ["up", "위쪽 안내 시험", ArrowUp],
                    ["right", "오른쪽 안내 시험", ArrowRight],
                    ["down", "아래쪽 안내 시험", ArrowDown],
                    ["arrived", "도착 안내 시험", Circle]
                  ] as const).map(([direction, label, Icon]) => (
                    <button
                      key={direction}
                      type="button"
                      aria-label={label}
                      title={label}
                      disabled={!portalDirectionAudioReady && !portalDirectionHapticsReady}
                      onClick={() => previewPortalDirection(direction)}
                    >
                      <Icon aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            </section>

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
              한 손 조작 {preferences.oneHandedControls ? "켜짐" : "꺼짐"},
              조이스틱 위치 {preferences.joystickSide === "left" ? "왼쪽" : "오른쪽"},
              길찾기 음성 안내 {preferences.routeVoiceGuidance ? "켜짐" : "꺼짐"},
              음성 안내 속도 {preferences.routeVoiceRate === "slow" ? "느리게" : preferences.routeVoiceRate === "fast" ? "빠르게" : "보통"},
              음성 안내 내용 {preferences.routeVoiceDetail === "detailed" ? "구역 포함" : "간단히"},
              색각 보정 {preferences.colorVisionMode === "standard" ? "기본" : preferences.colorVisionMode},
              계단 없는 길 우선 {preferences.stepFreeRouteEnabled ? "켜짐" : "꺼짐"},
              미니맵 고대비 {preferences.miniMapHighContrast ? "켜짐" : "꺼짐"},
              미니맵 경로 굵기 {preferences.miniMapRouteWeight === "bold" ? "굵게" : "기본"},
              경로 선 패턴 강화 {preferences.routePatternEnhanced ? "켜짐" : "꺼짐"},
              움직임 줄이기 {preferences.reduceMotion ? "켜짐" : "꺼짐"},
              데이터 절약 {preferences.dataSaver ? "켜짐" : "꺼짐"},
              전체 소리 {feedbackPreferences.soundEnabled ? "켜짐" : "꺼짐"},
              효과음 {feedbackPreferences.effectsEnabled ? "켜짐" : "꺼짐"},
              배경 음악과 공간음 {feedbackPreferences.musicEnabled ? "켜짐" : "꺼짐"},
              발소리 강도 {feedbackPreferences.footstepVolume === "quiet"
                ? "약하게"
                : feedbackPreferences.footstepVolume === "balanced" ? "보통" : "강하게"},
              포털 안내음 {feedbackPreferences.portalAudioEnabled ? "켜짐" : "꺼짐"},
              포털 안내음 강도 {feedbackPreferences.portalAudioVolume === "quiet"
                ? "약하게"
                : feedbackPreferences.portalAudioVolume === "balanced" ? "보통" : "선명하게"},
              모노 방향 안내 {feedbackPreferences.portalMonoEnabled ? "켜짐" : "꺼짐"},
              진동 피드백 {feedbackPreferences.hapticsEnabled ? "켜짐" : "꺼짐"},
              포털 방향 진동 {feedbackPreferences.portalHapticsEnabled ? "켜짐" : "꺼짐"},
              목적지별 안내 진동 {feedbackPreferences.routeHapticsEnabled ? "켜짐" : "꺼짐"}
            </p>
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}

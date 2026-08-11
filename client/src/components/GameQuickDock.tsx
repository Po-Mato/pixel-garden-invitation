import { useEffect, useState, type RefObject } from "react";
import { Bell, BookOpen, Check, RotateCcw, Route, Share2, SlidersHorizontal, SmilePlus, Volume2, X } from "lucide-react";
import type { GuestReaction } from "@wedding-game/shared";
import {
  clearGameQuickDockSyncQuery,
  createGameQuickDockSyncUrl,
  gameQuickDockActions,
  gameQuickDockActionsFromUrl,
  gameQuickDockStorageKey,
  loadGameQuickDockActions,
  resetGameQuickDockActions,
  saveGameQuickDockActions,
  toggleGameQuickDockAction,
  type GameQuickDockAction
} from "../game/gameQuickDockPreferences";
import { resolveAdaptiveQuickDockActions } from "../game/gameAdaptiveHud";
import { copyText, isShareAbortError, shareContent } from "../invitation/browserActions";
import { GameFeedbackToggle } from "./GameFeedbackToggle";
import { GuestInformationAccess } from "./GuestInformationAccess";
import { GuestReactionDock } from "./GuestReactions";

type GameQuickDockProps = {
  disabled?: boolean;
  menuOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement>;
  onPause: () => void;
  onReact: (reaction: GuestReaction) => void;
  onGuestInformationOpenChange: (open: boolean) => void;
  onOpenJourney: () => void;
  onOpenMenu: () => void;
  onSettingsOpenChange?: (open: boolean) => void;
  settingsOpen?: boolean;
  showSettingsTrigger?: boolean;
  contextActive?: boolean;
  moving?: boolean;
  routeActive?: boolean;
};

const actionMeta: Record<GameQuickDockAction, { label: string; Icon: typeof SmilePlus }> = {
  reaction: { label: "리액션", Icon: SmilePlus },
  guide: { label: "공지·FAQ", Icon: Bell },
  journey: { label: "여정", Icon: Route },
  sound: { label: "사운드", Icon: Volume2 }
};

export function GameQuickDock({
  disabled = false,
  menuOpen,
  menuButtonRef,
  onPause,
  onReact,
  onGuestInformationOpenChange,
  onOpenJourney,
  onOpenMenu,
  onSettingsOpenChange,
  settingsOpen: controlledSettingsOpen,
  showSettingsTrigger = true,
  contextActive = false,
  moving = false,
  routeActive = false
}: GameQuickDockProps) {
  const [favorites, setFavorites] = useState(loadGameQuickDockActions);
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const settingsOpen = controlledSettingsOpen ?? internalSettingsOpen;
  const [syncStatus, setSyncStatus] = useState("");
  const adaptiveDock = resolveAdaptiveQuickDockActions({ favorites, contextActive, moving, routeActive });
  const visibleFavorites = settingsOpen
    ? favorites
    : routeActive ? adaptiveDock.actions.filter((action) => action === "journey") : [];
  const setSettingsVisibility = (open: boolean) => {
    if (controlledSettingsOpen === undefined) setInternalSettingsOpen(open);
    onSettingsOpenChange?.(open);
  };

  useEffect(() => {
    saveGameQuickDockActions(favorites);
  }, [favorites]);

  useEffect(() => {
    if (disabled || menuOpen) setSettingsVisibility(false);
  }, [disabled, menuOpen]);

  useEffect(() => {
    return () => onSettingsOpenChange?.(false);
  }, [onSettingsOpenChange]);

  useEffect(() => {
    const imported = gameQuickDockActionsFromUrl();
    if (!imported) return;
    setFavorites(imported);
    saveGameQuickDockActions(imported);
    window.history.replaceState({}, "", clearGameQuickDockSyncQuery());
    setSyncStatus("다른 기기의 빠른 도구 설정을 적용했어요");
  }, []);

  useEffect(() => {
    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key !== gameQuickDockStorageKey) return;
      setFavorites(loadGameQuickDockActions());
      setSyncStatus("다른 탭의 설정을 반영했어요");
    };
    window.addEventListener("storage", syncAcrossTabs);
    return () => window.removeEventListener("storage", syncAcrossTabs);
  }, []);

  const shareDockSettings = async () => {
    const url = createGameQuickDockSyncUrl(favorites);
    try {
      await shareContent({ title: "모바일 청첩장 빠른 도구", text: "다른 기기에 같은 빠른 도구 설정을 적용해요.", url });
      setSyncStatus("설정 링크를 공유했어요");
    } catch (error) {
      if (isShareAbortError(error)) return;
      try {
        await copyText(url);
        setSyncStatus("설정 링크를 복사했어요");
      } catch {
        setSyncStatus("설정 링크를 만들지 못했어요");
      }
    }
  };

  const renderAction = (action: GameQuickDockAction) => {
    if (action === "reaction") {
      return <GuestReactionDock key={action} disabled={disabled} onReact={onReact} />;
    }
    if (action === "guide") {
      return <GuestInformationAccess key={action} variant="world" onOpenChange={onGuestInformationOpenChange} />;
    }
    if (action === "sound") {
      return <GameFeedbackToggle key={action} />;
    }
    return (
      <button
        key={action}
        type="button"
        className="game-quick-dock__journey"
        aria-label="여정 도구 열기"
        title="여정"
        disabled={disabled}
        onClick={() => {
          onPause();
          onOpenJourney();
        }}
      >
        <Route aria-hidden="true" />
      </button>
    );
  };

  return (
    <div
      className="game-quick-dock"
      data-settings-open={settingsOpen || undefined}
      data-adaptive-state={settingsOpen ? "settings" : adaptiveDock.state}
    >
      {settingsOpen ? (
        <section className="game-quick-dock__settings" aria-label="게임 도구 보관함">
          <header>
            <strong>게임 도구</strong>
            <span>선택 {favorites.length}/2</span>
            <button type="button" aria-label="게임 도구 닫기" onClick={() => setSettingsVisibility(false)}>
              <X aria-hidden="true" />
            </button>
          </header>
          <p className="game-quick-dock__settings-description">필요한 기능만 아래 도크에 꺼내 쓰세요.</p>
          <div>
            {gameQuickDockActions.map((action) => {
              const { label, Icon } = actionMeta[action];
              return (
                <button
                  key={action}
                  type="button"
                  aria-pressed={favorites.includes(action)}
                  onClick={() => setFavorites((current) => toggleGameQuickDockAction(current, action))}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <footer>
            <button
              type="button"
              onClick={() => {
                setFavorites(resetGameQuickDockActions());
                setSyncStatus("기본 빠른 도구로 복원했어요");
              }}
            ><RotateCcw aria-hidden="true" /><span>기본값</span></button>
            <button type="button" onClick={() => void shareDockSettings()}>
              <Share2 aria-hidden="true" /><span>도구 옮기기</span>
            </button>
          </footer>
          {syncStatus ? <p role="status"><Check aria-hidden="true" />{syncStatus}</p> : null}
        </section>
      ) : null}
      <div className="game-quick-dock__favorites world-control-actions" aria-label="즐겨찾기 빠른 도구">
        {visibleFavorites.map(renderAction)}
      </div>
      {showSettingsTrigger ? (
        <button
          type="button"
          className="game-quick-dock__settings-toggle"
          aria-label={settingsOpen ? "게임 도구 닫기" : "게임 도구 열기"}
          aria-expanded={settingsOpen}
          title="게임 도구"
          onClick={() => {
            onPause();
            setSettingsVisibility(!settingsOpen);
          }}
        >
          <SlidersHorizontal aria-hidden="true" />
        </button>
      ) : null}
      <button
        ref={menuButtonRef}
        type="button"
        className="world-menu-button"
        aria-label="초대장 메뉴"
        aria-expanded={menuOpen}
        title="초대장 메뉴"
        onClick={onOpenMenu}
      >
        <span className="game-quick-dock__menu-icon" aria-hidden="true"><BookOpen /></span>
        <small aria-hidden="true">초대장</small>
      </button>
    </div>
  );
}

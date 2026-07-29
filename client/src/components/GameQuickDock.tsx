import { useEffect, useState, type RefObject } from "react";
import { Bell, BookOpen, Route, SlidersHorizontal, SmilePlus, Volume2 } from "lucide-react";
import type { GuestReaction } from "@wedding-game/shared";
import {
  gameQuickDockActions,
  loadGameQuickDockActions,
  saveGameQuickDockActions,
  toggleGameQuickDockAction,
  type GameQuickDockAction
} from "../game/gameQuickDockPreferences";
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
  onOpenMenu
}: GameQuickDockProps) {
  const [favorites, setFavorites] = useState(loadGameQuickDockActions);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    saveGameQuickDockActions(favorites);
  }, [favorites]);

  useEffect(() => {
    if (disabled || menuOpen) setSettingsOpen(false);
  }, [disabled, menuOpen]);

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
    <div className="game-quick-dock" data-settings-open={settingsOpen || undefined}>
      {settingsOpen ? (
        <section className="game-quick-dock__settings" aria-label="빠른 도구 즐겨찾기">
          <header><strong>빠른 도구</strong><span>{favorites.length}/2</span></header>
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
        </section>
      ) : null}
      <div className="game-quick-dock__favorites world-control-actions" aria-label="즐겨찾기 빠른 도구">
        {favorites.map(renderAction)}
      </div>
      <button
        type="button"
        className="game-quick-dock__settings-toggle"
        aria-label={settingsOpen ? "빠른 도구 설정 닫기" : "빠른 도구 설정"}
        aria-expanded={settingsOpen}
        title="빠른 도구 설정"
        onClick={() => {
          onPause();
          setSettingsOpen((current) => !current);
        }}
      >
        <SlidersHorizontal aria-hidden="true" />
      </button>
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
      </button>
    </div>
  );
}

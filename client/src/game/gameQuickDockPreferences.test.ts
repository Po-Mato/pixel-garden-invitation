import { describe, expect, it } from "vitest";
import {
  defaultGameQuickDockActions,
  clearGameQuickDockSyncQuery,
  createGameQuickDockSyncUrl,
  gameQuickDockActionsFromUrl,
  gameQuickDockStorageKey,
  loadGameQuickDockActions,
  saveGameQuickDockActions,
  resetGameQuickDockActions,
  toggleGameQuickDockAction
} from "./gameQuickDockPreferences";

describe("게임 빠른 도구 즐겨찾기", () => {
  it("최대 두 개를 유지하며 마지막 선택으로 교체한다", () => {
    expect(toggleGameQuickDockAction(defaultGameQuickDockActions, "journey")).toEqual(["guide", "journey"]);
    expect(toggleGameQuickDockAction(["guide", "journey"], "guide")).toEqual(["journey"]);
    expect(toggleGameQuickDockAction(["journey"], "journey")).toEqual(["journey"]);
  });

  it("저장값을 정규화하고 손상된 값은 기본값으로 복구한다", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }
    };
    expect(saveGameQuickDockActions(["sound", "journey"], storage)).toBe(true);
    expect(loadGameQuickDockActions(storage)).toEqual(["sound", "journey"]);
    values.set(gameQuickDockStorageKey, "not-json");
    expect(loadGameQuickDockActions(storage)).toEqual(defaultGameQuickDockActions);
  });

  it("초기화와 다른 기기용 동기화 링크를 지원한다", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }
    };
    saveGameQuickDockActions(["sound", "journey"], storage);
    expect(resetGameQuickDockActions(storage)).toEqual(defaultGameQuickDockActions);

    const url = createGameQuickDockSyncUrl(["sound", "journey"], "https://invite.test/path?guest=1#game");
    expect(gameQuickDockActionsFromUrl(url)).toEqual(["sound", "journey"]);
    expect(clearGameQuickDockSyncQuery(url)).toBe("/path?guest=1#game");
  });
});

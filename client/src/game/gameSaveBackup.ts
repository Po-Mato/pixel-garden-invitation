export type GameSaveBackup = {
  schema: "wedding-game-save";
  version: 1;
  createdAt: string;
  entries: Record<string, string>;
};

type GameSaveStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const exactKeys = new Set([
  "wedding-game-feedback:v1",
  "wedding-game-quick-dock:v1",
  "wedding-view-preferences:v1",
  "wedding-map-effects-quality:v1",
  "wedding-world-secrets:v1",
  "wedding-world-travel-history:v1"
]);

const gameKeyPrefixes = [
  "wedding-game:celebration-",
  "wedding-game:destination-",
  "wedding-game:entry-session:",
  "wedding-game:first-visit-guide:",
  "wedding-game:memory-",
  "wedding-game:npc-dialogue-memory:",
  "wedding-game:photo-",
  "wedding-game:journey-progress:",
  "wedding-game:journey-visits:",
  "wedding-game:view-sync:",
  "wedding-game:world-session:",
  "wedding-game:zone-mini-quest:"
] as const;

const maximumBackupBytes = 20 * 1024 * 1024;

export function isGameSaveStorageKey(key: string): boolean {
  return exactKeys.has(key) || gameKeyPrefixes.some((prefix) => key.startsWith(prefix));
}

export function createGameSaveBackup(
  storage: GameSaveStorage,
  createdAt = new Date().toISOString()
): GameSaveBackup {
  const entries: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !isGameSaveStorageKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) entries[key] = value;
  }
  return { schema: "wedding-game-save", version: 1, createdAt, entries };
}

export function parseGameSaveBackup(source: string): GameSaveBackup {
  if (new Blob([source]).size > maximumBackupBytes) throw new Error("백업 파일이 너무 큽니다.");
  const value = JSON.parse(source) as Partial<GameSaveBackup> | null;
  if (value?.schema !== "wedding-game-save" || value.version !== 1 || typeof value.createdAt !== "string" || !value.entries || typeof value.entries !== "object") {
    throw new Error("지원하지 않는 게임 백업 파일입니다.");
  }
  const entries: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value.entries)) {
    if (!isGameSaveStorageKey(key) || typeof entry !== "string") throw new Error("허용되지 않은 저장 항목이 포함되어 있습니다.");
    entries[key] = entry;
  }
  return { schema: "wedding-game-save", version: 1, createdAt: value.createdAt, entries };
}

export function restoreGameSaveBackup(backup: GameSaveBackup, storage: GameSaveStorage): number {
  const previous = new Map<string, string | null>();
  const keys = Object.keys(backup.entries);
  try {
    keys.forEach((key) => {
      if (!isGameSaveStorageKey(key)) throw new Error("허용되지 않은 저장 항목입니다.");
      previous.set(key, storage.getItem(key));
      storage.setItem(key, backup.entries[key]);
    });
  } catch (error) {
    previous.forEach((value, key) => {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        // Preserve the original restore error.
      }
    });
    throw error;
  }
  return keys.length;
}

export function gameSaveBackupFilename(createdAt = new Date()): string {
  const date = createdAt.toISOString().slice(0, 10);
  return `wedding-game-save-${date}.json`;
}

export function downloadGameSaveBackup(backup: GameSaveBackup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = gameSaveBackupFilename(new Date(backup.createdAt));
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
